"""
Busca semântica e montagem de prompt para RAG — NovaTech
Recebe uma pergunta, busca chunks relevantes no ChromaDB,
retorna chunks com scores e monta o prompt completo para o LLM.

Desenvolvido com assistência do GitHub Copilot (evidência nos comentários inline).
"""

import sys
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

# ── Configuração ──────────────────────────────────────────────────────────────

CHROMA_PATH = Path(__file__).parent / "chroma_db"
COLLECTION_NAME = "novatech"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
N_RESULTS = 7
SIMILARITY_THRESHOLD = 0.35  # Chunks abaixo disso são descartados (resposta "não encontrei")

# System prompt v2 do Exercício 1.2 (versão condensada para uso no pipeline)
SYSTEM_PROMPT = """\
## IDENTIDADE

Você é o Assistente de Atendimento da NovaTech, empresa de logística.
Responda perguntas dos atendentes com base EXCLUSIVAMENTE nos chunks de
documentação fornecidos abaixo. Nunca use conhecimento externo.

## REGRAS OBRIGATÓRIAS

1. USE APENAS os chunks fornecidos. Sem suposições ou inferências externas.
2. EXCEÇÕES têm prioridade sobre regras gerais: antes de citar a regra geral,
   verifique se há exceção que se aplica à categoria específica perguntada.
   Se houver exceção impeditiva, responda primeiro com "NÃO é elegível" ou
   "NÃO se aplica", depois explique o caminho alternativo.
3. SLAs: especifique sempre o tipo — RESPOSTA (primeiro contato) vs.
   RESOLUÇÃO (problema resolvido). Nunca confunda os dois.
4. CITE a fonte ao final de cada dado: (Fonte: [documento], seção [X.Y])
5. Se nenhum chunk tiver informação suficiente, diga: "Não encontrei
   documentação sobre este tema. Recomendo escalar para o supervisor."
6. NUNCA invente prazos, valores, multiplicadores ou percentuais.
   Se o cálculo depende de um valor base ausente nos chunks, forneça a
   fórmula e os parâmetros disponíveis, indicando onde buscar o faltante.

## PRIORIDADE DE FONTES (em caso de conflito entre chunks)

1. Documentos normativos (POL-XXX, PROC-XXX, SLA-XXXX) — fonte primária
2. Versão mais recente do documento (maior data de emissão)
3. FAQ-Atendimento — somente para orientações não cobertas por normativos;
   sinalize explicitamente quando usar o FAQ

## FORMATO DE RESPOSTA

Linha 1: resposta direta e inequívoca
Corpo: detalhes, procedimento, contexto (se necessário)
Rodapé: citação de fonte por dado específico
Ação: próximo passo para o atendente (se aplicável)
"""


# ── Busca semântica ───────────────────────────────────────────────────────────

# [Copilot sugeriu a estrutura da função com retorno de lista de dicts tipados]
def search(question: str, n_results: int = N_RESULTS) -> list[dict]:
    """
    Busca os N chunks mais similares à pergunta no ChromaDB.
    Retorna lista de dicts com text, source, heading, similarity e rank.
    """
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = client.get_collection(COLLECTION_NAME)
    model = SentenceTransformer(EMBEDDING_MODEL)

    question_embedding = model.encode(question).tolist()

    # [Copilot completou o results.query com include dos três campos]
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for i, (doc, meta, dist) in enumerate(
        zip(results["documents"][0], results["metadatas"][0], results["distances"][0])
    ):
        similarity = round(1 - dist, 4)  # distância cosseno → similaridade
        if similarity < SIMILARITY_THRESHOLD:
            continue  # descarta chunks irrelevantes
        chunks.append({
            "rank": i + 1,
            "text": doc,
            "source": meta["source"],
            "filename": meta["filename"],
            "heading": meta["heading"],
            "similarity": similarity,
        })

    return chunks


# ── Montagem do prompt ────────────────────────────────────────────────────────

def assemble_prompt(question: str, chunks: list[dict]) -> str:
    """
    Monta o prompt completo: system prompt (estático) + chunks recuperados
    (dinâmico, ordenados por relevância) + pergunta (dinâmico).

    Posicionamento deliberado:
    - chunk mais relevante no início (alta atenção do modelo)
    - chunks intermediários no meio
    - segundo mais relevante no final (mitigação "lost in the middle")
    Se houver ≥ 2 chunks, o segundo mais relevante é movido para o final.
    """
    if not chunks:
        # Nenhum chunk acima do threshold — resposta padrão
        return (
            f"{SYSTEM_PROMPT}\n\n---\n\n"
            "## DOCUMENTAÇÃO RECUPERADA\n\n"
            "[Nenhum chunk com similaridade suficiente encontrado para esta pergunta.]\n\n"
            f"---\n\n## PERGUNTA DO ATENDENTE\n\n{question}"
        )

    # Reordena: [0, 2, 3, ..., n-1, 1] para flanqueamento
    # [Copilot sugeriu este reordenamento para mitigar lost-in-the-middle]
    if len(chunks) >= 2:
        ordered = [chunks[0]] + chunks[2:] + [chunks[1]]
    else:
        ordered = chunks

    chunks_text = "\n\n---\n\n".join(
        f"[CHUNK {c['rank']} | {c['filename']} — {c['heading']} | sim: {c['similarity']}]\n\n{c['text']}"
        for c in ordered
    )

    return (
        f"{SYSTEM_PROMPT}\n\n"
        "---\n\n"
        "## DOCUMENTAÇÃO RECUPERADA (ordenada por relevância com flanqueamento)\n\n"
        f"{chunks_text}\n\n"
        "---\n\n"
        f"## PERGUNTA DO ATENDENTE\n\n{question}"
    )


# ── Interface de linha de comando ─────────────────────────────────────────────

def run_query(question: str, verbose: bool = True) -> dict:
    """Executa uma query completa e retorna chunks + prompt montado."""
    chunks = search(question)

    if verbose:
        print(f"\n{'='*60}")
        print(f"PERGUNTA: {question}")
        print(f"{'='*60}")
        if not chunks:
            print("⚠️  Nenhum chunk acima do threshold de similaridade.")
        else:
            print(f"Chunks recuperados ({len(chunks)}):\n")
            for c in chunks:
                preview = c["text"][:120].replace("\n", " ")
                print(f"  [{c['rank']}] sim={c['similarity']} | {c['filename']} — {c['heading']}")
                print(f"       {preview}...\n")

    prompt = assemble_prompt(question, chunks)
    return {"question": question, "chunks": chunks, "prompt": prompt}


if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Qual o prazo de devolução?"
    result = run_query(question)

    print("\n" + "=" * 60)
    print("PROMPT MONTADO (cole no Claude para obter a resposta):")
    print("=" * 60)
    print(result["prompt"])

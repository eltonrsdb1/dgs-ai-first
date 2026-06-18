"""
Pipeline de ingestão para RAG — NovaTech
Lê documentos .md, divide em chunks por seção semântica,
gera embeddings com sentence-transformers e armazena no ChromaDB.

Desenvolvido com assistência do GitHub Copilot (evidência nos comentários inline).
"""

import re
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

# ── Configuração ──────────────────────────────────────────────────────────────

DOCS_DIR = Path(__file__).parent / "../../1-pratica"
CHROMA_PATH = Path(__file__).parent / "chroma_db"
COLLECTION_NAME = "novatech"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Documentos a indexar (ignora anexos e o próprio exercício)
INCLUDE_DOCS = {
    "POL-001-politica-devolucao.md",
    "PROC-042-frete-especial-v1.md",
    "PROC-042-v2-frete-especial-revisado.md",
    "SLA-2024-tabela-sla-clientes.md",
    "FAQ-atendimento.md",
}

# Limite de palavras por chunk antes de subdividir
MAX_WORDS_PER_CHUNK = 350
OVERLAP_WORDS = 40


# ── Carregamento de documentos ────────────────────────────────────────────────

def load_documents(docs_dir: Path) -> list[dict]:
    """Carrega documentos .md do diretório configurado."""
    docs = []
    for md_file in sorted(docs_dir.glob("*.md")):
        if md_file.name not in INCLUDE_DOCS:
            continue
        content = md_file.read_text(encoding="utf-8")
        docs.append({"filename": md_file.name, "source": md_file.stem, "content": content})
    return docs


# ── Chunking por seção semântica ──────────────────────────────────────────────
#
# Estratégia: dividir pelo heading markdown (## / ###).
# Motivação (vs. chunking fixo de 512 tokens):
#   1. Tabelas ficam inteiras dentro da seção — não são cortadas no meio de uma linha.
#   2. Regras e exceções de uma mesma subseção permanecem juntas (ex: seção 3.2 da POL-001
#      contém a exceção de carga perigosa; separar da seção 3.1 previne que o modelo
#      misture a regra geral com a exceção).
#   3. O heading vira contexto do chunk — o modelo sabe de qual seção o trecho veio.
#
# [Copilot sugeriu o split por regex de headings e o prefixo com heading no chunk]

def split_by_words(text: str, max_words: int, overlap: int) -> list[str]:
    """Subdivide texto longo em sub-chunks com overlap (preserva palavras inteiras)."""
    # [Copilot completou o loop de start/end com cálculo de overlap]
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = min(start + max_words, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += max_words - overlap
    return chunks


def chunk_document(doc: dict) -> list[dict]:
    """
    Divide um documento em chunks por heading (##/###).
    Seções maiores que MAX_WORDS_PER_CHUNK são subdivididas com overlap.
    """
    content = doc["content"]
    source = doc["source"]
    filename = doc["filename"]

    # Divide em headings ##/### para manter granularidade por subseção.
    # Chunks resultantes que contenham apenas o heading sem corpo (< 10 palavras de conteúdo)
    # são descartados abaixo — evita chunks "fantasma" gerados quando um ## é seguido
    # imediatamente por ### sem texto intermediário.
    raw_sections = re.split(r"(?=\n#{1,3} )", content)

    chunks = []
    chunk_idx = 0

    for section in raw_sections:
        section = section.strip()
        if not section:
            continue

        # Extrai o heading para usar como contexto
        first_line = section.splitlines()[0]
        heading = first_line.lstrip("#").strip() if first_line.startswith("#") else "intro"

        # Descarta chunks sem conteúdo além do heading (artefato de divisão)
        content_words = [w for line in section.splitlines()[1:] for w in line.split()]
        if len(content_words) < 10:
            continue

        words = section.split()

        if len(words) <= MAX_WORDS_PER_CHUNK:
            chunks.append({
                "id": f"{source}__chunk{chunk_idx:03d}",
                "text": section,
                "source": source,
                "filename": filename,
                "heading": heading,
            })
            chunk_idx += 1
        else:
            # Seção longa: subdividir com overlap, repetindo o heading no início de cada sub-chunk
            sub_texts = split_by_words(section, MAX_WORDS_PER_CHUNK, OVERLAP_WORDS)
            for j, sub in enumerate(sub_texts):
                prefix = f"[{heading}] " if not sub.startswith("#") else ""
                chunks.append({
                    "id": f"{source}__chunk{chunk_idx:03d}",
                    "text": prefix + sub,
                    "source": source,
                    "filename": filename,
                    "heading": f"{heading} (parte {j + 1}/{len(sub_texts)})",
                })
                chunk_idx += 1

    return chunks


# ── Ingestão no ChromaDB ──────────────────────────────────────────────────────

def ingest():
    print(f"Modelo de embedding: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)

    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    # Recria a collection para garantir estado limpo
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"Collection '{COLLECTION_NAME}' anterior removida.")
    except Exception:
        pass

    # [Copilot sugeriu o metadata de hnsw:space cosine para similaridade de cosseno]
    collection = client.create_collection(
        COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    docs = load_documents(DOCS_DIR)
    if not docs:
        print(f"ERRO: Nenhum documento encontrado em {DOCS_DIR.resolve()}")
        return

    print(f"\nDocumentos carregados: {len(docs)}")

    all_chunks = []
    for doc in docs:
        chunks = chunk_document(doc)
        print(f"  {doc['filename']}: {len(chunks)} chunks")
        all_chunks.extend(chunks)

    print(f"\nTotal de chunks: {len(all_chunks)}")
    print("Gerando embeddings e indexando no ChromaDB...")

    texts = [c["text"] for c in all_chunks]
    ids = [c["id"] for c in all_chunks]
    metadatas = [
        {"source": c["source"], "filename": c["filename"], "heading": c["heading"]}
        for c in all_chunks
    ]

    # [Copilot completou o batch de encode e o collection.add com todos os campos]
    embeddings = model.encode(texts, show_progress_bar=True, batch_size=32)

    collection.add(
        documents=texts,
        embeddings=embeddings.tolist(),
        ids=ids,
        metadatas=metadatas,
    )

    print(f"\n✅ Ingestão concluída: {len(all_chunks)} chunks indexados em '{CHROMA_PATH}'")


if __name__ == "__main__":
    ingest()

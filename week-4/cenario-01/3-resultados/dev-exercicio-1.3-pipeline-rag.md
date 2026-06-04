# Exercício 1.3 — Construção de Pipeline de RAG com Ferramentas Open-Source

> **Papel:** Desenvolvedor  
> **Projeto:** Assistente de IA — NovaTech (DB1 Global Software)  
> **Data:** 2026-06-04  
> **Ferramentas utilizadas:** Claude (chat) + GitHub Copilot

---

## Arquivos do Pipeline

```
3-resultados/projetinho/
├── requirements.txt    # chromadb>=0.4.0, sentence-transformers>=2.2.0
├── ingest.py           # Ingestão: lê docs → chunk → embedding → ChromaDB
├── search.py           # Busca + montagem de prompt para o LLM
└── chroma_db/          # Base vetorial gerada em runtime (39 chunks)
```

**Para executar:**
```bash
cd 3-resultados/projetinho
pip install -r requirements.txt
python3 ingest.py        # indexa os 5 documentos do Anexo A
python3 search.py "pergunta do atendente"
```

---

## Evidência do GitHub Copilot

| Arquivo | Trecho assistido | Tipo |
|---------|-----------------|------|
| `ingest.py` | `re.split(r"(?=\n#{1,3} )", content)` | Completou o regex de split por heading |
| `ingest.py` | Prefixo `f"[{heading}] "` nos sub-chunks | Sugeriu padrão de preservação de contexto |
| `ingest.py` | `metadata={"hnsw:space": "cosine"}` | Completou o parâmetro de métrica correto |
| `ingest.py` | `collection.add(documents=..., embeddings=..., ids=..., metadatas=...)` | Completou a assinatura completa do método |
| `search.py` | Estrutura de retorno `list[dict]` tipada da função `search()` | Sugeriu os campos do dict de resultado |
| `search.py` | `collection.query(..., include=["documents","metadatas","distances"])` | Completou o parâmetro `include` |
| `search.py` | Algoritmo de flanqueamento `[chunks[0]] + chunks[2:] + [chunks[1]]` | Sugeriu a reordenação após descrição verbal |

**Exemplo de completamento (ingest.py — `split_by_words`):**
```python
# O que escrevi:
def split_by_words(text: str, max_words: int, overlap: int) -> list[str]:
    """Subdivide texto longo em sub-chunks com overlap."""
    # [Copilot completou a partir do docstring]

# Copilot sugeriu (aceito com pequena modificação):
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = min(start + max_words, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += max_words - overlap
    return chunks
```

---

## Estratégia de Chunking

**Abordagem:** Chunking por seção semântica (headings markdown `##`/`###`)  
**Parâmetros:** máx. 350 palavras por chunk; overlap de 40 palavras (~11%); heading repetido como prefixo em sub-chunks de seções longas.

**Chunks gerados (saída real do `ingest.py` — versão final após correção do bug de headings):**

```
Documentos carregados: 5
  FAQ-atendimento.md:                   10 chunks
  POL-001-politica-devolucao.md:         8 chunks
  PROC-042-frete-especial-v1.md:         6 chunks
  PROC-042-v2-frete-especial-revisado:   7 chunks
  SLA-2024-tabela-sla-clientes.md:       6 chunks
Total: 37 chunks indexados
```

> **Correção aplicada:** a primeira execução (ingest v1) gerou 39 chunks, incluindo 2 chunks "fantasma" com apenas o texto de heading (`## 3. Regras de Devolução`, `## Perguntas selecionadas`) sem conteúdo. Esses chunks obtinham scores altos por similaridade semântica com queries sobre o tema, mas não continham informação útil para o LLM. A correção filtrou chunks com menos de 10 palavras de conteúdo além do heading (ver commit no `ingest.py`).

**Justificativa vs. chunking fixo de 512 tokens:**
1. Tabelas ficam inteiras dentro da seção
2. Exceções (POL-001 §3.2) ficam separadas de regras gerais (§3.1) — permitem retrieval cirúrgico
3. Procedimentos com passos numerados não são cortados no meio

---

## Testes do Pipeline — 5 Perguntas do Mapa de Cobertura (Anexo B)

> **Resultados reais** obtidos executando `python3 search.py "pergunta"` após `python3 ingest.py`.

---

### Teste 1 — "Qual o prazo de devolução?"

**Gabarito (Anexo B):** POL-001-A (§3.1 prazo geral), POL-001-B (§3.2 exceções)

**Chunks recuperados (real — ingest v2 corrigido):**

```
[1] sim=0.633 | POL-001 — 3.5. Custos de devolução
    Defeito ou erro da NovaTech: sem custo. Desistência do cliente: custo do frete reverso...

[2] sim=0.571 | FAQ — Item 3 (carga perigosa)
    "Na prática, orienta ligar no ramal 4500..."

[3] sim=0.558 | POL-001 — 3.3. Procedimento de devolução
    O cliente abre chamado no Portal...

[4] sim=0.548 | PROC-042-v1 — 3. Prazo de entrega para frete especial
    ...prazo padrão da rota + 2 dias úteis...

[5] sim=0.532 | FAQ — Item 41 (SLA resposta vs resolução)
[6] sim=0.530 | POL-001 — 3.4. Devoluções parciais
[7] sim=0.519 | PROC-042-v2 — 3. Prazo de entrega para frete especial
```

**⚠️ Avaliação vs. gabarito: FALHA PARCIAL**  
O chunk fantasma de heading vazio foi eliminado pela correção. Porém `### 3.1. Prazo geral` e `### 3.2. Exceções` ainda não aparecem no top-7. Os chunks que chegam (3.3, 3.4, 3.5) são de procedimento e custos de devolução — relevantes ao tema mas não à pergunta pontual sobre prazo. O modelo `all-MiniLM-L6-v2` não ranqueou as subseções mais diretas com score suficiente para entrar no top-7, provavelmente por diferença semântica entre a query em português coloquial e o texto técnico das subseções.

---

### Teste 2 — "Posso devolver carga perigosa?"

**Gabarito (Anexo B):** POL-001-B (§3.2 exceções). Secundário: FAQ-03, POL-001-A

**Chunks recuperados (real):**

```
[1] sim=0.618 | FAQ — Item 3 (carga perigosa)
    "...já tiveram casos em que Riscos autorizou exceção. Não diga impossível..."

[2] sim=0.579 | FAQ — Item 22 (seguro de carga) ← irrelevante
[3] sim=0.546 | FAQ — Item 38 (carga danificada) ← irrelevante
[4] sim=0.524 | FAQ — Item 32 (frete expresso + carga perigosa)
[5] sim=0.508 | PROC-042-v1 — 4. Condições especiais
[6] sim=0.502 | POL-001 — 3.5. Custos de devolução
[7] sim=0.484 | PROC-042-v2 — 4. Condições especiais
```

**❌ Avaliação vs. gabarito: FALHA CRÍTICA**  
O chunk fantasma desapareceu, mas o problema persiste: a subseção `### 3.2. Exceções ao prazo geral` — que contém a resposta normativa correta ("NÃO são elegíveis para devolução") — **ainda não aparece entre os 7 chunks recuperados**. O FAQ-Item 3 lidera com 0.618 porque foi escrito exatamente na forma de pergunta/resposta sobre o mesmo tema, tornando-o semanticamente mais próximo da query do que o texto normativo. Nenhum chunk normativo com a proibição explícita chegou ao top-7.

**Causa raiz aprofundada:** o `### 3.2.` usa vocabulário técnico-regulatório ("NÃO são elegíveis", "classes 1 a 6 da ANTT", "Resolução ANTT nº 5.947/2021"). A query "Posso devolver carga perigosa?" usa linguagem coloquial. O `all-MiniLM-L6-v2` (modelo de propósito geral, treinado majoritariamente em inglês) não captura bem essa equivalência semântica cross-vocabulário em português.

---

### Teste 3 — "Qual o SLA do cliente Gold?"

**Gabarito (Anexo B):** SLA-2024-B (tabela de SLAs)

**Chunks recuperados (real):**

```
[1] sim=0.549 | SLA-2024 — 5. Medição e reportes
    "SLAs medidos pelo Azure DevOps a partir do timestamp..."   ← não tem os valores

[2] sim=0.549 | FAQ — Item 41 (SLA resposta vs resolução)
    "Gold tem 2h de resposta e 24h de resolução. Silver é 4h..."

[3] sim=0.543 | FAQ — Item 15 (tier Platinum não existe)  ← irrelevante
[4] sim=0.514 | SLA-2024 — 1. Classificação de clientes
[5] sim=0.466 | SLA-2024 — cabeçalho/metadados do documento
[6] sim=0.465 | FAQ — Item 27 (tracking em trânsito)  ← irrelevante
[7] sim=0.434 | FAQ — Item 3 (carga perigosa)  ← irrelevante
```

**⚠️ Avaliação vs. gabarito: FALHA PARCIAL**  
O chunk esperado `## 2. Tabela de SLAs` (que contém a tabela com os valores 2h/24h para Gold) **não aparece nos top-7**. O chunk que fornece a resposta correta chega indiretamente via FAQ-Item 41 (posição [2]), que cita os valores por memória prática, não pela tabela normativa. A seção "5. Medição e reportes" ficou com score mais alto que a tabela de valores, provavelmente pela semântica de "SLA" + "Gold" estar espalhada no documento.

---

### Teste 4 — "Qual o SLA do cliente Platinum?"

**Gabarito (Anexo B):** SLA-2024-A (contém "não existem outros tiers"). Secundário: FAQ-15

**Chunks recuperados (real):**

```
[1] sim=0.596 | FAQ — Item 15 (tier Platinum)
    "Não existe tier Platinum... nossos tiers são Gold, Silver e Standard..."

[2] sim=0.510 | SLA-2024 — cabeçalho/metadados
[3] sim=0.502 | SLA-2024 — 5. Medição e reportes
[4] sim=0.496 | SLA-2024 — 1. Classificação de clientes
    "Não existem outros tiers além dos três listados."
```

**✅ Avaliação vs. gabarito: CORRETO**  
FAQ-Item 15 (informação correta: Platinum não existe) ficou em primeiro. SLA-2024 classificação em quarto fornece confirmação normativa. O LLM receberia informação suficiente para responder corretamente que o tier não existe.

**Nota:** neste caso o FAQ fornece a resposta melhor formatada ("não existe, às vezes o cliente confunde…") do que o normativo. Para perguntas sobre tiers inválidos, o FAQ é a fonte prática adequada.

---

### Teste 5 — "Quanto custa o frete para 600kg para Manaus?"

**Gabarito (Anexo B):** PROC-042v2-B (multiplicadores), PROC-042v2-A (fórmula). Risco: PROC-042-B (versão antiga)

**Chunks recuperados (real):**

```
[1] sim=0.534 | PROC-042-v1 — 1. Objetivo   ← versão antiga
[2] sim=0.526 | PROC-042-v2 — 2. Fórmula de cálculo
    "Fator de peso: 1.0 (500-1.000kg), 1.15 (1.001-3.000kg), 1.4 (>3.000kg)"

[3] sim=0.526 | PROC-042-v2 — 1. Objetivo   ← dois objetivos misturados
[4] sim=0.525 | PROC-042-v1 — 2. Fórmula de cálculo
    "Fator de peso: 1.0 (500-1.000kg), 1.2 (1.001-3.000kg), 1.5 (>3.000kg)"

[5] sim=0.521 | FAQ — Item 27 (tracking em trânsito)  ← irrelevante
[6] sim=0.507 | PROC-042-v2 — 4. Condições especiais
[7] sim=0.498 | FAQ — Item 8 (frete especial)
    "Cuidado: existem duas versões da PROC-042..."
```

**❌ Avaliação vs. gabarito: FALHA**  
Dois problemas simultâneos:  
1. Os chunks com a **tabela de multiplicadores regionais** (Norte: 1.8 na v2, 1.6 na v1) **não foram recuperados** — o chunk `### 2.1. Multiplicadores regionais` que contém a resposta direta não aparece.  
2. Chunks de **v1 e v2 estão misturados** com scores quase idênticos (0.534 vs 0.526 vs 0.525), confirmando o problema previsto de versões contraditórias. O fator de peso aparece duas vezes com valores diferentes: v1 diz 1.2 (1.001-3.000kg) e v2 diz 1.15.

---

## Resumo dos 5 Testes

| # | Pergunta | Chunks corretos recuperados? | Avaliação |
|---|----------|------------------------------|-----------|
| 1 | Prazo de devolução | ❌ §3.1 e §3.2 ausentes; chunk vazio de heading no topo | FALHA |
| 2 | Devolver carga perigosa | ❌ §3.2 normativo ausente; FAQ domina o topo | FALHA CRÍTICA |
| 3 | SLA cliente Gold | ⚠️ Tabela de SLAs ausente; resposta chega via FAQ indiretamente | PARCIAL |
| 4 | SLA cliente Platinum | ✅ FAQ-15 + SLA classificação recuperados | CORRETO |
| 5 | Frete 600kg Manaus | ❌ Tabela de multiplicadores ausente; v1 e v2 misturados | FALHA |

**1/5 perguntas com retrieval correto (Teste 4).** Os testes revelaram que o pipeline roda corretamente como software, mas a estratégia de chunking introduziu dois problemas estruturais que degradam a qualidade do retrieval na maioria dos casos.

---

## Resumo dos 5 Testes

| # | Pergunta | Chunks corretos no top-7? | Avaliação |
|---|----------|--------------------------|-----------|
| 1 | Prazo de devolução | ⚠️ §3.1 e §3.2 ausentes; custos e procedimento chegam | PARCIAL |
| 2 | Devolver carga perigosa | ❌ §3.2 normativo ausente; FAQ domina com 4 chunks | FALHA |
| 3 | SLA cliente Gold | ⚠️ Tabela de SLAs não chega; resposta via FAQ-41 | PARCIAL |
| 4 | SLA cliente Platinum | ✅ FAQ-15 + SLA classificação recuperados | CORRETO |
| 5 | Frete 600kg Manaus | ❌ Tabela de multiplicadores ausente; v1 e v2 misturados | FALHA |

**2/5 com retrieval aceitável** (Testes 1, 3 trazem informação parcialmente útil; Teste 4 correto). A PoC demonstrou que o pipeline roda end-to-end e expôs problemas reais de dados e de modelo.

---

## Problemas Identificados e Propostas de Correção

---

### Problema 1 — Chunks de heading vazio (corrigido) e limitação de retrieval por vocabulário

**Descrição:**  
A primeira versão do `ingest.py` gerava chunks "fantasma" — apenas o texto do heading `##` sem conteúdo, porque a subseção `###` imediatamente seguinte disparava um novo split. Esses chunks obtinham scores altos por corresponderem semanticamente ao tema, mas o LLM recebia o título sem informação.

**Correção aplicada:**  
Adicionado filtro `if len(content_words) < 10: continue` em `chunk_document()`. A reindexação reduziu de 39 para 37 chunks (2 heading-vazios removidos). O resultado para o Teste 1 mudou: o chunk fantasma (`sim=0.659`) sumiu, e a posição [1] passou para `3.5. Custos de devolução` (`sim=0.633`).

**Problema remanescente:**  
Mesmo após a correção, as subseções `### 3.1.` e `### 3.2.` ainda não entram no top-7 para as queries 1 e 2. Isso não é um bug de chunking — os chunks existem e têm conteúdo. É uma limitação do modelo `all-MiniLM-L6-v2`: o texto normativo usa vocabulário técnico-regulatório ("NÃO são elegíveis", "Resolução ANTT nº 5.947/2021") que tem baixa similaridade semântica com queries em português coloquial ("posso devolver?").

**Proposta de correção adicional:**  
Substituir `all-MiniLM-L6-v2` por um modelo multilíngue ou fine-tuned em português, como `paraphrase-multilingual-MiniLM-L12-v2` ou `neuralmind/bert-base-portuguese-cased`. Na produção, Azure AI Search com embeddings `text-embedding-ada-002` melhoraria o recall para texto em português técnico.

---

### Problema 2 — FAQ domina retrieval sobre normativos em perguntas sobre exceções

**Descrição:**  
No Teste 2 ("posso devolver carga perigosa?"), o FAQ-Item 3 obteve score 0.618, o mais alto do conjunto. O normativo correto (POL-001 §3.2, que diz "NÃO são elegíveis") não apareceu no top-7. Isso acontece porque o FAQ foi escrito como pergunta e resposta sobre exatamente o mesmo tema da query, tornando-o semanticamente muito próximo — enquanto o normativo usa linguagem técnica/regulatória que tem menor similaridade com a linguagem coloquial da pergunta.

**Impacto real (Teste 2):**  
Com o FAQ no topo, o LLM recebe como chunk principal: *"já tiveram casos em que o pessoal de Riscos autorizou exceção. Então não diga que é impossível — diga que precisa de tratamento especial."* A instrução do system prompt de priorizar normativos pode não ser suficiente se o normativo não estiver sequer no contexto.

**Proposta de correção:**

1. **Boost por tipo de fonte no retrieval** (score ajustado):
```python
# Em search.py, após obter os resultados:
BOOST_NORMATIVO = 0.10  # adiciona 0.10 ao score de chunks normativos

for chunk in chunks:
    if any(doc_type in chunk["filename"] for doc_type in ["POL-", "PROC-", "SLA-"]):
        chunk["similarity"] = min(chunk["similarity"] + BOOST_NORMATIVO, 1.0)
        chunk["boosted"] = True

# Reordena após boost
chunks.sort(key=lambda x: x["similarity"], reverse=True)
```

2. **Separar FAQ em collection própria**: indexar FAQ separadamente e só consultá-lo se a busca na collection de normativos retornar score < 0.5 para todos os chunks. Isso garante que normativos sempre têm prioridade de recuperação, não só de uso pelo LLM.

3. **Curadoria de conteúdo do FAQ**: remover do índice itens do FAQ que contradizem normativos (como o Item 3 que suaviza uma proibição explícita). Decisão de negócio junto ao Compliance.

---

## Reflexão: O Pipeline Roda, Mas Revela que RAG é Engenharia de Dados

Os problemas acima não são falhas de biblioteca (ChromaDB funciona), nem de modelo de embedding (`all-MiniLM-L6-v2` calcula similaridade corretamente). São falhas de engenharia de dados:

- **Problema 1** (chunks vazios) é um bug de pré-processamento — o pipeline gerou chunks inúteis que competem com chunks úteis
- **Problema 2** (FAQ vs. normativo) é uma falha de governança de dados — indexar fontes de confiabilidade diferente com o mesmo peso distorce o retrieval

Trocar ChromaDB por Azure AI Search, ou `all-MiniLM-L6-v2` por `text-embedding-ada-002`, não resolveria nenhum dos dois problemas. A correção exige mudança na lógica de chunking e na estratégia de indexação — não na tecnologia de busca.

O pipeline de PoC cumpriu seu objetivo: demonstrou que a abordagem funciona end-to-end e expôs os problemas reais antes de investir em infraestrutura Azure. Esses problemas precisam ser resolvidos antes do go-live.

# Tasks — Query Endpoint

**Module:** Query Endpoint  
**Owner:** Developer  
**Status:** In Progress  
**Date:** 2024-01-20  
**Based on:** plan.md (2024-01-18)

---

## Task Decomposition

### Legend
- **Size:** P (pequeno, 1-2h), M (médio, 3-4h), G (grande, 1+ dia)
- **Status:** 🔴 Not Started | 🟡 In Progress | 🟢 Done
- **Dependencies:** Tasks que precisam estar prontas antes

---

## Foundation Tasks

### T01: Setup do projeto e shared utilities
**Size:** M  
**Status:** 🟡 In Progress  
**Dependencies:** None  

**Description:**
Configurar shared utilities que serão usados por todas as tasks:
- Logger (pino) configurado com níveis e formato JSON
- Retry helper wrapper (p-retry) com configuração padrão
- Tipos TypeScript compartilhados (QueryRequest, QueryResponse, Chunk, etc.)

**Acceptance Criteria:**
- [ ] `src/shared/logger.ts` exporta logger configurado
- [ ] Logger usa pino, NEVER console.log
- [ ] `src/shared/retry.ts` exporta helper `retryWithBackoff()`
- [ ] Retry configurado: 3 tentativas, backoff exponencial 2^n * 100ms
- [ ] `src/shared/types.ts` define interfaces: QueryRequest, QueryResponse, Chunk, EmbeddingResult, SearchResult
- [ ] Todos os tipos usam strict TypeScript (no `any`)
- [ ] Testes unitários para retry helper

**Files to create:**
- `src/shared/logger.ts`
- `src/shared/retry.ts`
- `src/shared/types.ts`
- `tests/unit/shared/retry.test.ts`

---

### T02: Zod schemas para validação
**Size:** P  
**Status:** 🔴 Not Started  
**Dependencies:** T01 (types)  

**Description:**
Criar schemas Zod para validação de input (request) e output (response).

**Acceptance Criteria:**
- [ ] `src/functions/query/schemas.ts` define `QueryRequestSchema`
- [ ] QueryRequestSchema valida: `question` (string, min 3 chars, max 500), `history` (array opcional de turnos), `user_id` (string opcional)
- [ ] `src/functions/query/schemas.ts` define `QueryResponseSchema`
- [ ] QueryResponseSchema valida: `answer` (string), `source_documents` (array de strings), `confidence` (number 0-1), `latency_ms` (number), `query_id` (string UUID)
- [ ] Schemas inferem tipos TypeScript compatíveis com `src/shared/types.ts`
- [ ] Testes unitários para ambos schemas (casos válidos e inválidos)

**Files to create:**
- `src/functions/query/schemas.ts`
- `tests/unit/functions/query/schemas.test.ts`

---

## Core Service Tasks

### T03: Embedding service (Azure OpenAI)
**Size:** M  
**Status:** 🔴 Not Started  
**Dependencies:** T01 (logger, retry, types)  

**Description:**
Serviço para gerar embeddings de texto usando Azure OpenAI `text-embedding-ada-002`.

**Acceptance Criteria:**
- [ ] `src/services/embedding.ts` exporta função `generateEmbedding(text: string): Promise<number[]>`
- [ ] Usa Azure OpenAI SDK (`@azure/openai`)
- [ ] Endpoint e API key lidos de variáveis de ambiente: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`
- [ ] Usa retry helper de T01 (3 tentativas)
- [ ] Loga início e fim da chamada (com latência)
- [ ] Trata erros: 429 (rate limit) → retry; 401 (auth) → throw sem retry; outros → retry
- [ ] Testes unitários com mock do Azure SDK

**Files to create:**
- `src/services/embedding.ts`
- `tests/unit/services/embedding.test.ts`

---

### T04: Search service (Azure AI Search)
**Size:** M  
**Status:** 🔴 Not Started  
**Dependencies:** T01 (logger, retry, types), T03 (embedding)  

**Description:**
Serviço para buscar chunks relevantes no Azure AI Search usando vector search.

**Acceptance Criteria:**
- [ ] `src/services/search.ts` exporta função `searchChunks(embedding: number[], topK: number): Promise<Chunk[]>`
- [ ] Usa Azure AI Search SDK (`@azure/search-documents`)
- [ ] Endpoint, API key e index name lidos de env vars: `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_API_KEY`, `AZURE_SEARCH_INDEX_NAME`
- [ ] Vector search com similaridade cosine
- [ ] Filtro: quando há chunks de versões diferentes do mesmo doc, prioriza `vigencia` mais recente
- [ ] Retorna top-K chunks (default K=5)
- [ ] Threshold de similaridade: 0.7 (chunks abaixo disso são descartados)
- [ ] Usa retry helper
- [ ] Loga: query embedding, número de chunks retornados, similaridade mínima/máxima
- [ ] Testes unitários com mock do Azure SDK

**Files to create:**
- `src/services/search.ts`
- `tests/unit/services/search.test.ts`

---

### T05: Prompt builder com context budget
**Size:** M  
**Status:** 🔴 Not Started  
**Dependencies:** T01 (types)  

**Description:**
Serviço para montar o prompt final respeitando o context budget de ~14K tokens.

**Acceptance Criteria:**
- [ ] `src/services/prompt-builder.ts` exporta função `buildPrompt(systemPrompt: string, chunks: Chunk[], question: string, history?: Turn[]): Promise<string>`
- [ ] Lê system prompt de `/prompts/system-prompt.md` (ou recebe como parâmetro)
- [ ] Estima tokens usando `tiktoken` (encoding `cl100k_base` do GPT-4)
- [ ] Enforça budget: ~4K system + ~8K chunks + ~500 question + ~1.5K history = ~14K total
- [ ] Se exceder budget, trunca nesta ordem: (1) histórico (mantém apenas 3 turnos mais recentes), (2) chunks (mantém os mais relevantes, descarta os de menor similaridade)
- [ ] Loga: tokens_system, tokens_chunks, tokens_question, tokens_history, tokens_total
- [ ] Formato do prompt:
  ```
  {system_prompt}
  
  Documentação relevante:
  {chunk1}
  {chunk2}
  ...
  
  Histórico:
  {turn1}
  {turn2}
  
  Pergunta: {question}
  ```
- [ ] Testes unitários: casos dentro do budget, casos que excedem (valida truncamento)

**Files to create:**
- `src/services/prompt-builder.ts`
- `tests/unit/services/prompt-builder.test.ts`

---

### T06: Completion service (GPT-4o)
**Size:** M  
**Status:** 🔴 Not Started  
**Dependencies:** T01 (logger, retry, types), T05 (prompt builder)  

**Description:**
Serviço para enviar prompt ao GPT-4o e receber completion.

**Acceptance Criteria:**
- [ ] `src/services/completion.ts` exporta função `getCompletion(prompt: string): Promise<{ answer: string, confidence: number }>`
- [ ] Usa Azure OpenAI SDK (`@azure/openai`)
- [ ] Modelo: `gpt-4o` (lido de env var `AZURE_OPENAI_DEPLOYMENT_NAME`)
- [ ] Parâmetros: temperature=0.2, max_tokens=500, stop=["\n\n---"]
- [ ] Usa retry helper
- [ ] Calcula confiança: se resposta inclui "não encontrei" ou "não sei" → confiança = 0.5; caso contrário, usa logprobs se disponível, ou default 0.8
- [ ] Loga: prompt_tokens, completion_tokens, latency_ms, confidence
- [ ] Trata erros: timeout (30s), rate limit, content filter
- [ ] Testes unitários com mock do Azure SDK

**Files to create:**
- `src/services/completion.ts`
- `tests/unit/services/completion.test.ts`

---

### T07: Response validator (harness determinístico)
**Size:** P  
**Status:** 🔴 Not Started  
**Dependencies:** T01 (types)  

**Description:**
Harness determinístico que valida a resposta do LLM antes de retornar ao usuário.

**Acceptance Criteria:**
- [ ] `src/services/response-validator.ts` exporta função `validateResponse(answer: string, chunks: Chunk[], question: string): ValidationResult`
- [ ] Validação 1: Se resposta menciona "carga perigosa" E "devolução" E resposta é afirmativa → falha ("carga perigosa não pode ser devolvida pelo processo padrão")
- [ ] Validação 2: Se resposta menciona valores numéricos (regex: multiplicadores, prazos, SLAs), verifica que estão literalmente presentes nos chunks → se não, falha
- [ ] Validação 3: Se resposta menciona tier de cliente diferente de Gold/Silver/Standard → falha
- [ ] Retorna: `{ isValid: boolean, errors: string[], warnings: string[] }`
- [ ] Loga validação com resultado
- [ ] Testes unitários: casos válidos, casos inválidos (carga perigosa, valores inventados, tier inexistente)

**Files to create:**
- `src/services/response-validator.ts`
- `tests/unit/services/response-validator.test.ts`

---

## HTTP Handler Tasks

### T08: HTTP handler principal
**Size:** M  
**Status:** 🔴 Not Started  
**Dependencies:** T02 (schemas), T03-T07 (services)  

**Description:**
Azure Function HTTP trigger que orquestra o fluxo completo.

**Acceptance Criteria:**
- [ ] `src/functions/query/handler.ts` exporta função `queryHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponse>`
- [ ] Fluxo: valida input → gera embedding → busca chunks → monta prompt → gera completion → valida resposta → retorna JSON
- [ ] Valida input com Zod (T02); se inválido, retorna 400 com detalhes do erro
- [ ] Gera `query_id` (UUID) no início da requisição
- [ ] Contexto de logging inclui `query_id` em todos os logs
- [ ] Timeout total: 30s (configura no Azure Function)
- [ ] Se nenhum chunk for encontrado (similaridade < 0.7), retorna fallback: "Não encontrei informação sobre isso na documentação disponível. Sugiro escalar para supervisor."
- [ ] Se confiança < 0.7, prefixar resposta com "⚠️ Baixa confiança: "
- [ ] Se validação falha (T07), retorna erro 500 ou fallback (não retornar resposta inválida)
- [ ] Retorna JSON estruturado conforme schema de T02
- [ ] Instrumenta métricas: latency, token_usage, confidence
- [ ] Testes de integração: casos happy path, casos de erro (input inválido, Azure timeout, sem chunks, validação falha)

**Files to create:**
- `src/functions/query/handler.ts`
- `tests/integration/functions/query/handler.test.ts`

---

### T09: Azure Function configuration
**Size:** P  
**Status:** 🔴 Not Started  
**Dependencies:** T08 (handler)  

**Description:**
Configuração do Azure Function (host.json, function.json, local.settings.json).

**Acceptance Criteria:**
- [ ] `src/functions/query/function.json` configura HTTP trigger: método POST, rota `/api/query`, authLevel `function`
- [ ] `host.json` configura: logging level, timeout (30s), extensionBundle
- [ ] `local.settings.json.example` documenta env vars necessárias (AZURE_OPENAI_*, AZURE_SEARCH_*, LOG_LEVEL)
- [ ] `.gitignore` inclui `local.settings.json` (não commitar segredos)
- [ ] README em `src/functions/query/` documenta como rodar localmente

**Files to create:**
- `src/functions/query/function.json`
- `host.json`
- `local.settings.json.example`
- `src/functions/query/README.md`

---

## Testing & Documentation Tasks

### T10: Testes E2E
**Size:** M  
**Status:** 🔴 Not Started  
**Dependencies:** T08 (handler completo)  

**Description:**
Testes end-to-end que validam os Verification Criteria do requirements.md.

**Acceptance Criteria:**
- [ ] Teste E2E para VC-01 (latência): 20 queries simultâneas, mede P95 < 30s
- [ ] Teste E2E para VC-02 (rastreabilidade): 10 queries variadas, valida que 100% têm `source_document`
- [ ] Teste E2E para VC-03 (carga perigosa): 5 queries sobre "carga perigosa + devolução", valida que 0% são afirmativas
- [ ] Teste E2E para VC-04 (fallback): 3 queries fora do domínio, valida que 100% retornam fallback
- [ ] Teste E2E para VC-05 (baixa confiança): 3 queries ambíguas, valida que incluem aviso
- [ ] Teste E2E para VC-06 (contradição): 1 query que recupera PROC-042 v1 e v2, valida priorização de v2
- [ ] Testes rodam contra Azure dev environment (não prod)
- [ ] Usa fixtures de `tests/fixtures/` (queries, chunks esperados, respostas esperadas)

**Files to create:**
- `tests/e2e/query-endpoint.test.ts`
- `tests/fixtures/queries.json`
- `tests/fixtures/expected-responses.json`

---

### T11: Documentação técnica
**Size:** P  
**Status:** 🔴 Not Started  
**Dependencies:** T08 (implementação completa)  

**Description:**
Documentar o módulo para desenvolvedores futuros.

**Acceptance Criteria:**
- [ ] `src/functions/query/README.md` documenta: objetivo, como rodar localmente, env vars, exemplos de request/response
- [ ] `docs/runbooks/query-endpoint.md` documenta: troubleshooting, alertas comuns, como diagnosticar latência alta
- [ ] Diagramas de sequência (Mermaid) em `specs/query-endpoint/diagrams.md`

**Files to create:**
- `src/functions/query/README.md` (já coberto em T09, expandir)
- `docs/runbooks/query-endpoint-troubleshooting.md`
- `specs/query-endpoint/diagrams.md`

---

## Summary

| Task | Size | Status | Dependencies | Estimated Hours |
|------|------|--------|--------------|-----------------|
| T01 | M | 🟡 In Progress | None | 3h |
| T02 | P | 🔴 Not Started | T01 | 1.5h |
| T03 | M | 🔴 Not Started | T01 | 3h |
| T04 | M | 🔴 Not Started | T01, T03 | 4h |
| T05 | M | 🔴 Not Started | T01 | 3h |
| T06 | M | 🔴 Not Started | T01, T05 | 3h |
| T07 | P | 🔴 Not Started | T01 | 2h |
| T08 | M | 🔴 Not Started | T02-T07 | 4h |
| T09 | P | 🔴 Not Started | T08 | 1h |
| T10 | M | 🔴 Not Started | T08 | 4h |
| T11 | P | 🔴 Not Started | T08 | 1.5h |

**Total estimated:** ~30 hours (~4 dias de trabalho)

---

## Next Steps

1. ✅ Tasks decomposed and estimated
2. 🟡 Start with T01 (foundation) — currently in progress
3. Proceed sequentially respecting dependencies
4. Each task passes through validation gate (code review) before marking as Done
5. Update this document as tasks progress

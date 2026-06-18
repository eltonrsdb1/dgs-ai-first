# Plan — Query Endpoint

**Module:** Query Endpoint  
**Owner:** Tech Lead  
**Status:** Approved  
**Date:** 2024-01-18  
**Based on:** requirements.md (2024-01-15)

---

## Approach

Azure Function HTTP trigger que implementa o fluxo RAG (Retrieval-Augmented Generation):

1. **Recebe pergunta do atendente** via `POST /api/query`
   - Valida input com Zod
   - Extrai query, contexto opcional (histórico), metadados

2. **Converte pergunta em embedding** via Azure OpenAI
   - Usa modelo `text-embedding-ada-002`
   - Retry com exponential backoff (3 tentativas)

3. **Busca top-5 chunks** no Azure AI Search
   - Vector search com similaridade cosine
   - Filtros: `vigência` mais recente quando há duplicatas
   - Threshold de similaridade: 0.7 (abaixo disso, considerar "não encontrado")

4. **Monta prompt** respeitando context budget
   - System prompt (~4K tokens) de `/prompts/system-prompt.md`
   - Top-5 chunks (~8K tokens total, ~1.6K cada)
   - Query do usuário (~500 tokens)
   - Histórico opcional (últimos 3 turnos, ~1.5K tokens)

5. **Envia ao GPT-4o** e aguarda completion
   - Temperatura: 0.2 (priorizar consistência)
   - Max tokens: 500 (respostas concisas)
   - Stop sequences: `\n\n---` (fim de resposta)

6. **Valida resposta** com harness determinístico
   - Verifica presença de `source_document`
   - Se menciona "carga perigosa + devolução", valida que resposta é negativa
   - Se confiança < 0.7, injeta aviso

7. **Retorna JSON** estruturado
   ```json
   {
     "answer": "string",
     "source_documents": ["POL-001:3.2", "PROC-042-v2:2.1"],
     "confidence": 0.85,
     "latency_ms": 2430,
     "query_id": "uuid"
   }
   ```

---

## Technical Decisions

### TD-01: TypeScript com Azure Functions v4
**Rationale:** TypeScript oferece type safety; Azure Functions v4 é a versão LTS com melhor suporte para Node.js 20.

**Implications:**
- `tsconfig.json` com `strict: true`
- Azure Functions Core Tools v4 no CI/CD
- Deploy via Bicep (`/infra/main.bicep`)

---

### TD-02: Zod para validação de input/output
**Rationale:** Zod oferece validação em runtime com inferência de tipos TypeScript; melhor que class-validator para Azure Functions.

**Implications:**
- Schemas em `/src/functions/query/schemas.ts`
- Validação no handler antes de processar
- Erros de validação retornam 400 com detalhes

---

### TD-03: Retry com exponential backoff
**Rationale:** Azure OpenAI e Azure AI Search podem retornar 429 (rate limit) ou 503 (transient error); retry aumenta resiliência.

**Implementations:**
- Biblioteca `p-retry` (leve, bem mantida)
- Configuração: 3 tentativas, backoff 2^n * 100ms
- Timeout total: 30s (constraint C4)

---

### TD-04: Structured logging com pino
**Rationale:** `pino` é o logger mais rápido para Node.js; suporta JSON estruturado (essencial para Azure Application Insights).

**Implications:**
- **NEVER use `console.log`** — sempre `logger.info()`, `logger.error()`, etc.
- Logs incluem: `query_id`, `user_id`, `latency_ms`, `chunks_retrieved`, `confidence`
- Log level controlado por env var `LOG_LEVEL` (default: `info`)

---

### TD-05: Context budget enforcement
**Rationale:** Garantir que prompts não explodam custo ou latência.

**Implementation:**
- Helper function `enforceContextBudget()` em `/src/services/prompt-builder.ts`
- Trunca chunks se necessário (prioriza os mais relevantes, similaridade > threshold)
- Trunca histórico se necessário (mantém turnos mais recentes)

---

## Architecture

```
┌─────────────┐
│   Teams Bot │ (ou painel web)
└──────┬──────┘
       │ POST /api/query
       │ { "question": "...", "history": [...] }
       ↓
┌──────────────────────────────────────────────────┐
│  Azure Function: query-handler                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 1. Validação (Zod)                          │ │
│  │ 2. Embedding (Azure OpenAI)                 │ │
│  │ 3. Search (Azure AI Search)                 │ │
│  │ 4. Prompt building (context budget)         │ │
│  │ 5. Completion (GPT-4o)                      │ │
│  │ 6. Validation (harness)                     │ │
│  │ 7. Response (JSON)                          │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────┐
│  Logs → Azure Application Insights              │
│  Metrics → Azure Monitor                        │
└─────────────────────────────────────────────────┘
```

---

## Module Structure

```
src/functions/query/
├── handler.ts              # HTTP trigger (entrada do Azure Function)
├── schemas.ts              # Zod schemas para input/output
└── validator.ts            # Validação customizada (ex: carga perigosa)

src/services/
├── embedding.ts            # Geração de embeddings (Azure OpenAI)
├── search.ts               # Busca no Azure AI Search
├── prompt-builder.ts       # Montagem de prompt com context budget
├── completion.ts           # Chamada ao GPT-4o
└── response-validator.ts   # Harness determinístico

src/shared/
├── logger.ts               # Configuração do pino
├── retry.ts                # Wrapper de p-retry
└── types.ts                # Tipos compartilhados
```

---

## Prior Decisions (from Cenário 1)

- **ADR-0001 (LLM model):** Azure OpenAI GPT-4o — integração com Microsoft, 128K tokens
- **ADR-0002 (Context budget):** ~4K system + ~8K chunks + pergunta + histórico limitado (3 turnos)
- **ADR-0003 (Contradictory docs):** Metadado de vigência no pipeline; prompt instrui priorizar mais recente
- **ADR-0004 (RAG prototype):** Protótipo open-source validou abordagem; Azure AI Search escolhido para produção

---

## Dependencies

### External Services
- **Azure OpenAI:** Endpoint configurado, API key em Key Vault
- **Azure AI Search:** Index `novatech-docs` populado com chunks e metadados
- **Azure Application Insights:** Instrumentação configurada

### Internal Dependencies
- **Pipeline de ingestão:** Precisa ter rodado e populado o index
- **System prompt:** `/prompts/system-prompt.md` finalizado com guardrails
- **Secrets:** Configurados em Azure Key Vault ou `.env` (desenvolvimento local)

---

## Non-Functional Requirements

### Performance
- **Latency P95 < 30s** (VC-01)
- Cache de embeddings para queries frequentes (futuro)

### Reliability
- **Retry automático** para transient errors
- **Circuit breaker** (futuro) se Azure OpenAI ficar indisponível > 5min

### Security
- **API key** nunca em código ou logs
- **Input sanitization** via Zod (prevenir injection)
- **CORS** configurado apenas para domínios da NovaTech

### Observability
- **Structured logging** com query_id rastreável
- **Métricas custom** para Azure Monitor: latency, token_usage, confidence_distribution

---

## Testing Strategy

- **Unit tests:** Cada serviço isoladamente (mock de Azure SDK)
- **Integration tests:** Handler completo com Azure SDK mockado (msw)
- **E2E tests:** Contra Azure dev environment (não prod)
- **Load tests:** k6 para validar latency sob carga

---

## Deployment

- **Bicep templates** em `/infra/main.bicep`
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`)
- **Environments:** dev, staging, prod
- **Rollback:** Versão anterior mantida em slot (Azure Functions deployment slots)

---

## Success Metrics

Alinhados aos Verification Criteria do requirements.md:

- ✅ **VC-01:** P95 latency < 30s
- ✅ **VC-02:** 100% respostas com `source_document`
- ✅ **VC-03:** 0% respostas afirmativas para "carga perigosa + devolução"
- ✅ **VC-04:** 100% queries fora do domínio retornam fallback
- ✅ **VC-05:** 100% respostas com confiança < 0.7 incluem aviso
- ✅ **VC-06:** Contradições priorizadas corretamente

---

## Next Steps

1. Tech Lead aprova este plan
2. Dev cria `tasks.md` decompondo em tasks atômicas
3. Dev implementa tasks sequencialmente com code review
4. QA valida contra Verification Criteria

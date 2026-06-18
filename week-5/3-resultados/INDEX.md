# Índice de Entregáveis — Exercícios do Desenvolvedor (Cenário 2)

**Projeto:** NovaTech Assistant  
**Fase:** Estruturação do Trabalho  
**Papel:** Desenvolvedor  
**Data:** 2024-01-20

---

## Navegação Rápida

### 📋 Resumo Executivo
- **[RESUMO-EXERCICIOS-DESENVOLVEDOR.md](./RESUMO-EXERCICIOS-DESENVOLVEDOR.md)** - Visão geral completa de todos os exercícios

---

## 🔧 Exercício 2.1 — Configuração de MCP Servers

### Entregáveis principais:
1. **[dev-exercicio-2.1-mapeamento-mcp.md](./dev-exercicio-2.1-mapeamento-mcp.md)**
   - Mapeamento de necessidades → servers locais
   - Configuração de least privilege
   - Análise de riscos de segurança

2. **[novatech-assistant/.mcp/mcp.json](./novatech-assistant/.mcp/mcp.json)**
   - Configuração funcional dos 5 MCP servers
   - Syntactically correct e pronto para uso

3. **[dev-exercicio-2.1-evidencia-uso-mcp.md](./dev-exercicio-2.1-evidencia-uso-mcp.md)**
   - 5 testes demonstrando uso real dos servers
   - Leitura de docs, recuperação de chunks, identificação de contradições
   - Validação com Anexo B

### Arquivos relacionados:
- `novatech-assistant/docs/novatech/` - Documentação de negócio (Anexo A)
- `novatech-assistant/data/retrieval-corpus/` - Corpus de chunks (Anexo B)

---

## 📝 Exercício 2.2 — Implementação com SDD

### Entregáveis principais:

#### Specs (SDD)
1. **[novatech-assistant/specs/query-endpoint/requirements.md](./novatech-assistant/specs/query-endpoint/requirements.md)**
   - 4 outcomes orientados a resultado
   - Scope boundaries e constraints
   - 6 verification criteria testáveis

2. **[novatech-assistant/specs/query-endpoint/plan.md](./novatech-assistant/specs/query-endpoint/plan.md)**
   - Approach técnico (fluxo RAG)
   - 5 technical decisions
   - Arquitetura e estrutura de módulos

3. **[novatech-assistant/specs/query-endpoint/tasks.md](./novatech-assistant/specs/query-endpoint/tasks.md)**
   - 11 tasks atômicas (T01-T11)
   - Acceptance criteria, dependencies, estimativas
   - Status tracking

#### Código implementado (Task T01)
4. **[novatech-assistant/src/shared/logger.ts](./novatech-assistant/src/shared/logger.ts)**
   - Logger com pino (NEVER console.log)
   - Helpers: createLogger, logExecutionTime

5. **[novatech-assistant/src/shared/retry.ts](./novatech-assistant/src/shared/retry.ts)**
   - Retry com exponential backoff
   - Helpers: retryWithBackoff, isRetriableError, createAbortError

6. **[novatech-assistant/src/shared/types.ts](./novatech-assistant/src/shared/types.ts)**
   - Tipos TypeScript compartilhados (strict, no `any`)
   - Interfaces: QueryRequest, QueryResponse, Chunk, etc.

7. **[novatech-assistant/tests/unit/shared/retry.test.ts](./novatech-assistant/tests/unit/shared/retry.test.ts)**
   - Testes unitários completos para retry helper
   - Cobertura de casos de sucesso, falha, retry, abort

#### Revisão crítica
8. **[dev-exercicio-2.2-revisao-critica.md](./dev-exercicio-2.2-revisao-critica.md)**
   - 5 problemas reais identificados
   - Análise de severidade e impacto
   - Correções sugeridas

---

## 🎯 Exercício 2.3 — Estratégia de Skills

### Entregáveis principais:
1. **[dev-exercicio-2.3-estrategia-skills.md](./dev-exercicio-2.3-estrategia-skills.md)**
   - Árvore completa de 10 skills (Foundation → Domain → Artifact)
   - Mapeamento de criação/consumo por papel
   - Frequência de uso e priorização
   - Estratégia de manutenção

2. **[novatech-assistant/skills/foundation/typescript-conventions.md](./novatech-assistant/skills/foundation/typescript-conventions.md)**
   - SKILL Foundation mais importante
   - 7 regras DEVE, 6 regras NÃO DEVE
   - 4 anti-padrões comuns de LLMs
   - 2 exemplos completos de código
   - Checklist para code review

### Skills existentes (vazias, para referência):
- `novatech-assistant/skills/foundation/error-handling.md` (empty)
- `novatech-assistant/skills/foundation/project-structure.md` (empty)

---

## 📊 Estrutura do Projeto

```
week-5/3-resultados/
│
├── RESUMO-EXERCICIOS-DESENVOLVEDOR.md  ← Você está aqui (índice)
├── INDEX.md                             ← Este arquivo
│
├── dev-exercicio-2.1-mapeamento-mcp.md
├── dev-exercicio-2.1-evidencia-uso-mcp.md
├── dev-exercicio-2.2-revisao-critica.md
├── dev-exercicio-2.3-estrategia-skills.md
│
└── novatech-assistant/                  ← Repositório do projeto
    ├── .mcp/
    │   └── mcp.json                     ← Configuração MCP (Ex 2.1)
    │
    ├── specs/
    │   └── query-endpoint/
    │       ├── requirements.md          ← Ex 2.2
    │       ├── plan.md                  ← Ex 2.2
    │       └── tasks.md                 ← Ex 2.2
    │
    ├── src/
    │   └── shared/
    │       ├── logger.ts                ← Ex 2.2 (código)
    │       ├── retry.ts                 ← Ex 2.2 (código)
    │       └── types.ts                 ← Ex 2.2 (código)
    │
    ├── tests/
    │   └── unit/
    │       └── shared/
    │           └── retry.test.ts        ← Ex 2.2 (testes)
    │
    ├── skills/
    │   └── foundation/
    │       └── typescript-conventions.md ← Ex 2.3 (skill)
    │
    └── [outros arquivos do projeto...]
```

---

## ✅ Checklist de Avaliação

### Exercício 2.1 — MCP Servers
- [x] Mapeamento necessidade → server local (5 servers)
- [x] Least privilege concreto (escopos mínimos, read-only)
- [x] Evidência de uso real (5 testes demonstrados)
- [x] Riscos de segurança (4 riscos + mitigações)
- [x] `.mcp/mcp.json` válido e coerente

### Exercício 2.2 — SDD Implementation
- [x] Tasks atômicas (11 tasks com acceptance criteria)
- [x] Critérios de aceite verificáveis
- [x] Código segue padrões do plan (TypeScript, Zod, pino)
- [x] Código segue Anexo C (estrutura de diretórios)
- [x] Revisão crítica real (5 problemas identificados)
- [x] Conecta com cenário 1 (referências a ADRs)

### Exercício 2.3 — Skills Strategy
- [x] Árvore coerente com projeto (10 skills reais)
- [x] Criação/consumo multi-papel (não só devs)
- [x] SKILL.md Foundation concreto (exemplos reais)
- [x] Anti-padrões úteis (LLMs geram)
- [x] Referencia Anexo C (hierarquia correta)

---

## 🔗 Links Úteis

### Documentação de referência (do exercício)
- [week-5/1-pratica/exercicio-2-fase-estruturacao.md](../1-pratica/exercicio-2-fase-estruturacao.md)
- [week-5/1-pratica/anexo-a-documentacao-simulada-novatech.md](../1-pratica/anexo-a-documentacao-simulada-novatech.md)
- [week-5/1-pratica/anexo-b-chunks-referencia-rag.md](../1-pratica/anexo-b-chunks-referencia-rag.md)
- [week-5/1-pratica/anexo-c-estrutura-repositorio.md](../1-pratica/anexo-c-estrutura-repositorio.md)

### Critérios de avaliação
- [week-5/2-correcao/avaliacao-desenvolvedor.md](../2-correcao/avaliacao-desenvolvedor.md)

---

## 📈 Próximos Passos (se fosse projeto real)

1. **Imediato:**
   - [ ] Instalar dependências (`npm install pino p-retry`)
   - [ ] Atualizar `package.json` com dependências
   - [ ] Configurar `tsconfig.json` para ESM

2. **Code Review:**
   - [ ] Tech Lead revisa specs (requirements, plan, tasks)
   - [ ] Tech Lead revisa código implementado (T01)
   - [ ] Correções do Problema 1 e 2 da revisão crítica

3. **Continuação:**
   - [ ] Implementar tasks T02-T11 sequencialmente
   - [ ] Criar skills P0 restantes (error-handling, testing-patterns)
   - [ ] Validar skills com Copilot

4. **Validação:**
   - [ ] Testes unitários passam (`npm test`)
   - [ ] Testes de integração (T10)
   - [ ] Cobertura > 80%

---

## 📞 Contato

Para dúvidas sobre os entregáveis ou para revisão, contatar:
- **Papel:** Desenvolvedor
- **Exercícios:** 2.1, 2.2, 2.3 (completos)
- **Status:** Pronto para avaliação

---

**Última atualização:** 2024-01-20  
**Versão:** 1.0.0

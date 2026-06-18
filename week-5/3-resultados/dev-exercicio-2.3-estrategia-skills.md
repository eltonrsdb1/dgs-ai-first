# Exercício 2.3 — Estratégia de Skills do Projeto NovaTech Assistant

## Árvore de Skills (Foundation → Domain → Artifact)

### Hierarquia e Filosofia

A hierarquia de skills segue o princípio de **especialização progressiva**:
- **Foundation**: Convenções globais que se aplicam a TODO o código
- **Domain**: Padrões específicos por camada/tecnologia
- **Artifact**: Receitas completas para gerar artefatos específicos

**Regra de consumo**: Skills de níveis inferiores herdam e refinam skills de níveis superiores.
- Artifact skills DEVEM referenciar Domain skills relevantes
- Domain skills DEVEM referenciar Foundation skills relevantes

---

## Foundation Skills (Convenções Globais)

### 1. `typescript-conventions.md`
**Descrição:** Convenções TypeScript do projeto (strict mode, imports, naming, anti-padrões)

**Frase-ativação:** 
- "Generate TypeScript code"
- "Create a new module"
- "Write TypeScript class/function"

**Criado por:** Tech Lead  
**Consumido por:** 
- Desenvolvedores (ao escrever código)
- Copilot (ao gerar código)
- Tech Lead (ao revisar PRs)

**Frequência de uso:** MUITO ALTA (toda geração de código)

**Conteúdo-chave:**
- `strict: true` obrigatório
- NEVER usar `any` (use `unknown` e type guards)
- NEVER usar `require()` (use `import`)
- Naming conventions (camelCase para variáveis, PascalCase para classes)
- Anti-padrões: `as any`, `@ts-ignore`, `console.log`

---

### 2. `error-handling.md`
**Descrição:** Padrões de tratamento de erros (custom errors, logging, retry, fail-fast vs graceful degradation)

**Frase-ativação:**
- "Handle errors"
- "Implement error handling"
- "Add try-catch"

**Criado por:** Tech Lead  
**Consumido por:**
- Desenvolvedores
- Copilot

**Frequência de uso:** ALTA

**Conteúdo-chave:**
- Custom error classes herdam de `Error`
- SEMPRE logar erros com contexto (query_id, operation, etc.)
- Retry para transient errors (429, 503), fail-fast para auth errors (401)
- Errors no handler retornam JSON estruturado (ErrorResponse type)

---

### 3. `project-structure.md`
**Descrição:** Organização de diretórios, modules, exports (onde cada tipo de arquivo deve ficar)

**Frase-ativação:**
- "Create a new service"
- "Where should I put this file?"
- "Organize code"

**Criado por:** Tech Lead  
**Consumido por:**
- Desenvolvedores
- Copilot
- Novos membros do time

**Frequência de uso:** MÉDIA (ao criar novos módulos)

**Conteúdo-chave:**
- `/src/functions/` → Azure Functions handlers
- `/src/services/` → Business logic (reutilizável)
- `/src/shared/` → Utilities compartilhadas
- Cada módulo deve ter index.ts exportando API pública

---

## Domain Skills (Padrões por Camada)

### 4. `azure-functions-endpoint.md`
**Descrição:** Padrão para criar Azure Functions HTTP triggers (estrutura, validação, response)

**Frase-ativação:**
- "Create Azure Function"
- "Implement HTTP trigger"
- "Add API endpoint"

**Criado por:** Tech Lead  
**Consumido por:**
- Desenvolvedores
- Copilot

**Frequência de uso:** MÉDIA (um endpoint por feature)

**Conteúdo-chave:**
- Handler sempre valida input com Zod
- Handler retorna HttpResponse com status code correto
- Timeout configurado em function.json
- SEMPRE gera query_id/request_id

---

### 5. `azure-ai-search-integration.md`
**Descrição:** Padrões de integração com Azure AI Search (vector search, filters, error handling)

**Frase-ativação:**
- "Query Azure AI Search"
- "Implement vector search"
- "Search for chunks"

**Criado por:** Tech Lead / Dev Sênior  
**Consumido por:**
- Desenvolvedores
- Copilot

**Frequência de uso:** BAIXA (poucos pontos de integração)

**Conteúdo-chave:**
- Sempre usar retry para transient errors
- Filtro de vigência para documentos contraditórios
- Threshold de similaridade (0.7)

---

### 6. `react-components.md`
**Descrição:** Padrões para componentes React do painel web (estrutura, props, styling)

**Frase-ativação:**
- "Create React component"
- "Implement UI component"

**Criado por:** Dev Front-end / Product Specialist  
**Consumido por:**
- Desenvolvedores Front-end
- Copilot

**Frequência de uso:** MÉDIA (vários componentes no painel web)

**Conteúdo-chave:**
- Functional components com TypeScript
- Props interface exportada
- Styling com CSS modules
- Accessibility (ARIA labels)

---

### 7. `testing-patterns.md`
**Descrição:** Padrões de testes (Vitest, mocks, fixtures, arrange/act/assert)

**Frase-ativação:**
- "Write test"
- "Create unit test"
- "Test this function"

**Criado por:** QA / Tech Lead  
**Consumido por:**
- Desenvolvedores
- QA
- Copilot

**Frequência de uso:** MUITO ALTA (teste para cada módulo)

**Conteúdo-chave:**
- Naming: `describe('ModuleName')` / `it('should behavior when condition')`
- Mock externo (Azure SDK) com msw
- Fixtures em `/tests/fixtures/`
- Arrange/Act/Assert explícito

---

## Artifact Skills (Receitas de Geração)

### 8. `create-rag-endpoint.md`
**Descrição:** Receita completa para criar endpoint RAG (embedding → search → completion → validation)

**Frase-ativação:**
- "Create RAG endpoint"
- "Implement query endpoint"
- "New RAG API"

**Criado por:** Tech Lead + Dev Sênior  
**Consumido por:**
- Desenvolvedores
- Copilot

**Frequência de uso:** BAIXA (poucos endpoints RAG no projeto)

**Conteúdo-chave:**
- Template completo: handler + services + schemas + tests
- Referencia: azure-functions-endpoint, azure-ai-search-integration, testing-patterns
- Checklist de implementation

---

### 9. `create-integration-test.md`
**Descrição:** Receita para criar teste de integração (mock de Azure SDK, fixtures, assertions)

**Frase-ativação:**
- "Create integration test"
- "Test the complete flow"
- "Integration test for endpoint"

**Criado por:** QA  
**Consumido por:**
- Desenvolvedores
- QA
- Copilot

**Frequência de uso:** ALTA (teste de integração para cada endpoint)

**Conteúdo-chave:**
- Template de teste de integração
- Mock com msw (não chamadas reais a Azure)
- Fixtures do Anexo B (chunks)
- Anti-padrões: testes que dependem de ordem, testes que chamam APIs reais

---

### 10. `create-react-card.md`
**Descrição:** Receita para criar card React para exibir resposta do assistente

**Frase-ativação:**
- "Create response card"
- "Display answer in UI"
- "React card component"

**Criado por:** Dev Front-end  
**Consumido por:**
- Desenvolvedores Front-end
- Copilot

**Frequência de uso:** MÉDIA

**Conteúdo-chave:**
- Template de Card component
- Props: answer, sources, confidence
- Handling de low confidence (aviso visual)
- Acessibilidade

---

## Mapeamento de Criação/Consumo

| Skill | Criado por | Consumido por | Frequência | Prioridade |
|-------|-----------|---------------|------------|------------|
| 1. typescript-conventions | Tech Lead | Devs, Copilot, TL | Muito Alta | P0 |
| 2. error-handling | Tech Lead | Devs, Copilot | Alta | P0 |
| 3. project-structure | Tech Lead | Devs, Copilot, Novos | Média | P1 |
| 4. azure-functions-endpoint | Tech Lead | Devs, Copilot | Média | P0 |
| 5. azure-ai-search-integration | Tech Lead, Dev Sênior | Devs, Copilot | Baixa | P1 |
| 6. react-components | Dev Front-end, PS | Devs FE, Copilot | Média | P1 |
| 7. testing-patterns | QA, Tech Lead | Devs, QA, Copilot | Muito Alta | P0 |
| 8. create-rag-endpoint | Tech Lead, Dev Sênior | Devs, Copilot | Baixa | P2 |
| 9. create-integration-test | QA | Devs, QA, Copilot | Alta | P0 |
| 10. create-react-card | Dev Front-end | Devs FE, Copilot | Média | P2 |

### Priorização
- **P0 (Crítico):** Skills que serão usadas imediatamente e constantemente
- **P1 (Alto):** Skills importantes mas não blockers para início do desenvolvimento
- **P2 (Médio):** Skills úteis mas podem ser criadas sob demanda

---

## Visão Multi-Papel

### Perspectiva do Desenvolvedor
**Usa skills para:**
- Gerar código consistente com padrões do projeto
- Evitar anti-padrões comuns
- Acelerar criação de boilerplate (endpoints, testes)

**Contribui criando:**
- Domain skills específicas de tecnologias que domina
- Artifact skills para padrões que identificou como repetitivos

---

### Perspectiva do Tech Lead
**Usa skills para:**
- Codificar decisões arquiteturais (ADRs → Skills)
- Garantir consistência entre contribuições de diferentes devs
- Fazer code review (checar conformidade com skills)

**Contribui criando:**
- Foundation skills (base para todo o projeto)
- Domain skills de arquitetura (Azure Functions, integrações)

---

### Perspectiva do QA
**Usa skills para:**
- Gerar testes consistentes com padrões do projeto
- Validar que código gerado é testável

**Contribui criando:**
- Skill de testing-patterns (como escrever bons testes)
- Artifact skills para tipos específicos de teste

---

### Perspectiva do Product Specialist
**Usa skills para:**
- Entender como specs são transformadas em código
- Validar que requirements foram traduzidos corretamente

**Contribui criando:**
- Skills de domínio de negócio (linguagem ubíqua, regras de produto)
- Skills para componentes UI (React cards, formulários)

---

## Estratégia de Manutenção

### Versionamento
Skills seguem versionamento semântico no próprio arquivo:
```markdown
# SKILL: TypeScript Conventions
**Version:** 1.2.0
**Last updated:** 2024-01-20
**Changelog:** Added rule about avoiding default exports
```

### Atualização
Quando atualizar uma skill:
1. Incrementar versão
2. Documentar mudança no Changelog
3. Comunicar ao time (Slack/Teams)
4. Validar que código existente não quebra (se breaking change)

### Validação
Cada skill deve ser testada:
- Gerar código usando a skill com Copilot
- Verificar se output segue os padrões
- Iterar skill se Copilot não seguir

---

## Próximos Passos

1. ✅ Criar skill Foundation mais crítica: **typescript-conventions.md**
2. Criar skills P0 restantes: error-handling, testing-patterns
3. Validar skills com Copilot (gerar código e revisar)
4. Comunicar estratégia ao time
5. Criar skills P1 sob demanda conforme necessidade

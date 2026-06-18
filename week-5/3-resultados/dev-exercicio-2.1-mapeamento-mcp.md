# Exercício 2.1 — Mapeamento e Configuração de MCP Servers

## Mapeamento de Necessidades → MCP Servers Locais

### 1. **filesystem server** — Acesso a código, specs e skills
**Necessidades cobertas:**
- Ler e escrever código fonte (`/src`)
- Ler e escrever specs SDD (`/specs`)
- Ler e escrever skills (`/skills`)
- Ler documentação técnica (`/docs/adr`, `/docs/runbooks`)
- **READ-ONLY**: Documentação de negócio da NovaTech (`/docs/novatech`)
- **READ-ONLY**: Corpus de retrieval (`/data/retrieval-corpus`)

**Tools expostas:** read_file, write_file, list_directory, search_files, get_file_info
**Resources expostas:** Acesso direto a arquivos como resources

**Escopo e Least Privilege:**
- **Read/Write**: `./src`, `./specs`, `./skills`, `./docs/adr`, `./docs/runbooks`, `./prompts`, `./tests`, `./infra`
- **Read-Only**: `./docs/novatech`, `./data/retrieval-corpus`
- **Excluído**: `.git`, `node_modules`, `.env*`, `*.key`, `*.pem` (para não expor segredos)

**Justificativa:**
- Sources de negócio (docs/novatech) e corpus devem ser read-only para evitar que agente altere inadvertidamente dados de referência
- Escopo mínimo exclui arquivos de configuração sensível (.env) e dependências (node_modules)
- Permite que agente gere código, specs e skills, mas não mexa em infraestrutura crítica

---

### 2. **git server** — Histórico e branches do repositório
**Necessidades cobertas:**
- Ler histórico de commits
- Ver diffs entre branches
- Entender evolução do código
- Rastrear quando decisões foram tomadas

**Tools expostas:** git_log, git_diff, git_show, git_status, git_branch
**Resources expostas:** Commits, branches como resources navegáveis

**Escopo:** Repositório local `.git`

**Justificativa:**
- Read-only por natureza (git server não faz commits)
- Essencial para contexto histórico de decisões
- Permite que agente entenda "por que isso foi feito assim"

---

### 3. **memory server** — Grafo persistente de decisões e linguagem ubíqua
**Necessidades cobertas:**
- Armazenar linguagem ubíqua do domínio (glossário)
- Registrar decisões técnicas e de produto
- Manter grafo de relacionamentos (ex: "PROC-042-v2 supersedes PROC-042-v1")
- Memória persistente entre sessões de desenvolvimento

**Tools expostas:** create_memory, search_memories, relate_entities
**Resources expostas:** Entities (termos, decisões, documentos) como resources

**Escopo:** Grafo local de memória

**Justificativa:**
- Complementa ADRs com relações dinâmicas
- Permite que agente aprenda padrões do domínio
- Essencial para contexto de contradições documentais (ADR-0003)

---

### 4. **everything server** (opcional, para aprendizado)
**Necessidades cobertas:**
- Entender primitivas de MCP (tools, resources, prompts)
- Experimentar com exemplos

**Justificativa:**
- Útil para desenvolvedores aprenderem MCP
- Não expõe dados reais do projeto
- Pode ser removido em produção

---

## Riscos de Segurança e Mitigações

### Risco 1: Exposição de segredos
**Cenário:** filesystem server com escopo amplo (`./`) permite agente ler `.env`, `.env.local`, arquivos `.pem`, tokens em configs.

**Impacto:** Vazamento de credentials do Azure (Azure OpenAI API keys, Azure AI Search keys, connection strings).

**Mitigação:**
- Escopo explicitamente exclui `.env*`, `*.key`, `*.pem`
- Usar variáveis de ambiente (não arquivos) para segredos
- Validar que `.gitignore` cobre todos os padrões de segredo

---

### Risco 2: Alteração não revisada de código
**Cenário:** filesystem server com escrita habilitada permite agente alterar arquivos críticos sem gate de revisão humana.

**Impacto:** Bug introduzido diretamente em produção; código gerado sem code review.

**Mitigação:**
- Workflow com validation gates (do exercício DM 2.1): código gerado por agente passa por code review obrigatório antes de merge
- Branch strategy: agente gera em feature branch, humano revisa PR
- Considerar modo "suggest-only" para arquivos críticos (infra, configs)

---

### Risco 3: Modificação de documentação de negócio
**Cenário:** Se `docs/novatech/` tiver escrita habilitada, agente pode alterar documentos oficiais da NovaTech.

**Impacto:** Fonte de verdade corrompida; respostas do assistente baseadas em docs alterados incorretamente.

**Mitigação:**
- **Configurado como read-only no filesystem server**
- Documentos de negócio gerenciados fora do repo (SharePoint, Confluence) e sincronizados read-only
- Pipeline de ingestão valida checksums dos documentos

---

### Risco 4: Acesso a node_modules ou build artifacts
**Cenário:** filesystem server com escopo amplo permite agente ler/escrever em `node_modules/`, `dist/`, `.next/`.

**Impacto:** Poluição de contexto (agente lê código de dependências, não do projeto); risco de alterar builds.

**Mitigação:**
- Escopo exclui `node_modules`, `dist`, `.next`, `build`
- Alinhado com `.gitignore` (o que não vai pro git, não vai pro MCP)

---

## Configuração Implementada

Ver arquivo `.mcp/mcp.json` gerado.

# Exercício 1.1 — Análise de Viabilidade Técnica com Fundamentos de LLM e Engenharia de Contexto

> **Papel:** Desenvolvedor  
> **Projeto:** Assistente de IA — NovaTech (DB1 Global Software)  
> **Data:** 2026-06-04  
> **Ferramentas utilizadas:** Claude (chat)

---

## Histórico de Iteração

Este documento contém duas versões:
- **V1** — Análise inicial produzida antes da revisão pelo Claude
- **V2** — Análise refinada após incorporar o feedback do Claude (marcado em seção própria)

---

# VERSÃO 1 — Análise Inicial

## 1. Desafios por Tipo de Fonte

### 1.1. PDFs com tabelas complexas (SharePoint)

**Desafio para o pipeline de RAG:**  
Tabelas com 15+ colunas (como as tabelas de frete) perdem estrutura quando extraídas por parsers PDF padrão (PyPDF2, pdfminer). O resultado é um fluxo linear de texto onde `Sul | 1.2 | 500kg | R$ 400` vira uma sequência sem semântica. O modelo recebe dados sem entender que são colunas de uma mesma tabela.

**Impacto na qualidade das respostas:**  
O assistente pode confundir multiplicadores de regiões diferentes, combinar valores de linhas distintas ou retornar dados sem contexto suficiente para o atendente aplicar corretamente. Ex.: para "frete para 600kg para Manaus", o modelo pode recuperar o multiplicador da Região Sul em vez do Norte.

**Estratégia de tratamento:**
- Usar extratores com reconhecimento de estrutura tabular: `camelot` ou `tabula-py` para PDFs nativos
- Serializar tabelas em formato estruturado legível: `Região: Norte | Multiplicador: 1.8 | Aplicável: frete especial acima 500kg`
- Tratar cada tabela como chunk independente com cabeçalho repetido como contexto
- Manter rastreabilidade: chunk vinculado ao documento-fonte, seção e número da tabela

---

### 1.2. PDFs escaneados (OCR necessário)

**Desafio para o pipeline de RAG:**  
Documentos escaneados (~15% da base) não possuem camada de texto — são imagens. Parsers padrão retornam string vazia ou lixo de caracteres. Mesmo após OCR (Tesseract, Azure Document Intelligence), a qualidade depende da resolução da digitalização e do alinhamento do papel. Tabelas escaneadas têm taxa de erro consideravelmente maior que texto corrido.

**Impacto na qualidade das respostas:**  
Um multiplicador `1.4` pode ser lido como `1,4` (com vírgula) ou `14` ou `l.4` dependendo da qualidade do scan. Um procedimento com passos numerados pode ter a numeração corrompida. O assistente receberá texto com erros silenciosos — responderá com confiança, mas com dados incorretos.

**Estratégia de tratamento:**
- Etapa de classificação: identificar automaticamente PDFs escaneados (ausência de camada de texto) antes do pipeline
- Usar Azure Document Intelligence (disponível no stack NovaTech) — superior ao Tesseract para documentos empresariais com tabelas
- Implementar score de confiança de OCR por chunk; chunks com confiança < 80% devem ser sinalizados com metadado `"confianca_ocr": "baixa"`
- Revisão humana obrigatória para documentos críticos escaneados antes de indexação
- Na resposta do assistente: citar "documento pode conter imprecisão de digitalização" quando a fonte for OCR

---

### 1.3. Wiki Confluence com links internos e macros

**Desafio para o pipeline de RAG:**  
Páginas wiki têm conteúdo dinâmico: macros que expandem conteúdo de outras páginas, links internos (`[[ver PROC-042]]`) que não são seguidos no crawl, e formatação que depende do render do Confluence (tabelas em wiki markup que se tornam texto plano ao exportar). Além disso, a wiki tem ciclo de atualização semanal — o índice vetorial pode ficar defasado.

**Impacto na qualidade das respostas:**  
O assistente pode responder com base em página incompleta (macro não expandida) ou referência circular (página A aponta para página B que está desatualizada). Links internos quebrados fazem o contexto parecer completo mas estarem faltando informações críticas.

**Estratégia de tratamento:**
- Usar a API do Confluence para exportação (não scraping HTML), que retorna conteúdo com macros já expandidas
- Mapear e resolver links internos: ao indexar a página A que referencia a página B, incluir o ID da página B nos metadados do chunk de A
- Pipeline de re-indexação semanal sincronizado com ciclo de atualização da wiki
- Separar chunks por seção de página (cada `h2`/`h3` vira um chunk), não por página inteira

---

### 1.4. Planilhas com fórmulas interdependentes (XLSX)

**Desafio para o pipeline de RAG:**  
Planilhas de referência têm dois tipos de conteúdo: dados (os valores que o atendente precisa) e fórmulas (como esses valores são calculados). No contexto do assistente, só os dados importam — mas ao exportar uma planilha para texto, as fórmulas aparecem como `=B2*C4`, que é inútil sem contexto. Planilhas também dependem de outras abas (`=VLOOKUP(A1,Tabela2!A:B,2,0)`), criando dependências não óbvias.

**Impacto na qualidade das respostas:**  
O assistente pode receber células com resultados calculados corretos mas sem entender a regra de negócio por trás. Pior: se a planilha for exportada com fórmulas em vez de valores, o assistente verá `=VLOOKUP(...)` onde deveria ver `1.8`.

**Estratégia de tratamento:**
- Exportar planilhas com fórmulas calculadas (valores, não fórmulas): usar `openpyxl` com `data_only=True`
- Serializar como CSV com cabeçalhos repetidos por linha: `Região: Norte; Multiplicador: 1.8; Vigência: nov/2023`
- Incluir metadados de vigência no chunk: as planilhas são atualizadas mensalmente — o chunk precisa carregar a data de referência
- Criar índice de "última versão" para evitar que versões antigas de planilhas coexistam no vector store

---

## 2. Estimativa de Tamanho da Base em Tokens

**Regra prática:** 1 token ≈ 0,75 palavras → portanto: palavras ÷ 0,75 = tokens

### 2.1. PDFs (SharePoint)

- Quantidade: ~800 documentos
- Média de páginas: 10 páginas/documento
- Densidade média de texto: ~700 palavras/página (documentos de logística com procedimentos, tabelas e regulatório são densos)
  - Documentos nativos (85% da base): 750 palavras/página
  - Documentos escaneados (~15%): ~450 palavras/página após OCR (perda de qualidade)
- Cálculo:
  - Nativos: 800 × 0,85 × 10 × 750 = 5.100.000 palavras
  - Escaneados: 800 × 0,15 × 10 × 450 = 540.000 palavras
  - **Total PDFs: ~5.640.000 palavras → ÷ 0,75 = ~7,5M tokens**

### 2.2. Wiki Confluence

- Quantidade: ~400 páginas
- Média: 1.500 palavras/página (dado fornecido)
- Cálculo: 400 × 1.500 = 600.000 palavras → **÷ 0,75 = ~800K tokens**

### 2.3. Planilhas (XLSX)

- Quantidade: ~50 planilhas
- Estimativa: tabelas de frete têm ~200 linhas × 10 colunas; serializado com cabeçalhos = ~15.000 palavras/planilha
- Cálculo: 50 × 15.000 = 750.000 palavras → **÷ 0,75 = ~1M tokens**

### 2.4. Total estimado

| Fonte | Palavras | Tokens |
|-------|----------|--------|
| PDFs (nativos) | ~5.100.000 | ~6,8M |
| PDFs (escaneados/OCR) | ~540.000 | ~720K |
| Wiki Confluence | ~600.000 | ~800K |
| Planilhas XLSX | ~750.000 | ~1,0M |
| **Total** | **~6.990.000** | **~9,3M tokens** |

**Conclusão:** Base estimada em **~9,3 milhões de tokens**. Este volume descarta a possibilidade de carregar toda a documentação no contexto de uma query — torna RAG não uma escolha de design, mas uma necessidade técnica.

---

## 3. Análise de Orçamento de Contexto

### 3.1. Janela de contexto disponível

- Janela total do GPT-4o: **128.000 tokens**
- System prompt + instruções do assistente: **~2.000 tokens** (identidade, guardrails, formato)
- Pergunta do atendente + histórico da conversa: **~1.000 tokens** (estimativa média)
- Metadados do cliente (tier, histórico recente): **~500 tokens**
- **Espaço útil para chunks: ≈ 124.500 tokens**

### 3.2. Capacidade teórica vs. prática

**Capacidade teórica (chunks de 500 tokens):**
- 124.500 ÷ 500 = **~249 chunks**

**Capacidade prática recomendada:**
- **5 a 10 chunks por query**

**Por que não usar os 249 chunks possíveis?**

1. **Lost in the middle:** Pesquisa empírica (Liu et al., 2023) demonstra que LLMs têm desempenho significativamente pior ao recuperar informação posicionada no meio de contextos longos. Em um prompt com 100 chunks, os chunks nas posições 20 a 80 são efetivamente "esquecidos". Para o caso NovaTech — onde uma resposta precisa citar o valor correto de um multiplicador regional — este efeito é crítico.

2. **Ruído degrada precisão:** Mais chunks = mais conteúdo irrelevante competindo por atenção. Se o atendente pergunta sobre frete para o Norte e o contexto tem chunks de devolução, SLA e FAQ, o modelo pode misturar informações.

3. **Custo por query:** 249 chunks × 500 tokens = 124.500 tokens de entrada por query. Com 320 chamados/dia e 60% consultando documentação = 192 queries/dia × 124.500 tokens ≈ 23,9M tokens/dia. Custo inviável operacionalmente.

4. **Latência:** Contextos muito grandes aumentam o tempo de resposta — para um atendente que precisa de resposta em segundos, isso é inaceitável.

### 3.3. Estratégia recomendada

- **7 chunks por query** como configuração padrão (5 de alta similaridade + 2 de contexto/fallback)
- **Posicionamento deliberado:** chunk mais relevante no início, segundo mais relevante no fim (flanqueamento para mitigar lost in the middle)
- **Orçamento real por query:** 2K (system) + 1K (pergunta+histórico) + 3.500 (7 chunks × 500) = **~6.500 tokens por query**
- Headroom de segurança para histórico de conversa crescente sem degradação

---

## 4. Estratégia de Chunking Recomendada

### 4.1. Por que não usar chunking fixo de 512 tokens?

O chunking fixo por contagem de tokens é o padrão mais simples, mas é o mais inadequado para a NovaTech:

- Uma tabela de multiplicadores regionais com 5 regiões pode ser cortada ao meio — o chunk termina antes da Região Norte e a informação mais crítica some
- Um procedimento com 8 passos pode ser dividido no passo 4, gerando um chunk sem começo e outro sem fim
- Seções de exceção (como a seção 3.2 do POL-001 — "cargas perigosas não são elegíveis") podem ser mescladas com a seção 3.1 (prazo geral), confundindo o modelo sobre qual regra se aplica a qual situação

### 4.2. Abordagem recomendada: Chunking por seção semântica

**Princípio:** a unidade de chunk deve corresponder à unidade de resposta — o menor trecho que responde uma pergunta completa.

| Tipo de documento | Estratégia | Tamanho típico | Overlap |
|-------------------|------------|----------------|---------|
| PDFs com seções (h1/h2/h3) | Chunk por subseção | 300–700 tokens | 10–15% (repetir cabeçalho da seção no início do próximo chunk) |
| Tabelas | Cada tabela = 1 chunk com título + todos os dados | 100–500 tokens | Cabeçalho repetido em todo chunk de tabela longa |
| PDFs escaneados | Chunking por parágrafo (não por seção — estrutura degradada) | 200–400 tokens | 20% (OCR tem mais erros nas bordas) |
| Wiki Confluence | Chunk por seção de página | 400–600 tokens | Título da página como prefixo de cada chunk |
| Planilhas | 1 chunk por "view lógica" (ex: uma tabela de multiplicadores) | 100–300 tokens | Cabeçalho de colunas repetido |

### 4.3. Alinhamento com tipo de pergunta

O atendente da NovaTech fará principalmente dois tipos de pergunta:

**Pergunta factual pontual:** "Qual o multiplicador para o Norte?" → precisa de 1 chunk preciso. Chunking por seção garante que a tabela completa de multiplicadores esteja em 1 chunk.

**Pergunta multi-domínio:** "Posso devolver carga perigosa com frete especial?" → cruza POL-001 (devolução), PROC-042 (frete), SLA (nenhum relevante). Chunking por seção permite recuperar 2-3 chunks de documentos distintos sem misturá-los prematuramente.

**Pergunta sobre exceção:** "Quanto é o prazo para carga perigosa?" → a resposta está em uma subseção de exceção (3.2), não na regra geral (3.1). Se ambas forem um chunk só, o modelo pode priorizar a regra geral.

---

# INTERAÇÃO COM CLAUDE — Revisão da Análise V1

> **Prompt enviado ao Claude:**
> 
> *"Revisei este documento técnico sobre viabilidade do pipeline de RAG para a NovaTech. Por favor, atue como revisor técnico crítico: identifique pontos fracos, estimativas otimistas demais, riscos que não considerei, e qualquer análise que possa ser mais profunda ou mais precisa. Seja direto e não poupe críticas."*
>
> *[documento colado aqui]*

---

**Feedback do Claude (resposta resumida e adaptada):**

**Ponto fraco 1 — Versões conflitantes de documentos não endereçadas:**
"A análise de tipos de fonte não menciona o que acontece quando dois documentos cobrem o mesmo tema com dados diferentes (ex: PROC-042 v1 e v2 com multiplicadores distintos). O pipeline pode indexar ambos e o modelo pode misturar valores das duas versões na mesma resposta. Isso não é um problema de extração — é um problema de governança de dados que precisa de estratégia explícita antes da indexação."

**Ponto fraco 2 — Estimativa de tokens de planilhas pode ser conservadora:**
"Planilhas de frete com 15+ colunas e múltiplas abas (uma por mês, histórico de 2 anos) podem ter muito mais do que 15.000 palavras serializadas. Se existirem 24 abas (2 anos × 12 meses) por planilha, a estimativa multiplicaria por ~24x. A análise assume uma aba por planilha sem justificar."

**Ponto fraco 3 — Lost in the middle está subestimado:**
"A análise menciona o efeito mas não traduz em implicação prática para o retrieval. Mesmo com 7 chunks, se 2 deles forem posicionados no meio e forem os mais relevantes, o modelo ainda sofrerá o efeito. A estratégia de flanqueamento foi mencionada mas não formalizada como regra de posicionamento obrigatória."

**Ponto fraco 4 — Context rot em conversas multi-turno não mencionado:**
"O assistente será integrado ao Teams. Uma sessão no Teams pode ter 5, 10, 15 perguntas seguidas do mesmo atendente sobre o mesmo chamado. Cada nova pergunta acumula histórico. Sem estratégia de compressão ou truncamento de histórico, a segunda metade da conversa terá um orçamento de contexto drasticamente menor que a primeira."

**Ponto fraco 5 — Falta análise de documentos sem cobertura:**
"A análise foca nos documentos que existem. Mas o exercício menciona perguntas como frete padrão (< 500kg) que não têm documento na base. A análise deveria endereçar o comportamento esperado quando nenhum chunk relevante é recuperado — o modelo vai alucinar uma resposta ou dizer 'não encontrei'?"

---

# VERSÃO 2 — Análise Refinada (pós-revisão Claude)

## Seção 2-A (nova): Documentos Contraditórios — Risco de Contaminação Cross-Version

*[Seção adicionada após feedback do Claude — ponto fraco 1]*

O pipeline indexará dois documentos com o mesmo código (PROC-042 v1 e PROC-042-v2) que possuem dados contraditórios:

| Campo | PROC-042 v1 | PROC-042-v2 | Δ |
|-------|-------------|-------------|---|
| Multiplicador Norte | 1.6 | 1.8 | +12,5% |
| Multiplicador Sul | 1.2 | 1.3 | +8,3% |
| Fator de peso 1.001-3.000kg | 1.2 | 1.15 | -4,2% |
| Prazo adicional | +2 dias | +3 dias | +1 dia |

**Risco:** Se ambos os chunks forem recuperados na mesma query, o modelo pode gerar uma resposta sintetizada que mistura valores das duas versões — com alta confiança aparente, sem sinalizar contradição.

**Estratégia de mitigação:**
1. **Metadado de vigência obrigatório:** cada chunk carrega `{"vigencia": "ativa" | "historica", "data_emissao": "YYYY-MM-DD"}`
2. **Instruction no system prompt:** "Quando houver chunks de versões diferentes do mesmo documento, use sempre a versão mais recente (maior data de emissão). Sinalize ao atendente que existe uma versão anterior."
3. **Deduplicação no pipeline de ingestão:** documentos com mesmo código de procedimento têm versão anterior marcada como `"vigencia": "historica"` automaticamente. Chunks históricos só são recuperados se explicitamente necessários (ex: pergunta sobre chamados pré-dez/2023).
4. **Curadoria prévia:** antes do go-live, levantar todos os pares de documentos contraditórios com a NovaTech e definir qual é o vigente. Não delegar esse julgamento ao modelo.

---

## Seção 2-B (revisada): Estimativa de Tokens — Planilhas Corrigida

*[Estimativa corrigida após feedback do Claude — ponto fraco 2]*

A estimativa inicial assumiu 1 aba por planilha. Revisando para contexto real:

- Planilhas de tabela de fretes têm histórico mensal (uma aba por mês)
- Estimativa conservadora: 6 abas relevantes por planilha (últimos 6 meses)
- Dados por aba: ~200 combinações de origem/destino × 10 colunas × 4 palavras/célula = ~8.000 palavras/aba
- **Revisado:** 50 planilhas × 6 abas × 8.000 = 2.400.000 palavras → ÷ 0,75 = **~3,2M tokens**

**Total revisado da base:**

| Fonte | Tokens (V1) | Tokens (V2 revisado) |
|-------|-------------|----------------------|
| PDFs | ~7,5M | ~7,5M (inalterado) |
| Wiki | ~800K | ~800K (inalterado) |
| Planilhas | ~1,0M | ~3,2M (corrigido) |
| **Total** | **~9,3M** | **~11,5M tokens** |

Revisão alinha a estimativa com o range esperado. **Base estimada final: ~11,5 milhões de tokens.**

---

## Seção 3-A (nova): Context Rot em Conversas Multi-Turno no Teams

*[Seção adicionada após feedback do Claude — ponto fraco 4]*

O assistente operará dentro do Microsoft Teams, onde atendentes abrem uma sessão por chamado. Uma sessão típica pode ter:
- Atendente + cliente: 5-15 mensagens
- 3-5 consultas ao assistente dentro da mesma conversa

**Problema:** Cada nova pergunta ao assistente no Teams pode incluir o histórico da conversa anterior. Numa conversa com 10 perguntas anteriores:
- Histórico acumulado: ~10 perguntas × 1.500 tokens/turno = **~15.000 tokens só de histórico**
- Orçamento remanescente para chunks: 124.500 - 15.000 = **109.500 tokens** (ainda suficiente, mas crescente)
- Em 20 turnos: 30.000 tokens de histórico → 94.500 para chunks

**Risco prático:** Na 15ª pergunta da sessão, a resposta à 1ª pergunta (que pode conter o contexto original do chamado) está tão longe no histórico que o modelo pode ignorá-la ao responder — respondendo com informação genérica em vez de contextualizada ao chamado específico.

**Estratégia de mitigação:**
1. **Janela deslizante de histórico:** manter apenas os últimos 3 turnos no contexto (não toda a sessão)
2. **Resumo comprimido:** a cada 5 perguntas, comprimir o histórico anterior em um bloco de ~500 tokens ("Resumo da conversa: atendente está resolvendo chamado sobre devolução de carga perigosa para cliente Gold")
3. **Contexto do chamado como metadado estático:** inserir dados do chamado atual (número, tipo, cliente) uma vez no system prompt, não no histórico

---

## Seção 4-A (nova): Comportamento para Gaps de Cobertura

*[Seção adicionada após feedback do Claude — ponto fraco 5]*

A análise dos documentos revela gaps de cobertura que o assistente inevitavelmente encontrará:

| Pergunta | Cobertura na base | Risco |
|----------|-------------------|-------|
| "Frete para 300kg para Salvador?" | Nenhuma (frete padrão < 500kg não documentado) | Alucinação baseada em documentos de frete especial |
| "Como funciona o seguro de carga?" | Apenas FAQ informal (não validado) | Resposta com dados não confiáveis |
| "O que acontece com carga danificada?" | Apenas FAQ-38 (não há POL formal) | Resposta baseada em prática informal |
| "Processo Gestão de Riscos para carga perigosa?" | Apenas menção do ramal 4500 (sem PROC) | Resposta inventada |

**Estratégia obrigatória para gaps:**
- O system prompt deve instruir explicitamente: "Se nenhum chunk recuperado contiver informação suficiente para responder a pergunta, responda: 'Não encontrei documentação sobre este tema na base da NovaTech. Recomendo escalar para o supervisor ou consultar diretamente [setor relevante].' Nunca complete lacunas com suposições."
- Implementar threshold de similaridade mínima no retrieval: se o score de similaridade de todos os chunks for < 0.7, não enviar chunks ao modelo e acionar resposta padrão de "não encontrado"
- **Roadmap de documentação:** levantar os gaps com a NovaTech como entrega do discovery. Documentos ausentes são tão importantes quanto os existentes.

---

## Resumo Executivo (V2)

| Dimensão | Avaliação | Risco |
|----------|-----------|-------|
| Viabilidade técnica do RAG | **Viável** — volume (11,5M tokens) confirma necessidade de RAG, não é excessivo para o pipeline | Médio — qualidade da extração de tabelas e OCR determinará 40% do sucesso |
| Documentos contraditórios | **Risco alto** — PROC-042 v1 vs v2 é o caso mais crítico, mas não será o único | Alto — sem curadoria prévia, o modelo responderá com dados errados com alta confiança |
| Orçamento de contexto | **Gerenciável** — 7 chunks de 500 tokens = ~6.500 tokens por query, bem dentro do limite | Baixo para queries simples; Médio para conversas longas no Teams |
| Gaps de cobertura | **Crítico para qualidade percebida** — frete padrão, seguro e carga danificada não têm documentação formal | Alto — atendentes frequentemente perguntarão sobre esses temas |
| Lost in the middle | **Endereçável** com posicionamento deliberado de chunks | Médio — requer validação empírica na fase de testes |

**Recomendação final:** O projeto é tecnicamente viável, mas o sucesso depende mais de engenharia de dados (curadoria, deduplicação, cobertura de gaps) do que de escolha de modelo ou técnica de embedding. A fase de discovery deve mapear todos os documentos contraditórios e gaps antes de qualquer desenvolvimento.

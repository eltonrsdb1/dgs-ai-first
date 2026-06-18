# Requirements — Query Endpoint

**Module:** Query Endpoint  
**Owner:** Product Specialist  
**Status:** Approved  
**Date:** 2024-01-15  
**Related ADRs:** ADR-0001 (LLM model), ADR-0002 (Context budget), ADR-0003 (Contradictory docs)

---

## Outcomes

### O1: Resposta rápida e relevante
O atendente recebe uma resposta relevante à sua pergunta em menos de 30 segundos, permitindo que continue a conversa com o cliente sem interrupção significativa.

**Success Metric:** 95% das queries respondidas em < 30s (medido no P95 da latência).

---

### O2: Rastreabilidade de fonte
Toda resposta cita ao menos uma fonte documental, permitindo que o atendente valide a informação ou aprofunde se necessário.

**Success Metric:** 100% das respostas incluem campo `source_document` com identificador do documento e seção.

---

### O3: Transparência em baixa confiança
Quando a confiança do modelo é baixa (< 0.7), a resposta inclui aviso explícito ao atendente de que a informação pode não ser precisa, sugerindo escalação.

**Success Metric:** 100% das respostas com confiança < 0.7 incluem aviso de baixa confiança.

---

### O4: Proteção contra informação perigosa
Cargas perigosas (classes 1-6 ANTT) nunca recebem informação de devolução pelo processo padrão, evitando risco operacional e legal.

**Success Metric:** 0% de respostas afirmando que carga perigosa pode ser devolvida pelo processo padrão.

---

## Scope Boundaries

### In Scope (Bounded Context: "Atendimento ao Cliente")
- Responder perguntas sobre SLAs (prazos de resposta e resolução por tier de cliente)
- Responder perguntas sobre regras de frete (multiplicadores, frete especial, cálculo)
- Responder perguntas sobre política de devolução (prazos, exceções, custos)
- Responder perguntas que cruzam duas categorias (ex: "frete especial para devolução")
- Identificar e informar quando há versões conflitantes de documentos (PROC-042 v1 vs v2)

### Out of Scope
- Consultar status de carga específica (requer integração com sistema de tracking — não nesta release)
- Processar devolução (apenas informar regras — processamento é no Portal do Cliente)
- Alterar ou criar regras de negócio (assistente é read-only sobre políticas)
- Atender cliente final diretamente (assistente é para uso exclusivo de atendentes)

---

## Constraints

### C1: Context Budget (ADR-0002)
O prompt total enviado ao GPT-4o deve respeitar o budget de tokens:
- System prompt: ~4.000 tokens
- Chunks recuperados: ~8.000 tokens (5 chunks de ~1.600 tokens cada)
- Pergunta do usuário: ~500 tokens
- Histórico (opcional): até 3 turnos (~1.500 tokens)

**Total máximo:** ~14.000 tokens (buffer para 128K do modelo).

---

### C2: Tratamento de Contradições (ADR-0003)
Quando chunks de versões diferentes do mesmo documento são recuperados (ex: PROC-042 v1 e PROC-042 v2):
- Priorizar a versão mais recente (metadado `vigência`)
- Informar ao atendente que versão anterior existe
- Incluir ambas as fontes no campo `source_document`

---

### C3: Guardrails de Segurança
- Nunca afirmar que carga perigosa pode ser devolvida pelo processo padrão
- Nunca inventar valores numéricos (prazos, multiplicadores, SLAs) que não estejam literalmente nos chunks
- Nunca inventar tiers de cliente além de Gold, Silver e Standard

---

### C4: Latência
- Timeout de 30s para o endpoint completo (embedding + search + completion)
- Retry com exponential backoff para chamadas Azure (máximo 3 tentativas)

---

### C5: Auditabilidade
- Toda query e resposta devem ser logadas com ID único para rastreamento
- Logs devem incluir: query, chunks recuperados, resposta, latência, confiança

---

## Prior Decisions

- **ADR-0001:** Azure OpenAI GPT-4o escolhido pela janela de 128K tokens e integração com ecossistema Microsoft
- **ADR-0002:** Context budget definido para otimizar custo vs qualidade
- **ADR-0003:** Estratégia de tratamento de documentos contraditórios com metadado de vigência
- **ADR-0004:** Protótipo open-source validou abordagem RAG e identificou problemas de chunking em tabelas

---

## Verification Criteria

### VC-01: Latência
**Critério:** 95% das queries retornam resposta em menos de 30 segundos.  
**Medição:** Instrumentar endpoint com métricas de latência (P50, P95, P99).  
**Gate:** Testes de carga simulando 50 queries simultâneas; P95 < 30s.

---

### VC-02: Rastreabilidade de Fonte
**Critério:** 100% das respostas incluem campo `source_document` no JSON de retorno.  
**Medição:** Teste automatizado verifica presença do campo em 100 queries variadas.  
**Gate:** Nenhuma resposta sem `source_document` em suite de testes.

---

### VC-03: Proteção de Carga Perigosa
**Critério:** Queries sobre "carga perigosa + devolução" retornam negativa explícita (não elegível para processo padrão) + orientação para Gestão de Riscos (ramal 4500).  
**Medição:** Teste com 10 variações de pergunta sobre devolução de carga perigosa.  
**Gate:** 0% de respostas afirmativas sobre devolução padrão.

---

### VC-04: Fallback em "não encontrado"
**Critério:** Queries sem match no corpus retornam mensagem padrão "Não encontrei informação sobre isso na documentação disponível. Sugiro escalar para supervisor."  
**Medição:** Teste com 5 perguntas fora do domínio (ex: "qual o horário de funcionamento da matriz?").  
**Gate:** 100% das queries fora do domínio retornam fallback, não tentam responder.

---

### VC-05: Baixa Confiança
**Critério:** Respostas com confiança < 0.7 incluem prefixo "⚠️ Baixa confiança: [resposta]" e sugestão de escalação.  
**Medição:** Simular queries ambíguas (ex: "qual o prazo?" sem especificar contexto).  
**Gate:** 100% das respostas com baixa confiança incluem aviso.

---

### VC-06: Contradição Documental
**Critério:** Quando PROC-042 v1 e v2 são recuperados juntos, resposta prioriza v2 e menciona que v1 existe.  
**Medição:** Teste com query "quais são os multiplicadores regionais para frete especial?" que recupera ambas versões.  
**Gate:** Resposta cita valores da v2, menciona v1, inclui ambas em `source_document`.

---

## Dependencies

1. **Azure AI Search index populated**: Pipeline de ingestão precisa ter indexado os 847 documentos válidos com chunks e metadados.
2. **System prompt finalized**: `/prompts/system-prompt.md` precisa estar completo com guardrails e linguagem ubíqua.
3. **Zod schemas defined**: Schemas de validação para input (query) e output (response) precisam estar implementados.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Modelo alucina informação não presente nos chunks | **HIGH**: Atendente passa informação incorreta ao cliente | Harness determinístico valida que resposta só usa info dos chunks; testes de robustez |
| Latência > 30s devido a Azure throttling | **MEDIUM**: Experiência ruim para atendente | Retry com backoff; cache de embeddings de queries frequentes |
| Chunks não contêm informação necessária | **MEDIUM**: Assistente responde "não sei" quando deveria saber | Validar cobertura do corpus com golden queries do QA; iterar chunking strategy |
| Carga perigosa recebe instrução de devolução | **HIGH**: Risco legal e operacional | Guardrail determinístico no código (não apenas prompt); testes específicos |

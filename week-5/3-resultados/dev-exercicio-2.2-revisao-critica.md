# Exercício 2.2 — Revisão Crítica do Código (Task T01)

## Contexto
Este documento contém a revisão crítica do código gerado para a Task T01 (Setup do projeto e shared utilities). O código foi implementado seguindo os padrões definidos no plan.md, mas identificamos pontos que precisariam de ajuste antes de um code review real.

---

## Código Implementado

### Files criados:
- `src/shared/logger.ts` - Logger com pino
- `src/shared/retry.ts` - Helper de retry com exponential backoff
- `src/shared/types.ts` - Tipos TypeScript compartilhados
- `tests/unit/shared/retry.test.ts` - Testes unitários do retry

---

## Revisão Crítica: Problemas Identificados

### ❌ Problema 1: Dependências não instaladas

**Localização:** Todos os arquivos  
**Severidade:** BLOCKER

**Descrição:**  
O código importa dependências que não estão declaradas no `package.json`:
- `pino` (logger)
- `p-retry` (retry library)
- `@types/node` (para tipos do Node.js)

**Evidência:**
```typescript
// src/shared/logger.ts
import pino from 'pino'; // ❌ Package não instalado

// src/shared/retry.ts
import pRetry, { AbortError, Options as PRetryOptions } from 'p-retry'; // ❌ Package não instalado
```

**Impacto:**  
- Código não compila com `tsc`
- Testes não rodam com `vitest`
- CI/CD pipeline falhará

**Correção necessária:**
```bash
npm install pino p-retry
npm install --save-dev @types/node
```

Atualizar `package.json`:
```json
{
  "dependencies": {
    "pino": "^8.16.0",
    "p-retry": "^6.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "zod": "^3.23.0"
  }
}
```

---

### ⚠️ Problema 2: Imports com extensão `.js` em código TypeScript

**Localização:** `tests/unit/shared/retry.test.ts`, `src/shared/retry.ts`  
**Severidade:** MEDIUM (Code style + possível erro em runtime)

**Descrição:**  
Os imports estão usando `.js` extension, o que é correto para ESM modules em runtime, mas pode causar confusão:
```typescript
import { retryWithBackoff, isRetriableError, createAbortError, AbortError } from '../../../src/shared/retry.js';
import { logger } from './logger.js';
```

Isso funciona porque o TypeScript compila `.ts` → `.js`, mas:
1. É confuso ver `.js` em código `.ts`
2. Requer configuração específica no `tsconfig.json` (`"module": "ESM"`)

**Evidência do tsconfig atual:**
```json
// tsconfig.json no projeto
{
  "compilerOptions": {
    "module": "commonjs"  // ❌ Incompatível com imports .js
  }
}
```

**Impacto:**
- Imports podem falhar em runtime se tsconfig não estiver configurado corretamente
- Inconsistência: código mistura CommonJS e ESM

**Correção necessária:**

**Opção A (recomendada):** Usar ESM completamente  
Atualizar `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```
Atualizar `package.json`:
```json
{
  "type": "module"
}
```
Manter imports com `.js`

**Opção B:** Remover `.js` e usar CommonJS  
Remover extensão dos imports:
```typescript
import { retryWithBackoff } from '../../../src/shared/retry';
```
Manter `tsconfig.json` com `"module": "commonjs"`

**Recomendação:** Opção A (ESM é o padrão moderno e Azure Functions v4 suporta bem)

---

### ⚠️ Problema 3: Tipagem fraca em `logExecutionTime`

**Localização:** `src/shared/logger.ts`, linha 44-72  
**Severidade:** MEDIUM (Type safety)

**Descrição:**  
A função `logExecutionTime` usa `Record<string, unknown>` para context, o que é muito genérico:
```typescript
export async function logExecutionTime<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown> // ⚠️ Muito genérico
): Promise<T>
```

**Impacto:**
- Não valida que campos obrigatórios (ex: `query_id`) estejam presentes
- Permite passar qualquer coisa no context
- Perde type safety do TypeScript

**Correção sugerida:**
Criar interface para logging context:
```typescript
interface LogContext {
  query_id?: string;
  user_id?: string;
  session_id?: string;
  [key: string]: string | number | boolean | undefined;
}

export async function logExecutionTime<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T>
```

Ou ainda melhor, aceitar apenas os campos específicos que fazem sentido:
```typescript
interface OperationContext {
  query_id: string;
  user_id?: string;
  operation_metadata?: Record<string, string | number>;
}
```

---

### ℹ️ Observação 4: Falta configuração de environment variables

**Localização:** `src/shared/logger.ts`, linha 13  
**Severidade:** LOW (Funcional, mas não documentado)

**Descrição:**  
Logger lê `LOG_LEVEL` de env var, mas não há validação ou documentação:
```typescript
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // ℹ️ Sem validação
```

**Impacto:**
- Se usuário passar `LOG_LEVEL=invalid`, logger aceita silenciosamente
- Não há documentação de valores válidos

**Correção sugerida:**
Validar e documentar:
```typescript
const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = typeof VALID_LOG_LEVELS[number];

const LOG_LEVEL_ENV = process.env.LOG_LEVEL || 'info';
const LOG_LEVEL: LogLevel = VALID_LOG_LEVELS.includes(LOG_LEVEL_ENV as LogLevel)
  ? (LOG_LEVEL_ENV as LogLevel)
  : 'info';

if (process.env.LOG_LEVEL && !VALID_LOG_LEVELS.includes(process.env.LOG_LEVEL as LogLevel)) {
  console.warn(`Invalid LOG_LEVEL "${process.env.LOG_LEVEL}". Defaulting to "info".`);
}
```

Documentar em `.env.example`:
```bash
# Log level (trace | debug | info | warn | error | fatal)
LOG_LEVEL=info
```

---

### ℹ️ Observação 5: Testes não cobrem todos os casos de erro do logger

**Localização:** `tests/unit/shared/retry.test.ts`  
**Severidade:** LOW (Cobertura de testes)

**Descrição:**  
Temos testes para `retry.ts`, mas **não há testes para `logger.ts`**.

Casos não testados:
- `logExecutionTime` com função que falha
- `logExecutionTime` com função que sucede
- `createLogger` cria child logger com contexto correto
- Logger formata JSON corretamente para Azure Application Insights

**Impacto:**
- Cobertura de testes < 80% (meta definida no plan.md)
- Bugs em logger podem passar despercebidos

**Correção necessária:**
Criar `tests/unit/shared/logger.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { logger, createLogger, logExecutionTime } from '../../../src/shared/logger.js';

describe('Logger', () => {
  it('should log with correct format', () => {
    // Spy on logger.info
    const infoSpy = vi.spyOn(logger, 'info');
    
    logger.info({ operation: 'test' }, 'Test message');
    
    expect(infoSpy).toHaveBeenCalledWith(
      { operation: 'test' },
      'Test message'
    );
  });

  it('should create child logger with context', () => {
    const childLogger = createLogger({ query_id: '123' });
    
    // Verify child logger has context
    expect(childLogger.bindings()).toEqual(
      expect.objectContaining({ query_id: '123' })
    );
  });

  it('should measure execution time of async operation', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const result = await logExecutionTime('test_op', mockFn);
    
    expect(result).toBe('result');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should log error when operation fails', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
    const errorSpy = vi.spyOn(logger, 'error');
    
    await expect(
      logExecutionTime('test_op', mockFn)
    ).rejects.toThrow('Test error');
    
    expect(errorSpy).toHaveBeenCalled();
  });
});
```

---

## Resumo da Revisão

| Problema | Severidade | Bloqueia Merge? | Esforço de Fix |
|----------|-----------|-----------------|----------------|
| 1. Dependências não instaladas | BLOCKER | ✅ SIM | 5 min |
| 2. Import extensions (.js) | MEDIUM | ⚠️ Depende da config | 15 min |
| 3. Tipagem fraca em context | MEDIUM | ❌ NÃO | 10 min |
| 4. Validação de LOG_LEVEL | LOW | ❌ NÃO | 10 min |
| 5. Testes do logger faltando | LOW | ⚠️ Se meta de coverage | 20 min |

---

## Próximos Passos

1. ✅ **Imediato (antes de commit):**
   - Instalar dependências (Problema 1)
   - Decidir estratégia ESM vs CommonJS (Problema 2)

2. **Antes do code review:**
   - Melhorar tipagem de context (Problema 3)
   - Adicionar testes do logger (Problema 5)

3. **Nice to have (pode ser próxima iteração):**
   - Validação de LOG_LEVEL (Problema 4)

---

## Conclusão

O código gerado segue os padrões definidos no `plan.md` (TypeScript strict, pino para logging, p-retry para retry), mas tem **2 problemas blockers** que impedem execução:

1. Dependências não estão no package.json
2. Configuração de módulos (ESM vs CommonJS) não está clara

Estes são problemas típicos de código gerado por IA: a estrutura e lógica estão corretas, mas a integração com o projeto existente precisa de ajuste humano.

**Estimativa de tempo para correção:** ~1 hora para resolver todos os problemas listados.

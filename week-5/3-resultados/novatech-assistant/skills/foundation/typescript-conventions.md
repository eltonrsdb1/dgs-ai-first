# SKILL: TypeScript Conventions — NovaTech Assistant

**Version:** 1.0.0  
**Last updated:** 2024-01-20  
**Owner:** Tech Lead  
**Status:** Active  

---

## Quando usar esta skill

Esta skill se aplica a **TODO código TypeScript** no projeto NovaTech Assistant. Leia esta skill antes de gerar qualquer código `.ts`.

**Frases-ativação:**
- "Generate TypeScript code"
- "Create a new module/class/function"
- "Write TypeScript"
- "Implement [feature] in TypeScript"

---

## Contexto

O projeto NovaTech Assistant usa TypeScript em **strict mode** para maximizar type safety e prevenir bugs em produção. TypeScript não é apenas JavaScript com tipos - é uma ferramenta de correção de comportamento.

**Princípios:**
1. Se o código compila com `strict: true`, está 90% correto
2. Prefira type safety a conveniência
3. Use o sistema de tipos para documentar intenções
4. Evite escape hatches (`any`, `@ts-ignore`) - eles destroem type safety

---

## Regras Prescritivas

### ✅ DEVE

#### 1. Usar `strict: true` em tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

#### 2. Sempre declarar tipos explícitos para funções públicas
```typescript
// ✅ DO: Tipos explícitos no retorno e parâmetros
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  // ...
}

// ❌ DON'T: Inferência implícita em função pública
export async function generateEmbedding(text) {
  // ...
}
```

**Rationale:** Funções públicas são contratos. Tipos explícitos documentam o contrato e previnem breaking changes acidentais.

#### 3. Usar `unknown` ao invés de `any` quando tipo é desconhecido
```typescript
// ✅ DO: unknown força type check antes de usar
function parseJson(jsonString: string): unknown {
  return JSON.parse(jsonString);
}

const result = parseJson('{"foo": "bar"}');
// ✅ Precisa fazer type guard antes de usar
if (typeof result === 'object' && result !== null && 'foo' in result) {
  console.log(result.foo);
}

// ❌ DON'T: any desabilita type checking
function parseJson(jsonString: string): any {
  return JSON.parse(jsonString);
}

const result = parseJson('{"foo": "bar"}');
result.foo; // ❌ Nenhum erro, mas pode explodir em runtime
```

**Rationale:** `unknown` é type-safe; `any` é um buraco negro de type safety.

#### 4. Usar interfaces para objetos públicos, types para unions/primitives
```typescript
// ✅ DO: Interface para estruturas de dados
export interface QueryRequest {
  question: string;
  history?: Turn[];
  user_id?: string;
}

// ✅ DO: Type para unions e tipos computados
export type QueryStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PartialQueryRequest = Partial<QueryRequest>;

// ❌ DON'T: Type para estruturas simples (prefira interface)
type QueryRequest = {
  question: string;
  // ...
};
```

**Rationale:** Interfaces são extensíveis e têm melhor error messages. Types são melhores para unions e operações complexas.

#### 5. Usar `import` ESM, NUNCA `require()`
```typescript
// ✅ DO: ESM imports
import { logger } from './logger.js';
import type { QueryRequest } from './types.js';

// ❌ DON'T: CommonJS require
const logger = require('./logger');
```

**Rationale:** Projeto usa ESM (`"type": "module"` no package.json). `require()` não funciona.

#### 6. Usar imports com `.js` extension (por causa de ESM)
```typescript
// ✅ DO: Include .js extension (TypeScript compila .ts → .js)
import { logger } from './logger.js';
import { retryWithBackoff } from '../shared/retry.js';

// ❌ DON'T: Omitir extension em ESM
import { logger } from './logger';
```

**Rationale:** Node.js ESM requer extensions explícitas. TypeScript entende que `.js` corresponde a `.ts` na compilação.

#### 7. Usar naming conventions consistentes
```typescript
// ✅ DO: Naming correto
const userQuery = 'test';           // camelCase para variáveis
function calculateScore() {}        // camelCase para funções
class QueryHandler {}               // PascalCase para classes
interface QueryRequest {}           // PascalCase para interfaces
type QueryStatus = 'pending';       // PascalCase para types
const MAX_RETRIES = 3;              // UPPER_SNAKE_CASE para constantes
enum LogLevel { Info, Error }       // PascalCase para enum e valores

// ❌ DON'T: Naming inconsistente
const UserQuery = 'test';           // ❌ PascalCase em variável
function CalculateScore() {}        // ❌ PascalCase em função
class queryhandler {}               // ❌ lowercase em classe
```

---

### ❌ NÃO DEVE

#### 1. NUNCA usar `any`
```typescript
// ❌ DON'T: any desabilita type checking
function processData(data: any) {
  return data.value.toUpperCase(); // Pode explodir se data não tiver value
}

// ✅ DO: Use unknown + type guard, ou defina o tipo correto
function processData(data: unknown) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'value' in data &&
    typeof data.value === 'string'
  ) {
    return data.value.toUpperCase();
  }
  throw new Error('Invalid data structure');
}

// ✅ DO (melhor): Defina o tipo esperado
interface DataWithValue {
  value: string;
}

function processData(data: DataWithValue) {
  return data.value.toUpperCase();
}
```

**Exceção:** A única exceção tolerada é `catch (error: any)` porque JavaScript não garante o tipo de erros. Mas mesmo nesse caso, faça type guard imediatamente:
```typescript
try {
  // ...
} catch (error: any) {
  // ✅ OK: any no catch, mas com type guard imediato
  if (error instanceof Error) {
    logger.error({ error: error.message });
  } else {
    logger.error({ error: String(error) });
  }
}
```

#### 2. NUNCA usar `@ts-ignore` ou `@ts-expect-error`
```typescript
// ❌ DON'T: Suprimir erros de tipo
// @ts-ignore
const result = unsafeFunction();

// ✅ DO: Resolver o erro de tipo corretamente
const result = unsafeFunction() as ExpectedType; // Se você REALMENTE sabe o tipo
// Ou melhor: corrigir a função para retornar o tipo correto
```

**Rationale:** `@ts-ignore` é uma admissão de derrota. Se TypeScript reclama, há um problema real.

#### 3. NUNCA usar `console.log` - sempre usar logger
```typescript
// ❌ DON'T: console.log em código de produção
console.log('Processing query:', query);

// ✅ DO: Usar logger estruturado
logger.info({ query_id: query.id }, 'Processing query');
```

**Rationale:** `console.log` não é estruturado, não integra com Azure Application Insights, e não permite filtrar logs por nível.

#### 4. NUNCA usar default exports
```typescript
// ❌ DON'T: Default export
export default function generateEmbedding() {
  // ...
}

// ✅ DO: Named export
export function generateEmbedding() {
  // ...
}
```

**Rationale:** Named exports são mais refactor-friendly e facilitam tree-shaking.

#### 5. NUNCA usar type assertions sem validação
```typescript
// ❌ DON'T: Assertion sem validação (perigoso!)
const data = JSON.parse(jsonString) as QueryRequest;
data.question.toUpperCase(); // Pode explodir se JSON não tiver question

// ✅ DO: Validar antes de assertar (ou usar Zod)
const data = JSON.parse(jsonString);
if (isQueryRequest(data)) {
  data.question.toUpperCase();
}

// ✅ DO (melhor): Usar Zod para validação + type inference
const data = QueryRequestSchema.parse(JSON.parse(jsonString));
data.question.toUpperCase(); // Type-safe!
```

#### 6. NUNCA usar enums numéricos
```typescript
// ❌ DON'T: Numeric enum (confuso e error-prone)
enum Status {
  Pending,    // 0
  Processing, // 1
  Completed   // 2
}

// ✅ DO: String enum ou union type
enum Status {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
}

// ✅ DO (melhor): Union type (mais idiomático em TypeScript moderno)
type Status = 'pending' | 'processing' | 'completed';
```

**Rationale:** Numeric enums são uma fonte comum de bugs (comparações incorretas, serialização confusa).

---

## Anti-Padrões Comuns (LLMs frequentemente geram)

### Anti-Padrão 1: `as any` para "resolver" erro de tipo
```typescript
// ❌ DON'T: LLMs frequentemente fazem isso
const result = apiCall() as any;
result.data.value.nested.prop; // Bomb waiting to explode

// ✅ DO: Definir o tipo correto ou usar type guard
interface ApiResponse {
  data: {
    value: {
      nested: {
        prop: string;
      };
    };
  };
}

const result = apiCall() as ApiResponse;
result.data.value.nested.prop; // Type-safe
```

### Anti-Padrão 2: Inferência excessiva em retornos de função
```typescript
// ❌ DON'T: LLMs deixam TypeScript inferir o retorno
export function calculateScore(chunks: Chunk[]) {
  return chunks.reduce((acc, chunk) => acc + chunk.similarity, 0);
}
// Problema: Se alguém mudar a implementação, o tipo de retorno muda silenciosamente

// ✅ DO: Tipo explícito previne breaking changes
export function calculateScore(chunks: Chunk[]): number {
  return chunks.reduce((acc, chunk) => acc + chunk.similarity, 0);
}
```

### Anti-Padrão 3: Optional chaining excessivo esconde erros
```typescript
// ❌ DON'T: Optional chaining onde não deveria ser optional
function processUser(user: User) {
  return user?.profile?.name?.toUpperCase();
}
// Problema: Se profile ou name forem undefined, retorna undefined silenciosamente

// ✅ DO: Ser explícito sobre o que é realmente optional
function processUser(user: User): string {
  if (!user.profile || !user.profile.name) {
    throw new Error('User profile or name is missing');
  }
  return user.profile.name.toUpperCase();
}

// ✅ DO (alternativa): Modelar opcionalidade no tipo
interface User {
  profile?: {
    name?: string;
  };
}

function processUser(user: User): string | undefined {
  return user.profile?.name?.toUpperCase();
}
```

### Anti-Padrão 4: Mutação em vez de imutabilidade
```typescript
// ❌ DON'T: Mutar arrays/objetos (fonte de bugs)
function sortChunks(chunks: Chunk[]): Chunk[] {
  chunks.sort((a, b) => b.similarity - a.similarity);
  return chunks;
}
// Problema: Mutou o array original!

// ✅ DO: Criar cópia antes de modificar
function sortChunks(chunks: Chunk[]): Chunk[] {
  return [...chunks].sort((a, b) => b.similarity - a.similarity);
}
```

---

## Exemplos Completos

### Exemplo 1: Função com Error Handling
```typescript
import { logger } from '../shared/logger.js';
import { retryWithBackoff, createAbortError, isRetriableError } from '../shared/retry.js';
import type { EmbeddingResult } from '../shared/types.js';

/**
 * Generate embedding vector for text using Azure OpenAI
 * 
 * @param text Input text (max 8191 tokens)
 * @returns Embedding result with vector and metadata
 * @throws {Error} If text is empty or too long
 * @throws {Error} If Azure OpenAI API fails after retries
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  // Validation
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const start = Date.now();

  try {
    const result = await retryWithBackoff(
      async (attemptNumber) => {
        logger.debug({ attempt: attemptNumber }, 'Calling Azure OpenAI for embedding');

        try {
          const response = await azureOpenAIClient.getEmbedding(text);
          return response;
        } catch (error: any) {
          // Don't retry on authentication errors
          if (error.statusCode === 401 || error.statusCode === 403) {
            throw createAbortError(`Authentication failed: ${error.message}`);
          }

          // Retry on transient errors
          if (isRetriableError(error)) {
            throw error;
          }

          // Other errors: don't retry
          throw createAbortError(error.message);
        }
      },
      { operation: 'generate_embedding' }
    );

    const latency_ms = Date.now() - start;

    logger.info(
      { token_count: result.usage.total_tokens, latency_ms },
      'Embedding generated successfully'
    );

    return {
      embedding: result.data[0].embedding,
      token_count: result.usage.total_tokens,
      latency_ms,
    };
  } catch (error) {
    const latency_ms = Date.now() - start;

    logger.error(
      { error, latency_ms },
      'Failed to generate embedding'
    );

    throw error;
  }
}
```

### Exemplo 2: Validação com Type Guards
```typescript
import type { Chunk } from '../shared/types.js';

/**
 * Type guard to check if object is a valid Chunk
 */
export function isChunk(obj: unknown): obj is Chunk {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof obj.id === 'string' &&
    'document_id' in obj &&
    typeof obj.document_id === 'string' &&
    'content' in obj &&
    typeof obj.content === 'string' &&
    'similarity' in obj &&
    typeof obj.similarity === 'number' &&
    obj.similarity >= 0 &&
    obj.similarity <= 1
  );
}

/**
 * Validate array of chunks from external source
 */
export function validateChunks(data: unknown): Chunk[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of chunks');
  }

  const chunks: Chunk[] = [];

  for (const [index, item] of data.entries()) {
    if (isChunk(item)) {
      chunks.push(item);
    } else {
      logger.warn({ index, item }, 'Invalid chunk at index, skipping');
    }
  }

  return chunks;
}
```

---

## Dependencies

Esta skill é Foundation level - não depende de outras skills.

Outras skills DEVEM referenciar esta skill:
- `error-handling.md`
- `azure-functions-endpoint.md`
- `testing-patterns.md`
- Todas as Artifact skills

---

## Checklist para Code Review

Ao revisar código TypeScript, verificar:
- [ ] Compila com `strict: true` sem erros
- [ ] Nenhum uso de `any`, `@ts-ignore`, ou `console.log`
- [ ] Funções públicas têm tipos explícitos de retorno
- [ ] Usa `unknown` + type guards ao invés de `any`
- [ ] Naming conventions seguidas (camelCase, PascalCase, UPPER_SNAKE_CASE)
- [ ] Imports ESM com `.js` extension
- [ ] Named exports (não default exports)
- [ ] Logger usado ao invés de console.log

---

## Changelog

### v1.0.0 (2024-01-20)
- Initial version
- Foundation conventions for NovaTech Assistant project

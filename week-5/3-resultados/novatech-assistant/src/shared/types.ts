/**
 * Shared TypeScript types for NovaTech Assistant
 * 
 * All types use strict TypeScript - NO `any` types allowed
 */

/**
 * A single turn in conversation history
 */
export interface Turn {
  /** User's question */
  question: string;
  /** Assistant's answer */
  answer: string;
  /** Timestamp of the turn */
  timestamp: string;
}

/**
 * Query request from Teams bot or web panel
 */
export interface QueryRequest {
  /** The user's question (3-500 chars) */
  question: string;
  /** Optional conversation history (max 3 turns) */
  history?: Turn[];
  /** User ID for logging and tracking */
  user_id?: string;
  /** Session ID for grouping related queries */
  session_id?: string;
}

/**
 * Document chunk from retrieval corpus
 */
export interface Chunk {
  /** Unique chunk identifier (e.g., "POL-001-B") */
  id: string;
  /** Document ID (e.g., "POL-001") */
  document_id: string;
  /** Document title */
  document_title: string;
  /** Section within document (e.g., "3.2") */
  section?: string;
  /** Chunk content text */
  content: string;
  /** Similarity score from vector search (0-1) */
  similarity: number;
  /** Document version for conflict resolution */
  version?: string;
  /** Document effective date (ISO 8601) */
  vigencia?: string;
  /** Additional metadata */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Result from embedding generation
 */
export interface EmbeddingResult {
  /** Embedding vector */
  embedding: number[];
  /** Number of tokens in input */
  token_count: number;
  /** Latency in milliseconds */
  latency_ms: number;
}

/**
 * Result from vector search
 */
export interface SearchResult {
  /** Retrieved chunks */
  chunks: Chunk[];
  /** Total chunks found before filtering */
  total_found: number;
  /** Minimum similarity threshold applied */
  threshold: number;
  /** Latency in milliseconds */
  latency_ms: number;
}

/**
 * Result from completion generation
 */
export interface CompletionResult {
  /** Generated answer */
  answer: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Tokens used in prompt */
  prompt_tokens: number;
  /** Tokens used in completion */
  completion_tokens: number;
  /** Total tokens */
  total_tokens: number;
  /** Latency in milliseconds */
  latency_ms: number;
}

/**
 * Query response returned to user
 */
export interface QueryResponse {
  /** Generated answer */
  answer: string;
  /** Source documents referenced (e.g., ["POL-001:3.2", "PROC-042-v2:2.1"]) */
  source_documents: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Total latency in milliseconds */
  latency_ms: number;
  /** Unique query ID for tracing */
  query_id: string;
  /** Optional warnings (e.g., low confidence) */
  warnings?: string[];
}

/**
 * Validation result from response validator
 */
export interface ValidationResult {
  /** Whether response passes validation */
  isValid: boolean;
  /** Validation errors (blocking issues) */
  errors: string[];
  /** Validation warnings (non-blocking issues) */
  warnings: string[];
  /** Details for debugging */
  details?: Record<string, unknown>;
}

/**
 * Prompt components before assembly
 */
export interface PromptComponents {
  /** System prompt text */
  system_prompt: string;
  /** Retrieved chunks */
  chunks: Chunk[];
  /** User's question */
  question: string;
  /** Optional conversation history */
  history?: Turn[];
  /** Token counts per component */
  token_counts: {
    system: number;
    chunks: number;
    question: number;
    history: number;
    total: number;
  };
}

/**
 * Context budget limits (from ADR-0002)
 */
export interface ContextBudget {
  /** System prompt limit */
  system: number;
  /** Chunks limit */
  chunks: number;
  /** Question limit */
  question: number;
  /** History limit */
  history: number;
  /** Total limit */
  total: number;
}

/**
 * Default context budget per ADR-0002
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  system: 4000,
  chunks: 8000,
  question: 500,
  history: 1500,
  total: 14000,
};

/**
 * Error response for failed queries
 */
export interface ErrorResponse {
  /** Error message */
  error: string;
  /** Error code for categorization */
  code: string;
  /** Query ID for tracing */
  query_id: string;
  /** Additional details (not shown to end user) */
  details?: Record<string, unknown>;
}

/**
 * Metrics for observability
 */
export interface QueryMetrics {
  /** Query ID */
  query_id: string;
  /** User ID */
  user_id?: string;
  /** Total latency */
  latency_ms: number;
  /** Embedding latency */
  embedding_latency_ms: number;
  /** Search latency */
  search_latency_ms: number;
  /** Completion latency */
  completion_latency_ms: number;
  /** Chunks retrieved */
  chunks_retrieved: number;
  /** Tokens used */
  tokens_total: number;
  /** Confidence score */
  confidence: number;
  /** Timestamp */
  timestamp: string;
  /** Whether validation passed */
  validation_passed: boolean;
}

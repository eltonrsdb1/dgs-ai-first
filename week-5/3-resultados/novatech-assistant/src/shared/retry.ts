import pRetry, { AbortError, Options as PRetryOptions } from 'p-retry';
import { logger } from './logger.js';

/**
 * Retry configuration for Azure services
 * 
 * Default config:
 * - 3 attempts (initial + 2 retries)
 * - Exponential backoff: 2^n * 100ms (100ms, 200ms, 400ms)
 * - Total timeout: 30s (handled by caller)
 */
export interface RetryConfig {
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 100ms) */
  factor?: number;
  /** Minimum delay in milliseconds (default: 100ms) */
  minTimeout?: number;
  /** Maximum delay in milliseconds (default: 5000ms) */
  maxTimeout?: number;
  /** Operation name for logging */
  operation?: string;
}

/**
 * Default retry configuration aligned with project standards (plan.md TD-03)
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 3,
  factor: 2,
  minTimeout: 100,
  maxTimeout: 5000,
};

/**
 * Retry wrapper with exponential backoff
 * 
 * @example
 * const result = await retryWithBackoff(
 *   async () => await azureClient.getSomething(),
 *   { operation: 'azure_api_call' }
 * );
 * 
 * @example Handle non-retryable errors
 * await retryWithBackoff(
 *   async (attemptNumber) => {
 *     try {
 *       return await apiCall();
 *     } catch (error) {
 *       if (error.statusCode === 401) {
 *         // Authentication error - don't retry
 *         throw new AbortError(error.message);
 *       }
 *       throw error; // Other errors will be retried
 *     }
 *   },
 *   { operation: 'api_call' }
 * );
 */
export async function retryWithBackoff<T>(
  fn: (attemptNumber: number) => Promise<T> | T,
  config: RetryConfig = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const operation = mergedConfig.operation || 'operation';

  const pRetryOptions: PRetryOptions = {
    retries: mergedConfig.retries!,
    factor: mergedConfig.factor!,
    minTimeout: mergedConfig.minTimeout!,
    maxTimeout: mergedConfig.maxTimeout!,
    onFailedAttempt: (error) => {
      logger.warn(
        {
          operation,
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message,
        },
        `Retry attempt ${error.attemptNumber} failed for ${operation}. ${error.retriesLeft} retries left.`
      );
    },
  };

  try {
    logger.debug({ operation, config: mergedConfig }, `Starting ${operation} with retry`);
    
    const result = await pRetry(fn, pRetryOptions);
    
    return result;
  } catch (error) {
    logger.error(
      { operation, error, config: mergedConfig },
      `All retry attempts exhausted for ${operation}`
    );
    throw error;
  }
}

/**
 * Determine if an error should be retried
 * 
 * @param error The error to check
 * @returns true if error is transient and should be retried
 * 
 * @example
 * if (!isRetriableError(error)) {
 *   throw new AbortError(error.message);
 * }
 */
export function isRetriableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { statusCode?: number; code?: string };
    
    // HTTP status codes that should be retried
    const retriableStatusCodes = [
      408, // Request Timeout
      429, // Too Many Requests (rate limit)
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ];
    
    if (err.statusCode && retriableStatusCodes.includes(err.statusCode)) {
      return true;
    }
    
    // Azure SDK error codes that should be retried
    const retriableAzureCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ThrottlingException',
      'ServiceUnavailable',
    ];
    
    if (err.code && retriableAzureCodes.includes(err.code)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create a non-retriable error
 * Use this to abort retries for errors that won't be resolved by retrying
 * 
 * @example
 * if (statusCode === 401) {
 *   throw createAbortError('Authentication failed');
 * }
 */
export function createAbortError(message: string): AbortError {
  return new AbortError(message);
}

// Re-export AbortError for convenience
export { AbortError };

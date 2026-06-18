import pino from 'pino';

/**
 * Centralized logger configuration for NovaTech Assistant
 * 
 * CRITICAL: NEVER use console.log in this codebase.
 * Always use logger.info(), logger.error(), logger.warn(), etc.
 * 
 * Structured logging with JSON format for Azure Application Insights
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'novatech-assistant',
    environment: process.env.NODE_ENV || 'development',
  },
});

/**
 * Create a child logger with additional context
 * 
 * @example
 * const queryLogger = createLogger({ query_id: '123-456' });
 * queryLogger.info('Processing query');
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log execution time of async operations
 * 
 * @example
 * await logExecutionTime('embedding_generation', async () => {
 *   return await generateEmbedding(text);
 * });
 */
export async function logExecutionTime<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  const operationLogger = context ? createLogger(context) : logger;
  
  operationLogger.info({ operation }, `Starting ${operation}`);
  
  try {
    const result = await fn();
    const latency_ms = Date.now() - start;
    
    operationLogger.info(
      { operation, latency_ms },
      `Completed ${operation} in ${latency_ms}ms`
    );
    
    return result;
  } catch (error) {
    const latency_ms = Date.now() - start;
    
    operationLogger.error(
      { operation, latency_ms, error },
      `Failed ${operation} after ${latency_ms}ms`
    );
    
    throw error;
  }
}

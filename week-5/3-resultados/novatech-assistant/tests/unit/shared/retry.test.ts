import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, isRetriableError, createAbortError, AbortError } from '../../../src/shared/retry.js';

describe('Retry Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt when function succeeds', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, {
        operation: 'test_operation',
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on second attempt', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Transient failure'))
        .mockResolvedValueOnce('success');
      
      const result = await retryWithBackoff(mockFn, {
        operation: 'test_operation',
        retries: 3,
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry specified number of times before failing', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(
        retryWithBackoff(mockFn, {
          operation: 'test_operation',
          retries: 3,
          minTimeout: 10, // Speed up test
        })
      ).rejects.toThrow('Persistent failure');
      
      // Initial attempt + 3 retries = 4 total calls
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it('should not retry on AbortError', async () => {
      const mockFn = vi.fn().mockRejectedValue(new AbortError('Non-retriable error'));
      
      await expect(
        retryWithBackoff(mockFn, {
          operation: 'test_operation',
          retries: 3,
        })
      ).rejects.toThrow('Non-retriable error');
      
      // Should only be called once (no retries)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass attempt number to function', async () => {
      const mockFn = vi.fn().mockImplementation(async (attemptNumber: number) => {
        if (attemptNumber < 3) {
          throw new Error(`Attempt ${attemptNumber} failed`);
        }
        return 'success';
      });
      
      const result = await retryWithBackoff(mockFn, {
        operation: 'test_operation',
        retries: 3,
        minTimeout: 10,
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith(1);
      expect(mockFn).toHaveBeenCalledWith(2);
      expect(mockFn).toHaveBeenCalledWith(3);
    });

    it('should use default config when no config provided', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetriableError', () => {
    it('should return true for 429 (rate limit)', () => {
      const error = { statusCode: 429, message: 'Too Many Requests' };
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return true for 503 (service unavailable)', () => {
      const error = { statusCode: 503, message: 'Service Unavailable' };
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return true for 500 (internal server error)', () => {
      const error = { statusCode: 500, message: 'Internal Server Error' };
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return true for ETIMEDOUT', () => {
      const error = { code: 'ETIMEDOUT', message: 'Timeout' };
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return true for ECONNRESET', () => {
      const error = { code: 'ECONNRESET', message: 'Connection reset' };
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return false for 401 (unauthorized)', () => {
      const error = { statusCode: 401, message: 'Unauthorized' };
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for 400 (bad request)', () => {
      const error = { statusCode: 400, message: 'Bad Request' };
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for unknown errors', () => {
      const error = { message: 'Unknown error' };
      expect(isRetriableError(error)).toBe(false);
    });

    it('should return false for non-object errors', () => {
      expect(isRetriableError('string error')).toBe(false);
      expect(isRetriableError(null)).toBe(false);
      expect(isRetriableError(undefined)).toBe(false);
    });
  });

  describe('createAbortError', () => {
    it('should create an AbortError with message', () => {
      const error = createAbortError('Test abort');
      
      expect(error).toBeInstanceOf(AbortError);
      expect(error.message).toBe('Test abort');
    });

    it('should be recognized by p-retry as non-retriable', async () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw createAbortError('Authentication failed');
      });
      
      await expect(
        retryWithBackoff(mockFn, { retries: 3 })
      ).rejects.toThrow('Authentication failed');
      
      // Should only attempt once
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-world Azure scenarios', () => {
    it('should retry on Azure OpenAI rate limit (429)', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce({ statusCode: 429, message: 'Rate limit exceeded' })
        .mockResolvedValueOnce({ data: 'success' });
      
      const result = await retryWithBackoff(mockFn, {
        operation: 'azure_openai_call',
        minTimeout: 10,
      });
      
      expect(result).toEqual({ data: 'success' });
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on authentication failure (401)', async () => {
      const mockFn = vi.fn().mockImplementation((attemptNumber) => {
        const error = { statusCode: 401, message: 'Invalid API key' };
        if (!isRetriableError(error)) {
          throw createAbortError(error.message);
        }
        throw error;
      });
      
      await expect(
        retryWithBackoff(mockFn, {
          operation: 'azure_openai_call',
          retries: 3,
        })
      ).rejects.toThrow('Invalid API key');
      
      // Should only attempt once (no retry for 401)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on Azure AI Search timeout', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Request timeout' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Request timeout' })
        .mockResolvedValueOnce({ results: [] });
      
      const result = await retryWithBackoff(mockFn, {
        operation: 'azure_search_query',
        retries: 3,
        minTimeout: 10,
      });
      
      expect(result).toEqual({ results: [] });
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});

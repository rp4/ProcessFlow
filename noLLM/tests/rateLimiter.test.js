import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  debounce,
  throttle,
  throttleRAF,
  createRateLimiter,
  createQueue,
  batch,
  memoize
} from '../src/core/utils/rateLimiter.js';

describe('Rate Limiter Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1');
      debounced('arg2');
      debounced('arg3');

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');
    });

    it('should reset timer on each call', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(50);

      debounced();
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should preserve context', () => {
      const obj = {
        value: 42,
        method: jest.fn(function() {
          return this.value;
        })
      };

      obj.debounced = debounce(obj.method, 100);
      obj.debounced();

      jest.advanceTimersByTime(100);

      expect(obj.method).toHaveBeenCalledTimes(1);
      expect(obj.method.mock.instances[0]).toBe(obj);
    });
  });

  describe('throttle', () => {
    it('should limit function calls to specified interval', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled('call1');
      throttled('call2');
      throttled('call3');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call1');

      jest.advanceTimersByTime(100);

      throttled('call4');

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('call4');
    });

    it('should return last result during throttled period', () => {
      const fn = jest.fn(() => 'result');
      const throttled = throttle(fn, 100);

      const result1 = throttled();
      const result2 = throttled();

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttleRAF', () => {
    it('should throttle using requestAnimationFrame', () => {
      const fn = jest.fn();
      const rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => {
        cb();
        return 1;
      });

      const throttled = throttleRAF(fn);

      throttled('arg1');
      throttled('arg2');
      throttled('arg3');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');

      rafSpy.mockRestore();
    });
  });

  describe('createRateLimiter', () => {
    it('should allow actions within token limit', () => {
      const limiter = createRateLimiter(3, 1);
      const fn = jest.fn(() => 'result');

      const result1 = limiter(fn);
      const result2 = limiter(fn);
      const result3 = limiter(fn);

      expect(fn).toHaveBeenCalledTimes(3);
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(result3).toBe('result');
    });

    it('should reject actions when tokens exhausted', () => {
      const limiter = createRateLimiter(2, 1);
      const fn = jest.fn();

      limiter(fn);
      limiter(fn);
      const result = limiter(fn);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(result).toBeNull();
    });

    it('should refill tokens over time', () => {
      const limiter = createRateLimiter(2, 1);
      const fn = jest.fn();

      // Use all tokens
      limiter(fn);
      limiter(fn);

      // Should be rejected
      const rejected = limiter(fn);
      expect(rejected).toBeNull();

      // Advance time to refill
      jest.advanceTimersByTime(1000);

      // Should work now
      const accepted = limiter(fn);
      expect(accepted).not.toBeNull();
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('createQueue', () => {
    it('should process tasks sequentially', async () => {
      jest.useRealTimers();
      const queue = createQueue(1, 0);
      const order = [];

      const task1 = () => new Promise(resolve => {
        setTimeout(() => {
          order.push(1);
          resolve(1);
        }, 10);
      });

      const task2 = () => {
        order.push(2);
        return 2;
      };

      const result1 = queue.add(task1);
      const result2 = queue.add(task2);

      const [r1, r2] = await Promise.all([result1, result2]);

      expect(r1).toBe(1);
      expect(r2).toBe(2);
      expect(order).toEqual([1, 2]);
    });

    it('should handle concurrent limit', async () => {
      jest.useRealTimers();
      const queue = createQueue(2, 0);
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = () => new Promise(resolve => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        setTimeout(() => {
          concurrent--;
          resolve();
        }, 10);
      });

      await Promise.all([
        queue.add(task),
        queue.add(task),
        queue.add(task),
        queue.add(task)
      ]);

      expect(maxConcurrent).toBe(2);
    });

    it('should report queue size', () => {
      const queue = createQueue(1, 0);
      const task = () => new Promise(resolve => setTimeout(resolve, 100));

      queue.add(task);
      queue.add(task);
      queue.add(task);

      expect(queue.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('batch', () => {
    it('should batch multiple calls', () => {
      const fn = jest.fn();
      const batched = batch(fn, 50);

      batched('arg1');
      batched('arg2');
      batched('arg3');

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith([
        { context: undefined, args: ['arg1'] },
        { context: undefined, args: ['arg2'] },
        { context: undefined, args: ['arg3'] }
      ]);
    });

    it('should reset batch after processing', () => {
      const fn = jest.fn();
      const batched = batch(fn, 50);

      batched('batch1');
      jest.advanceTimersByTime(50);

      batched('batch2');
      jest.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, [
        { context: undefined, args: ['batch1'] }
      ]);
      expect(fn).toHaveBeenNthCalledWith(2, [
        { context: undefined, args: ['batch2'] }
      ]);
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const fn = jest.fn((a, b) => a + b);
      const memoized = memoize(fn);

      const result1 = memoized(1, 2);
      const result2 = memoized(1, 2);
      const result3 = memoized(2, 3);

      expect(result1).toBe(3);
      expect(result2).toBe(3);
      expect(result3).toBe(5);
      expect(fn).toHaveBeenCalledTimes(2); // Only twice, not three times
    });

    it('should expire cached results with TTL', () => {
      const fn = jest.fn(() => Math.random());
      const memoized = memoize(fn, 100);

      const result1 = memoized();
      const result2 = memoized();

      expect(result1).toBe(result2);
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(101);

      const result3 = memoized();

      expect(result3).not.toBe(result1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should limit cache size', () => {
      const fn = jest.fn(x => x * 2);
      const memoized = memoize(fn);

      // Fill cache beyond limit (100)
      for (let i = 0; i < 110; i++) {
        memoized(i);
      }

      // First call should no longer be cached
      memoized(0);
      expect(fn).toHaveBeenCalledTimes(111); // Original 110 + 1 recalculation
    });
  });
});
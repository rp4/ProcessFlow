/**
 * Rate limiting utilities for preventing excessive function calls
 */

import { Logger } from './Logger.js';

/**
 * Debounce - delays function execution until after wait milliseconds have elapsed
 * since the last time it was invoked
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeoutId = null;

  return function debounced(...args) {
    const context = this;

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func.apply(context, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle - ensures function is called at most once per specified time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle = false;
  let lastResult;

  return function throttled(...args) {
    const context = this;

    if (!inThrottle) {
      lastResult = func.apply(context, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }

    return lastResult;
  };
}

/**
 * Throttle with requestAnimationFrame - ideal for drag/scroll handlers
 * @param {Function} func - Function to throttle
 * @returns {Function} Throttled function
 */
export function throttleRAF(func) {
  let rafId = null;
  let lastArgs = null;
  let lastContext = null;

  return function throttled(...args) {
    lastArgs = args;
    lastContext = this;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        func.apply(lastContext, lastArgs);
        rafId = null;
      });
    }
  };
}

/**
 * Rate limiter with token bucket algorithm - allows burst of actions
 * @param {number} maxTokens - Maximum tokens in bucket
 * @param {number} refillRate - Tokens added per second
 * @returns {Function} Rate limiter function
 */
export function createRateLimiter(maxTokens = 10, refillRate = 1) {
  let tokens = maxTokens;
  let lastRefill = Date.now();

  // Refill tokens periodically
  const refillTokens = () => {
    const now = Date.now();
    const timePassed = (now - lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * refillRate;

    tokens = Math.min(maxTokens, tokens + tokensToAdd);
    lastRefill = now;
  };

  return function rateLimiter(func, tokensRequired = 1) {
    refillTokens();

    if (tokens >= tokensRequired) {
      tokens -= tokensRequired;
      return func();
    }

    // Action rejected due to rate limit
    Logger.warn('Rate limit exceeded');
    return null;
  };
}

/**
 * Create a queue for sequential processing with rate limiting
 * @param {number} maxConcurrent - Maximum concurrent operations
 * @param {number} delay - Delay between operations in ms
 * @returns {Object} Queue manager
 */
export function createQueue(maxConcurrent = 1, delay = 100) {
  const queue = [];
  let running = 0;

  const processNext = async () => {
    if (running >= maxConcurrent || queue.length === 0) {
      return;
    }

    running++;
    const { func, resolve, reject } = queue.shift();

    try {
      const result = await func();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      running--;

      // Add delay before processing next
      if (delay > 0) {
        setTimeout(processNext, delay);
      } else {
        processNext();
      }
    }
  };

  return {
    add(func) {
      return new Promise((resolve, reject) => {
        queue.push({ func, resolve, reject });
        processNext();
      });
    },

    clear() {
      queue.length = 0;
    },

    get size() {
      return queue.length;
    },

    get isRunning() {
      return running > 0;
    },
  };
}

/**
 * Batch multiple calls into a single execution
 * @param {Function} func - Function to batch (receives array of all args)
 * @param {number} wait - Time to wait for batch collection in ms
 * @returns {Function} Batched function
 */
export function batch(func, wait = 50) {
  let timeoutId = null;
  let batch = [];

  return function batched(...args) {
    const context = this;

    // Add to batch
    batch.push({ context, args });

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      const currentBatch = batch;
      batch = [];
      timeoutId = null;

      // Process entire batch
      func.call(context, currentBatch);
    }, wait);
  };
}

/**
 * Memoize function results with optional TTL
 * @param {Function} func - Function to memoize
 * @param {number} ttl - Time to live in milliseconds (optional)
 * @returns {Function} Memoized function
 */
export function memoize(func, ttl = null) {
  const cache = new Map();

  return function memoized(...args) {
    const key = JSON.stringify(args);

    // Check cache
    if (cache.has(key)) {
      const cached = cache.get(key);

      // Check if expired
      if (!ttl || Date.now() - cached.timestamp < ttl) {
        return cached.value;
      }

      // Remove expired entry
      cache.delete(key);
    }

    // Compute and cache result
    const result = func.apply(this, args);
    cache.set(key, {
      value: result,
      timestamp: Date.now(),
    });

    // Limit cache size to prevent memory leaks
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}

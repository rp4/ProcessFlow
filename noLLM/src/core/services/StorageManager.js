/**
 * StorageManager - Handles localStorage operations with quota management
 */
import { Logger } from '../utils/Logger.js';

export class StorageManager {
  constructor() {
    this.prefix = 'swimlanes_';
    this.maxSize = 5 * 1024 * 1024; // 5MB default limit
    this.quotaThreshold = 0.9; // Alert at 90% capacity
  }

  /**
   * Safely set item in localStorage with quota management
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  async setItem(key, value) {
    const prefixedKey = this.prefix + key;

    try {
      const serialized = JSON.stringify(value);
      const size = new Blob([serialized]).size;

      // Check estimated quota if available
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();

        // Check if we're approaching quota
        if (usage + size > quota * this.quotaThreshold) {
          Logger.warn('Approaching storage quota limit');
          await this.cleanupOldData();
        }
      }

      // Attempt to store
      try {
        localStorage.setItem(prefixedKey, serialized);

        // Add timestamp for cleanup purposes
        const metaKey = `${prefixedKey}_meta`;
        localStorage.setItem(
          metaKey,
          JSON.stringify({
            timestamp: Date.now(),
            size,
          }),
        );

        return true;
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          Logger.warn('Storage quota exceeded, attempting cleanup...');
          await this.handleQuotaExceeded();

          // Retry once after cleanup
          try {
            localStorage.setItem(prefixedKey, serialized);
            return true;
          } catch (retryError) {
            Logger.error('Failed to store after cleanup:', retryError);
            return false;
          }
        }
        throw e;
      }
    } catch (error) {
      Logger.error('Storage error:', error);
      return false;
    }
  }

  /**
   * Safely get item from localStorage
   * @param {string} key - Storage key
   * @returns {*} Stored value or null
   */
  getItem(key) {
    const prefixedKey = this.prefix + key;

    try {
      const item = localStorage.getItem(prefixedKey);
      if (!item) {
        return null;
      }

      return JSON.parse(item);
    } catch (error) {
      Logger.error('Error retrieving from storage:', error);
      return null;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   */
  removeItem(key) {
    const prefixedKey = this.prefix + key;

    try {
      localStorage.removeItem(prefixedKey);
      localStorage.removeItem(`${prefixedKey}_meta`);
    } catch (error) {
      Logger.error('Error removing from storage:', error);
    }
  }

  /**
   * Clean up old data when approaching quota
   */
  async cleanupOldData() {
    const items = [];

    // Collect all items with metadata
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix) && key.endsWith('_meta')) {
        try {
          const meta = JSON.parse(localStorage.getItem(key));
          const dataKey = key.replace('_meta', '');
          items.push({
            key: dataKey,
            metaKey: key,
            timestamp: meta.timestamp || 0,
            size: meta.size || 0,
          });
        } catch (e) {
          // Skip invalid metadata
        }
      }
    }

    // Sort by timestamp (oldest first)
    items.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 20% of items
    const removeCount = Math.ceil(items.length * 0.2);
    for (let i = 0; i < removeCount && i < items.length; i++) {
      localStorage.removeItem(items[i].key);
      localStorage.removeItem(items[i].metaKey);
    }

    Logger.info(`Cleaned up ${removeCount} old items from storage`);
  }

  /**
   * Handle quota exceeded error
   */
  async handleQuotaExceeded() {
    // First try to clean up old data
    await this.cleanupOldData();

    // Clear error logs if they exist
    this.clearErrorLogs();

    // Clear temporary data
    this.clearTemporaryData();

    // As last resort, clear all app data except critical settings
    if (this.getStorageUsage() > this.maxSize * 0.9) {
      this.clearNonCriticalData();
    }
  }

  /**
   * Clear error logs from storage
   */
  clearErrorLogs() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes('error') || key?.includes('log')) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Clear temporary data
   */
  clearTemporaryData() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes('temp') || key?.includes('cache')) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Clear non-critical data
   */
  clearNonCriticalData() {
    const criticalKeys = ['settings', 'preferences', 'user'];
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        const isCritical = criticalKeys.some((critical) => key.includes(critical));
        if (!isCritical) {
          keys.push(key);
        }
      }
    }

    keys.forEach((key) => localStorage.removeItem(key));
    Logger.info(`Cleared ${keys.length} non-critical items from storage`);
  }

  /**
   * Get current storage usage
   * @returns {number} Total size in bytes
   */
  getStorageUsage() {
    let total = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value) {
        total += key.length + value.length;
      }
    }

    return total * 2; // Multiply by 2 for UTF-16 encoding
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  async getStats() {
    const usage = this.getStorageUsage();
    let quota = this.maxSize;

    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota || this.maxSize;
    }

    return {
      usage,
      quota,
      percentage: (usage / quota) * 100,
      available: quota - usage,
    };
  }

  /**
   * Clear all app storage
   */
  clearAll() {
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => localStorage.removeItem(key));
    Logger.info('Cleared all app storage');
  }
}

// Create singleton instance
const storageManager = new StorageManager();

export default storageManager;

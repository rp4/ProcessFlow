import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StorageManager } from '../src/core/services/StorageManager.js';

describe('StorageManager', () => {
  let storageManager;
  let localStorageMock;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {
      data: {},
      getItem: jest.fn(key => localStorageMock.data[key] || null),
      setItem: jest.fn((key, value) => {
        localStorageMock.data[key] = value;
      }),
      removeItem: jest.fn(key => {
        delete localStorageMock.data[key];
      }),
      clear: jest.fn(() => {
        localStorageMock.data = {};
      }),
      get length() {
        return Object.keys(localStorageMock.data).length;
      },
      key: jest.fn(index => Object.keys(localStorageMock.data)[index] || null)
    };

    // Replace global localStorage
    global.localStorage = localStorageMock;

    // Mock navigator.storage
    global.navigator = {
      storage: {
        estimate: jest.fn().mockResolvedValue({
          usage: 1000000,
          quota: 10000000
        })
      }
    };

    storageManager = new StorageManager();
  });

  describe('setItem', () => {
    it('should store items with prefix', async () => {
      const result = await storageManager.setItem('testKey', { value: 'test' });

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'swimlanes_testKey',
        JSON.stringify({ value: 'test' })
      );
    });

    it('should store metadata with timestamp', async () => {
      await storageManager.setItem('testKey', 'value');

      const metaKey = 'swimlanes_testKey_meta';
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        metaKey,
        expect.stringContaining('timestamp')
      );
    });

    it('should handle quota exceeded error', async () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const cleanupSpy = jest.spyOn(storageManager, 'handleQuotaExceeded');

      const result = await storageManager.setItem('testKey', 'value');

      expect(cleanupSpy).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should cleanup when approaching quota', async () => {
      navigator.storage.estimate.mockResolvedValueOnce({
        usage: 9000000,
        quota: 10000000
      });

      const cleanupSpy = jest.spyOn(storageManager, 'cleanupOldData');

      await storageManager.setItem('testKey', 'value');

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('getItem', () => {
    it('should retrieve items with prefix', () => {
      localStorageMock.data['swimlanes_testKey'] = JSON.stringify({ value: 'test' });

      const result = storageManager.getItem('testKey');

      expect(result).toEqual({ value: 'test' });
      expect(localStorageMock.getItem).toHaveBeenCalledWith('swimlanes_testKey');
    });

    it('should return null for non-existent items', () => {
      const result = storageManager.getItem('nonExistent');

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      localStorageMock.data['swimlanes_testKey'] = 'invalid json {';

      const result = storageManager.getItem('testKey');

      expect(result).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('should remove item and metadata', () => {
      storageManager.removeItem('testKey');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('swimlanes_testKey');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('swimlanes_testKey_meta');
    });
  });

  describe('cleanupOldData', () => {
    it('should remove oldest items', async () => {
      // Add items with different timestamps
      const now = Date.now();
      localStorageMock.data = {
        'swimlanes_old_meta': JSON.stringify({ timestamp: now - 10000, size: 100 }),
        'swimlanes_old': 'old data',
        'swimlanes_new_meta': JSON.stringify({ timestamp: now, size: 100 }),
        'swimlanes_new': 'new data'
      };

      await storageManager.cleanupOldData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('swimlanes_old');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('swimlanes_new');
    });
  });

  describe('getStorageUsage', () => {
    it('should calculate total storage usage', () => {
      localStorageMock.data = {
        key1: 'value1',
        key2: 'value2'
      };

      const usage = storageManager.getStorageUsage();

      // Each character is 2 bytes (UTF-16)
      const expected = ('key1value1key2value2').length * 2;
      expect(usage).toBe(expected);
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      localStorageMock.data = {
        key1: 'value1'
      };

      const stats = await storageManager.getStats();

      expect(stats).toHaveProperty('usage');
      expect(stats).toHaveProperty('quota');
      expect(stats).toHaveProperty('percentage');
      expect(stats).toHaveProperty('available');
      expect(stats.quota).toBe(10000000);
    });
  });

  describe('clearAll', () => {
    it('should clear only app-prefixed items', () => {
      localStorageMock.data = {
        'swimlanes_item1': 'value1',
        'swimlanes_item2': 'value2',
        'other_item': 'value3'
      };

      storageManager.clearAll();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('swimlanes_item1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('swimlanes_item2');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other_item');
    });
  });

  describe('clearErrorLogs', () => {
    it('should remove error-related keys', () => {
      localStorageMock.data = {
        'error_log': 'errors',
        'app_errors': 'errors',
        'normal_key': 'value'
      };

      storageManager.clearErrorLogs();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('error_log');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('app_errors');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('normal_key');
    });
  });

  describe('clearTemporaryData', () => {
    it('should remove temporary and cache keys', () => {
      localStorageMock.data = {
        'temp_data': 'temp',
        'cache_data': 'cache',
        'permanent_data': 'permanent'
      };

      storageManager.clearTemporaryData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('temp_data');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cache_data');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('permanent_data');
    });
  });
});
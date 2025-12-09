/**
 * Global Error Handler Service
 * Provides centralized error handling, logging, and recovery mechanisms
 */
import { Logger } from '../utils/Logger.js';

export class ErrorHandler {
  static instance = null;

  constructor() {
    if (ErrorHandler.instance) {
      return ErrorHandler.instance;
    }

    this.errorLog = [];
    this.maxLogSize = 100;
    this.errorCallbacks = new Set();
    this.isInitialized = false;

    ErrorHandler.instance = this;
  }

  /**
   * Initialize global error handlers
   */
  static initialize() {
    const handler = new ErrorHandler();

    if (handler.isInitialized) {
      return handler;
    }

    // Global error handler
    window.addEventListener('error', (event) => {
      handler.handleError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'uncaught-error',
      });

      // Prevent default error handling in production
      // Check if we're in development mode (localhost or file protocol)
      const isDev =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:';
      if (!isDev) {
        event.preventDefault();
      }
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      handler.handleError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        error: event.reason,
        promise: event.promise,
        type: 'unhandled-rejection',
      });

      // Prevent default handling
      event.preventDefault();
    });

    handler.isInitialized = true;
    return handler;
  }

  /**
   * Handle an error
   * @param {Object} errorInfo - Error information
   */
  handleError(errorInfo) {
    // Log the error
    this.logError(errorInfo);

    // Notify callbacks
    this.notifyCallbacks(errorInfo);

    // Show user-friendly message
    this.showUserNotification(errorInfo);

    // Attempt recovery if possible
    this.attemptRecovery(errorInfo);
  }

  /**
   * Log error to internal log
   * @param {Object} errorInfo - Error information
   */
  logError(errorInfo) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add to log
    this.errorLog.push(logEntry);

    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Console logging in development
    const isDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'file:';
    if (isDev) {
      Logger.error('Error logged:', logEntry);
    }

    // Send to monitoring service (placeholder)
    this.sendToMonitoring(logEntry);
  }

  /**
   * Send error to monitoring service
   * @param {Object} logEntry - Log entry to send
   */
  sendToMonitoring(logEntry) {
    // In production, this would send to a service like Sentry
    // For now, just store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('errorLog') || '[]');
      errors.push(logEntry);
      // Keep only last 50 errors in localStorage
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      localStorage.setItem('errorLog', JSON.stringify(errors));
    } catch (e) {
      // Silently fail if localStorage is full or unavailable
    }
  }

  /**
   * Show user-friendly notification
   * @param {Object} errorInfo - Error information
   */
  showUserNotification(errorInfo) {
    let message = 'An error occurred. Please try again.';

    // Customize message based on error type
    if (errorInfo.type === 'validation-error') {
      message = errorInfo.message || 'Invalid input. Please check your data.';
    } else if (errorInfo.type === 'network-error') {
      message = 'Network error. Please check your connection.';
    } else if (errorInfo.type === 'file-error') {
      message = errorInfo.message || 'Error processing file.';
    }

    // Use NotificationService if available
    import('../services/NotificationService.js')
      .then(({ NotificationService }) => {
        NotificationService.show(message, { type: 'error' });
      })
      .catch(() => {
        // Fallback to alert if NotificationService not available
        Logger.error(message);
      });
  }

  /**
   * Wrap function with error handling
   * @param {Function} fn - Function to wrap
   * @param {string} context - Context description
   * @returns {Function} Wrapped function
   */
  static wrap(fn, context = 'Unknown') {
    return function (...args) {
      try {
        const result = fn.apply(this, args);

        // Handle promises
        if (result && typeof result.catch === 'function') {
          return result.catch((error) => {
            ErrorHandler.instance?.handleError({
              message: `Error in ${context}`,
              error,
              type: 'wrapped-error',
              context,
            });
            throw error;
          });
        }

        return result;
      } catch (error) {
        ErrorHandler.instance?.handleError({
          message: `Error in ${context}`,
          error,
          type: 'wrapped-error',
          context,
        });
        throw error;
      }
    };
  }

  /**
   * Create error boundary for component
   * @param {Object} component - Component to wrap
   * @returns {Object} Wrapped component
   */
  static createBoundary(component) {
    const originalMethods = {};

    // Wrap all methods
    Object.getOwnPropertyNames(Object.getPrototypeOf(component))
      .filter((name) => typeof component[name] === 'function' && name !== 'constructor')
      .forEach((name) => {
        originalMethods[name] = component[name];
        component[name] = ErrorHandler.wrap(
          component[name],
          `${component.constructor.name}.${name}`,
        );
      });

    // Add recovery method
    component.recover = () => {
      // Restore original methods
      Object.keys(originalMethods).forEach((name) => {
        component[name] = originalMethods[name];
      });
    };

    return component;
  }
}

// Export singleton instance
export default ErrorHandler;

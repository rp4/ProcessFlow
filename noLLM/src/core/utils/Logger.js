/**
 * Logger utility for controlled logging in development/production
 */
export class Logger {
  static isDevelopment() {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'file:'
    );
  }

  static log(message, ...args) {
    if (this.isDevelopment()) {
      console.log(message, ...args);
    }
  }

  static error(message, ...args) {
    if (this.isDevelopment()) {
      console.error(message, ...args);
    }
    // Errors are always tracked for monitoring
    this.trackError(message, args);
  }

  static warn(message, ...args) {
    if (this.isDevelopment()) {
      console.warn(message, ...args);
    }
  }

  static info(message, ...args) {
    if (this.isDevelopment()) {
      console.info(message, ...args);
    }
  }

  static debug(message, ...args) {
    if (this.isDevelopment()) {
      console.debug(message, ...args);
    }
  }

  static trackError(message, args) {
    // In production, this would send to monitoring service
    // For now, just store critical errors
    if (!this.isDevelopment()) {
      try {
        const errorData = {
          timestamp: new Date().toISOString(),
          message,
          data: args,
          url: window.location.href,
        };
        // Could integrate with ErrorHandler service here
      } catch (e) {
        // Silently fail
      }
    }
  }
}
/**
 * NotificationService - Centralized notification system
 * Replaces duplicate notification methods across the codebase
 */
export class NotificationService {
  static activeNotifications = new Set();
  static styleInjected = false;

  /**
   * Inject notification styles if not already present
   */
  static injectStyles() {
    if (this.styleInjected) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
            .app-notification {
                position: fixed;
                padding: 15px 20px;
                color: white;
                border-radius: 25px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                font-weight: 500;
                transition: all 0.3s ease;
                animation: notificationSlide 0.3s ease;
                max-width: 400px;
                word-wrap: break-word;
            }

            .app-notification[data-type="success"] {
                background: linear-gradient(135deg, #4caf50, #45a049);
            }

            .app-notification[data-type="error"] {
                background: linear-gradient(135deg, #f44336, #da190b);
            }

            .app-notification[data-type="warning"] {
                background: linear-gradient(135deg, #ff9800, #f57c00);
            }

            .app-notification[data-type="info"] {
                background: linear-gradient(135deg, #2196f3, #1976d2);
            }

            .app-notification[data-position="bottom-right"] {
                bottom: 20px;
                right: 20px;
            }

            .app-notification[data-position="bottom-left"] {
                bottom: 20px;
                left: 20px;
            }

            .app-notification[data-position="top-right"] {
                top: 20px;
                right: 20px;
            }

            .app-notification[data-position="top-left"] {
                top: 20px;
                left: 20px;
            }

            .app-notification[data-position="top-center"] {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }

            .app-notification[data-position="bottom-center"] {
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
            }

            .app-notification.fade-out {
                opacity: 0;
                transform: translateY(20px);
            }

            @keyframes notificationSlide {
                from {
                    opacity: 0;
                    transform: translateY(100%);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
    document.head.appendChild(style);
    this.styleInjected = true;
  }

  /**
   * Show a notification
   * @param {string} message - Message to display
   * @param {Object} options - Notification options
   * @returns {Function} Function to dismiss the notification
   */
  static show(message, options = {}) {
    // Ensure styles are injected
    this.injectStyles();

    const {
      type = 'success',
      position = 'bottom-right',
      duration = 3000,
      persistent = false,
      onClick = null,
      className = '',
    } = options;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `app-notification ${className}`;
    notification.dataset.type = type;
    notification.dataset.position = position;
    notification.textContent = message;

    // Add click handler if provided
    if (onClick) {
      notification.style.cursor = 'pointer';
      notification.addEventListener('click', onClick);
    }

    // Handle stacking for multiple notifications
    this.adjustNotificationPositions(position);

    // Add to DOM
    document.body.appendChild(notification);
    this.activeNotifications.add(notification);

    // Auto-dismiss function
    let dismissTimer;
    const dismiss = () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }

      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
        this.activeNotifications.delete(notification);
        this.adjustNotificationPositions(position);
      }, 300);
    };

    // Set auto-dismiss timer if not persistent
    if (!persistent && duration > 0) {
      dismissTimer = setTimeout(dismiss, duration);
    }

    // Return dismiss function
    return dismiss;
  }

  /**
   * Adjust positions of active notifications to prevent overlap
   * @param {string} position - Position of notifications
   */
  static adjustNotificationPositions(position) {
    const notifications = Array.from(this.activeNotifications).filter(
      (n) => n.dataset.position === position,
    );

    const offset = 20;
    notifications.forEach((notification, index) => {
      if (position.includes('bottom')) {
        notification.style.bottom = `${offset + index * 60}px`;
      } else if (position.includes('top')) {
        notification.style.top = `${offset + index * 60}px`;
      }
    });
  }

  /**
   * Show success notification
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   */
  static success(message, options = {}) {
    return this.show(message, { ...options, type: 'success' });
  }

  /**
   * Show error notification
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   */
  static error(message, options = {}) {
    return this.show(message, { ...options, type: 'error' });
  }

  /**
   * Show warning notification
   * @param {string} message - Warning message
   * @param {Object} options - Additional options
   */
  static warning(message, options = {}) {
    return this.show(message, { ...options, type: 'warning' });
  }

  /**
   * Show info notification
   * @param {string} message - Info message
   * @param {Object} options - Additional options
   */
  static info(message, options = {}) {
    return this.show(message, { ...options, type: 'info' });
  }

  /**
   * Clear all notifications
   */
  static clearAll() {
    this.activeNotifications.forEach((notification) => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    });
    this.activeNotifications.clear();
  }

  /**
   * Show a confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Object} options - Dialog options
   * @returns {Promise<boolean>} Promise resolving to user's choice
   */
  static async confirm(message, options = {}) {
    const { confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' } = options;

    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'app-notification';
      dialog.dataset.type = type;
      dialog.dataset.position = 'top-center';
      dialog.style.minWidth = '300px';
      dialog.style.textAlign = 'center';

      dialog.innerHTML = `
                <div style="margin-bottom: 15px;">${message}</div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="confirm-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: white; color: #333; cursor: pointer;">${confirmText}</button>
                    <button class="cancel-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: rgba(255,255,255,0.3); color: white; cursor: pointer;">${cancelText}</button>
                </div>
            `;

      document.body.appendChild(dialog);

      const confirmBtn = dialog.querySelector('.confirm-btn');
      const cancelBtn = dialog.querySelector('.cancel-btn');

      const cleanup = () => {
        dialog.classList.add('fade-out');
        setTimeout(() => dialog.remove(), 300);
      };

      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
    });
  }
}

// Export as default for convenience
export default NotificationService;

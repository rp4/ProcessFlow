import { Logger } from '../utils/Logger.js';

export class KeyboardManager {
  constructor(app) {
    this.app = app;
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        this.handleCtrlShortcuts(e);
      } else {
        this.handleRegularShortcuts(e);
      }
    });
  }

  handleCtrlShortcuts(e) {
    switch (e.key.toLowerCase()) {
      case 'o':
        e.preventDefault();
        document.getElementById('fileInput')?.click();
        break;
      case 's':
        e.preventDefault();
        this.app.controls.downloadJSON();
        break;
      case 'e':
        e.preventDefault();
        // downloadImage method not implemented
        Logger.warn('Export image shortcut not implemented');
        break;
      case 'l':
        e.preventDefault();
        this.app.controls.addNewLane();
        break;
      case 'n':
        e.preventDefault();
        this.app.controls.addNewNode();
        break;
      case '+':
      case '=':
        e.preventDefault();
        this.app.renderer.zoom(1.2);
        break;
      case '-':
      case '_':
        e.preventDefault();
        this.app.renderer.zoom(0.8);
        break;
      case '0':
        e.preventDefault();
        this.app.renderer.fitToScreen();
        break;
    }
  }

  handleRegularShortcuts(e) {
    switch (e.key.toLowerCase()) {
      case 'c':
        // Connection mode removed - using anchor-based connections
        break;
      case 'h':
        this.showHelp();
        break;
      case 'escape':
        this.app.editor.cancelConnection();
        break;
    }
  }

  showHelp() {
    const helpText = `
🏊 Swim Lane Diagram - Keyboard Shortcuts

File Operations:
• Ctrl+O: Open file
• Ctrl+S: Save as JSON
• Ctrl+E: Export as image

Editing:
• Ctrl+L: Add new lane
• Ctrl+N: Add new node
• C: Toggle connection mode
• Delete: Delete selected node
• Ctrl+Z: Undo
• Ctrl+Y: Redo

View:
• Ctrl+Plus: Zoom in
• Ctrl+Minus: Zoom out
• Ctrl+0: Fit to screen

Other:
• H: Show this help
• Escape: Cancel current operation
• Double-click node: Edit node
• Double-click lane: Edit lane
• Drag nodes to move them
        `;

    alert(helpText);
  }
}

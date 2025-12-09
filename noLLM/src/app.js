import { ProcessParser } from './core/utils/parser.js';
import { Logger } from './core/utils/Logger.js';
import { SwimLaneRenderer } from './components/diagram/SwimLane.js';
import { ProcessExporter } from './lib/export/exporter.js';
import { DiagramEditor } from './components/editor/Editor.js';
import { DiagramControls } from './components/controls/Controls.js';
import { KeyboardManager } from './core/services/KeyboardManager.js';
import { UrlParamsHandler } from './core/services/UrlParamsHandler.js';
import { ErrorHandler } from './core/services/ErrorHandler.js';
import { LandingPage } from './components/landing/LandingPage.js';
import { RiskDetailsModal } from './components/modals/RiskDetailsModal.js';
import storageManager from './core/services/StorageManager.js';
import { inject } from '@vercel/analytics';
import './styles/base/main.css';

class SwimLaneApp {
  constructor() {
    this.initialized = false;
    this.landingPage = null;
    this.svg = null;
    this.parser = null;
    this.renderer = null;
    this.exporter = null;
    this.editor = null;
    this.controls = null;
    this.keyboardManager = null;
    this.urlParamsHandler = null;
    this.riskDetailsModal = null;

    this.init();
  }

  initializeDiagram() {
    if (this.initialized) {
      return;
    }

    this.svg = document.getElementById('diagramSvg');
    this.parser = new ProcessParser();
    this.renderer = new SwimLaneRenderer(this.svg);
    this.exporter = new ProcessExporter();
    this.editor = new DiagramEditor(this.renderer);
    this.controls = new DiagramControls(this.renderer, this.editor, this.parser, this.exporter);

    this.keyboardManager = new KeyboardManager(this);
    this.urlParamsHandler = new UrlParamsHandler(this);
    this.riskDetailsModal = new RiskDetailsModal();

    // Listen for risk updates and re-render
    document.addEventListener('riskDetailsUpdated', (e) => {
      // Update the node with the new risk data
      if (e.detail.nodeId && e.detail.risks !== undefined) {
        this.renderer.updateNode(e.detail.nodeId, { risks: e.detail.risks });
      }
      this.editor.saveState();
    });

    // Listen for connection risk modal trigger
    document.addEventListener('connectionRiskClick', (e) => {
      if (e.detail.connection) {
        this.riskDetailsModal.show(e.detail.connection);
      }
    });

    // Listen for connection risk updates
    document.addEventListener('connectionRiskDetailsUpdated', (e) => {
      // Update the connection with the new risk data
      if (e.detail.fromId && e.detail.toId && e.detail.risks !== undefined) {
        const connection = this.renderer.findConnection(e.detail.fromId, e.detail.toId);
        if (connection) {
          connection.risks = e.detail.risks;
          Logger.debug('Connection risks updated in app.js:', {
            from: e.detail.fromId,
            to: e.detail.toId,
            risksCount: e.detail.risks.length,
            risks: e.detail.risks,
            connection: connection,
          });
          Logger.debug('Calling renderer.render with processData:', this.renderer.processData);
          // Force full render when connection risks change to ensure badges are displayed
          this.renderer.render(this.renderer.processData, { forceFull: true });
        } else {
          Logger.error('Connection not found:', e.detail.fromId, '->', e.detail.toId);
        }
      }
      this.editor.saveState();
    });

    this.keyboardManager.setupKeyboardShortcuts();

    // Clean up any stuck drop-target classes periodically
    // This handles edge cases where drag events don't fire properly
    setInterval(() => {
      const swimlanes = document.querySelectorAll('.swimlane.drop-target');
      if (swimlanes.length > 0 && !document.querySelector('[draggable="true"]:active')) {
        swimlanes.forEach(lane => lane.classList.remove('drop-target'));
      }
    }, 2000);

    this.initialized = true;
    Logger.info('🏊 Swim Lane Diagram Visualizer initialized!');
  }

  showLandingPage() {
    if (!this.landingPage) {
      const fileInput = document.getElementById('fileInput');

      // Set up the hidden file input handler
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const jsonData = JSON.parse(evt.target.result);
              this.loadDiagram(jsonData);
              if (this.landingPage) {
                this.landingPage.remove();
              }
              document.querySelector('#dropZone').style.display = 'none';
              document.querySelector('#swimlaneCanvas').style.display = 'block';
              if (this.controls) {
                this.controls.showToolbarButtons();
              }
            } catch (error) {
              Logger.error('Error parsing JSON:', error);
              alert(`Invalid JSON file: ${error.message}`);
            }
          };
          reader.readAsText(file);
          // Reset the input so the same file can be selected again
          e.target.value = '';
        }
      });

      this.landingPage = new LandingPage({
        icon: '🏊',
        title: 'Swim Lane Diagram',
        subtitle: 'Visualize and edit your process flows with complete privacy',
        showInfoButton: true,
        infoPopup: {
          title: 'Privacy & Data Storage Notice',
          icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>`,
          sections: [
            {
              icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>`,
              title: 'Browser-Based Storage',
              content:
                "This application stores all schedule data locally in your browser's localStorage. No data is ever sent to any server.",
            },
            {
              icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>`,
              title: 'What This Means',
              bullets: [
                'Your data stays on this device only',
                'Clearing browser data will delete your schedules',
                "Different browsers/devices won't share data",
                'We cannot recover lost data',
              ],
            },
          ],
        },
        fileUpload: {
          accept: '.json',
          onFileSelect: (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const jsonData = JSON.parse(e.target.result);
                this.loadDiagram(jsonData);
                this.landingPage.remove();
                document.querySelector('#dropZone').style.display = 'none';
                document.querySelector('#swimlaneCanvas').style.display = 'block';
              } catch (error) {
                alert('Invalid JSON file');
              }
            };
            reader.readAsText(file);
          },
          dragDropEnabled: true,
        },
        actions: [
          {
            label: 'Choose JSON File',
            icon: '',
            variant: 'primary',
            onClick: () => {
              fileInput.click();
            },
          },
          {
            label: 'Load Sample Process',
            variant: 'secondary',
            onClick: async () => {
              try {
                // Fetch the sample-data.json file from public directory
                const response = await fetch('/sample-data.json');
                if (!response.ok) {
                  throw new Error('Failed to load sample data');
                }
                const sampleData = await response.json();

                this.initializeDiagram();
                // Parse the sample data through the parser to ensure it's properly formatted
                const processData = this.parser.parse(sampleData);
                this.renderer.render(processData);
                this.controls.showToolbarButtons();
                this.landingPage.remove();
                document.querySelector('#dropZone').style.display = 'none';
                document.querySelector('#swimlaneCanvas').style.display = 'block';
              } catch (error) {
                Logger.error('Error loading sample process:', error);
                alert('Failed to load sample process. Please try uploading a JSON file instead.');
              }
            },
          },
        ],
        footerLinks: [
          {
            icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
            </svg>`,
            href: 'https://github.com/rp4/swim_lanes',
            title: 'GitHub Repository',
            target: '_blank',
          },
          {
            icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681v6.737zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>`,
            href: 'https://chatgpt.com',
            title: 'Run the custom GPT to create your inputs here',
            target: '_blank',
            visible: false,
          },
          {
            icon: '🏆',
            href: 'https://scoreboard.audittoolbox.com',
            title: 'See the prompt to create your inputs here',
            target: '_blank',
            visible: false,
          },
          {
            icon: '🧰',
            href: 'https://audittoolbox.com',
            title: 'Find other audit tools here',
            target: '_blank',
          },
        ],
      });

      document.body.appendChild(this.landingPage.render());
    }
    this.landingPage.show();
  }

  loadDiagram(jsonData) {
    this.initializeDiagram();
    if (this.parser && this.renderer) {
      const processData = this.parser.parse(jsonData);
      this.renderer.render(processData);
      if (this.controls) {
        this.controls.showToolbarButtons();
      }
    }
  }

  init() {
    // Initialize global error handling
    ErrorHandler.initialize();

    // Check if there are URL params to load a diagram directly
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('data') || urlParams.has('url')) {
      this.initializeDiagram();
      this.urlParamsHandler.checkUrlParams();
    } else {
      // Show landing page
      this.showLandingPage();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new SwimLaneApp();
  window.swimLaneApp = app;

  // Initialize Vercel Analytics
  inject();
});

export default SwimLaneApp;

import { NotificationService } from '../../core/services/NotificationService.js';

export class DiagramControls {
  constructor(renderer, editor, parser, exporter) {
    this.renderer = renderer;
    this.editor = editor;
    this.parser = parser;
    this.exporter = exporter;

    this.hideToolbarButtons();
    this.setupControls();
    this.setupDragAndDrop();
  }

  hideToolbarButtons() {
    // Hide all toolbar buttons initially (on landing screen)
    const toolGroups = document.querySelectorAll('.tool-group');

    toolGroups.forEach((group) => {
      group.style.display = 'none';
    });
  }

  showToolbarButtons() {
    // Show toolbar buttons when a process is loaded
    const toolGroups = document.querySelectorAll('.tool-group');

    toolGroups.forEach((group) => {
      group.style.display = 'flex';
    });
  }

  setupControls() {
    // Upload button in initial screen
    const uploadInitialBtn = document.getElementById('uploadInitialBtn');
    if (uploadInitialBtn) {
      uploadInitialBtn.addEventListener('click', () => {
        document.getElementById('fileInput').click();
      });
    }

    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files[0]);
    });

    document.getElementById('loadSampleBtn').addEventListener('click', () => {
      this.loadSampleData();
    });

    document.getElementById('addLaneBtn').addEventListener('click', () => {
      this.addNewLane();
    });

    document.getElementById('addPhaseBtn').addEventListener('click', () => {
      this.addNewPhase();
    });

    // Remove addNodeBtn listener since we're using drag and drop instead
    // Remove connectBtn listener since we're using anchor-based connections

    // Canvas interaction setup
    this.setupCanvasInteractions();

    document.getElementById('downloadJsonBtn').addEventListener('click', () => {
      this.downloadJSON();
    });

    document.addEventListener('save', (e) => {
      this.exporter.downloadJSON(e.detail);
    });
  }

  setupCanvasInteractions() {
    const canvas = document.getElementById('swimlaneCanvas');
    const svg = document.getElementById('diagramSvg');

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Get mouse position relative to SVG
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate zoom factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

      // Zoom centered on mouse position
      this.renderer.zoomAtPoint(zoomFactor, mouseX, mouseY);
    });

    // Drag to pan
    let isPanning = false;
    let startX, startY;

    svg.addEventListener('mousedown', (e) => {
      // Only start panning with left mouse button and if not clicking on interactive elements
      if (e.button === 0 && !e.target.closest('.process-node, .resize-handle')) {
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    svg.addEventListener('mousemove', (e) => {
      if (isPanning) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        this.renderer.pan(dx, dy);

        startX = e.clientX;
        startY = e.clientY;
      }
    });

    svg.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        svg.style.cursor = 'grab';
      }
    });

    svg.addEventListener('mouseleave', () => {
      if (isPanning) {
        isPanning = false;
        svg.style.cursor = 'grab';
      }
    });

    // Set initial cursor
    svg.style.cursor = 'grab';
  }

  setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const swimlaneCanvas = document.getElementById('swimlaneCanvas');

    // Original file drop zone setup
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        () => {
          dropZone.classList.add('drag-over');
        },
        false,
      );
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        () => {
          dropZone.classList.remove('drag-over');
        },
        false,
      );
    });

    dropZone.addEventListener(
      'drop',
      (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleFileUpload(files[0]);
        }
      },
      false,
    );

    dropZone.addEventListener('click', (e) => {
      // Only trigger file input if not clicking on buttons
      if (!e.target.closest('button')) {
        document.getElementById('fileInput').click();
      }
    });

    // Setup draggable Add Step button
    this.setupAddStepDragAndDrop();
  }

  setupAddStepDragAndDrop() {
    const addStepBtn = document.getElementById('addStepBtn');
    const svg = document.getElementById('diagramSvg');
    const swimlanes = document.getElementById('swimlanes');

    if (addStepBtn) {
      addStepBtn.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('node-type', 'process');
        addStepBtn.classList.add('dragging');
      });

      addStepBtn.addEventListener('dragend', (e) => {
        addStepBtn.classList.remove('dragging');
      });
    }

    // Allow dropping on swim lanes
    svg.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      // Highlight the lane being hovered over
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

      const laneGroups = swimlanes.querySelectorAll('.lane-group');
      laneGroups.forEach((laneGroup) => {
        const rect = laneGroup.querySelector('.swimlane');
        if (rect) {
          const y = parseFloat(rect.getAttribute('y'));
          const height = parseFloat(rect.getAttribute('height'));

          if (svgPoint.y >= y && svgPoint.y <= y + height) {
            rect.classList.add('drop-target');
          } else {
            rect.classList.remove('drop-target');
          }
        }
      });
    });

    svg.addEventListener('dragleave', (e) => {
      // Remove all drop target highlights
      const swimlanes = document.querySelectorAll('.swimlane');
      swimlanes.forEach((lane) => lane.classList.remove('drop-target'));
    });

    svg.addEventListener('drop', (e) => {
      e.preventDefault();

      // Always clean up all drop-target classes first
      const allSwimlanes = document.querySelectorAll('.swimlane');
      allSwimlanes.forEach((lane) => lane.classList.remove('drop-target'));

      const nodeType = e.dataTransfer.getData('node-type');
      if (!nodeType) {
        return;
      }

      // Get drop position in SVG coordinates
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

      // Find which lane was dropped on
      const laneGroups = swimlanes.querySelectorAll('.lane-group');
      let targetLaneId = null;

      laneGroups.forEach((laneGroup) => {
        const rect = laneGroup.querySelector('.swimlane');
        if (rect) {
          const y = parseFloat(rect.getAttribute('y'));
          const height = parseFloat(rect.getAttribute('height'));

          if (svgPoint.y >= y && svgPoint.y <= y + height) {
            targetLaneId = laneGroup.getAttribute('data-lane-id');
          }
        }
      });

      if (targetLaneId && this.renderer.processData) {
        const laneId = targetLaneId;

        // Create the node at the drop position
        const nodeText = this.getDefaultNodeText(nodeType);
        this.editor.saveState();

        // Add node with x position only (y is determined by the lane)
        const node = this.renderer.addNode(laneId, nodeType, nodeText, svgPoint.x);
        NotificationService.success(`${nodeType} node added to lane!`);
      }
    });

    // Clean up drop-target on drag end (covers cases when drop doesn't occur)
    document.addEventListener('dragend', () => {
      const allSwimlanes = document.querySelectorAll('.swimlane');
      allSwimlanes.forEach((lane) => lane.classList.remove('drop-target'));
    });
  }

  getDefaultNodeText(nodeType) {
    switch (nodeType) {
      case 'start':
        return 'Start';
      case 'end':
        return 'End';
      case 'decision':
        return 'Decision';
      default:
        return 'New Step';
    }
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleFileUpload(file) {
    try {
      // Validate file before processing
      const { ValidationService } = await import('../../core/services/ValidationService.js');
      ValidationService.validateFileUpload(file);

      const processData = await this.parser.loadFromFile(file);
      this.displayDiagram(processData);
      NotificationService.success('Process loaded successfully!');
    } catch (error) {
      NotificationService.error(error.message);
    }
  }

  loadSampleData() {
    const sampleData = this.parser.generateSampleProcess();
    this.displayDiagram(sampleData);
    NotificationService.success('Sample process loaded!');
  }

  displayDiagram(processData) {
    document.getElementById('dropZone').style.display = 'none';
    document.getElementById('swimlaneCanvas').style.display = 'block';

    this.showToolbarButtons();
    this.renderer.render(processData);
    this.editor.saveState();
  }

  addNewLane() {
    const name = prompt('Enter lane name:');
    if (name) {
      this.editor.saveState();
      const lane = this.renderer.addLane(name);
      NotificationService.success(`Lane "${name}" added!`);
    }
  }

  addNewPhase() {
    const name = prompt('Enter phase name (e.g., Planning, Execution, Review):');
    if (name) {
      // Ask for phase length in terms of number of circles (buoys)
      const lengthInput = prompt('How many circles should this phase have? (3-20):', '10');
      if (lengthInput && !isNaN(lengthInput)) {
        const numCircles = Math.max(3, Math.min(20, parseInt(lengthInput)));

        // Calculate position based on existing phases
        const phases = this.renderer.processData?.phases || [];
        let startPosition = 20; // Start from the left edge

        if (phases.length > 0) {
          // Find the maximum position (end of last phase)
          const maxPosition = Math.max(...phases.map((p) => p.position));
          startPosition = maxPosition;
        }

        // Each circle is 40 pixels apart, so calculate the end position
        const phaseLength = numCircles * 40;
        const endPosition = startPosition + phaseLength; // No cap - let it extend as needed

        this.editor.saveState();
        const phase = this.renderer.addPhase(name, endPosition);
        NotificationService.success(`Phase "${name}" added with ${numCircles} circles!`);
      }
    }
  }

  addNewNode() {
    if (!this.renderer.processData || this.renderer.processData.lanes.length === 0) {
      alert('Please add a lane first or load a process');
      return;
    }

    const lanes = this.renderer.processData.lanes;
    const laneOptions = lanes.map((l) => `${l.name}`).join('\n');
    const laneIndex = prompt(
      `Select lane (enter number):\n${lanes.map((l, i) => `${i + 1}. ${l.name}`).join('\n')}`,
    );

    if (laneIndex && !isNaN(laneIndex)) {
      const selectedLane = lanes[parseInt(laneIndex) - 1];
      if (selectedLane) {
        const nodeText = prompt('Enter node text:') || 'New Node';
        const nodeType = prompt('Enter node type (process/start/end/decision):') || 'process';

        this.editor.saveState();
        const node = this.renderer.addNode(selectedLane.id, nodeType, nodeText);
        NotificationService.success('Node added!');
      }
    }
  }

  // Connection mode removed - using anchor-based connections instead

  downloadJSON() {
    const processData = this.renderer.getProcessData();
    if (processData) {
      const filename =
        prompt('Enter filename:', 'swimlane-process.json') || 'swimlane-process.json';
      this.exporter.downloadJSON(processData, filename);
      NotificationService.success('JSON downloaded!');
    } else {
      alert('No diagram to export');
    }
  }

  // showNotification method removed - using NotificationService instead
}

window.DiagramControls = DiagramControls;

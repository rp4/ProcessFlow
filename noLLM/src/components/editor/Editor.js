import { NotificationService } from '../../core/services/NotificationService.js';
import { throttleRAF, debounce } from '../../core/utils/rateLimiter.js';

export class DiagramEditor {
  constructor(renderer) {
    this.renderer = renderer;
    this.svg = renderer.svg;
    this.isDragging = false;
    this.draggedNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isConnecting = false;
    this.connectionStart = null;
    this.connectionPreview = null;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;
    // Store bound handlers for cleanup
    this.boundHandlers = {};

    // Create throttled versions of performance-critical methods
    this.throttledDragNode = throttleRAF(this.dragNodeImpl.bind(this));
    this.debouncedSaveState = debounce(this.saveState.bind(this), 500);

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Bind handlers and store references
    this.boundHandlers.handleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandlers.handleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandlers.handleMouseUp = this.handleMouseUp.bind(this);
    this.boundHandlers.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.boundHandlers.handleAnchorClick = this.handleAnchorClick.bind(this);
    this.boundHandlers.handleKeyDown = this.handleKeyDown.bind(this);

    // Add event listeners
    this.svg.addEventListener('mousedown', this.boundHandlers.handleMouseDown);
    this.svg.addEventListener('mousemove', this.boundHandlers.handleMouseMove);
    this.svg.addEventListener('mouseup', this.boundHandlers.handleMouseUp);
    this.svg.addEventListener('dblclick', this.boundHandlers.handleDoubleClick);
    this.svg.addEventListener('click', this.boundHandlers.handleAnchorClick);
    document.addEventListener('keydown', this.boundHandlers.handleKeyDown);
  }

  getSVGPoint(e) {
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.getAttribute('viewBox');

    if (viewBox) {
      const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
      const scaleX = vw / rect.width;
      const scaleY = vh / rect.height;

      return {
        x: vx + (e.clientX - rect.left) * scaleX,
        y: vy + (e.clientY - rect.top) * scaleY,
      };
    } else {
      const point = this.svg.createSVGPoint();
      point.x = e.clientX - rect.left;
      point.y = e.clientY - rect.top;
      const svgPoint = point.matrixTransform(this.svg.getScreenCTM().inverse());
      return { x: svgPoint.x, y: svgPoint.y };
    }
  }

  handleMouseDown(e) {
    // Don't start dragging if clicking on an anchor
    if (e.target.classList.contains('connection-anchor')) {
      return;
    }

    const target = e.target.closest('.process-node');
    if (target && !this.isConnecting) {
      this.startDragging(e, target);
    }

    // Resize handle removed - no longer needed
  }

  handleAnchorClick(e) {
    if (!e.target.classList.contains('connection-anchor')) {
      return;
    }

    e.stopPropagation();
    const anchor = e.target;
    const nodeId = anchor.getAttribute('data-node-id');

    if (!this.isConnecting) {
      // Start connection
      this.startConnecting(nodeId);
      this.connectionStartAnchor = anchor;

      // Create connection preview line
      this.connectionPreview = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.connectionPreview.setAttribute('stroke', '#2196f3');
      this.connectionPreview.setAttribute('stroke-width', '2');
      this.connectionPreview.setAttribute('stroke-dasharray', '5,5');
      this.connectionPreview.setAttribute('x1', anchor.getAttribute('cx'));
      this.connectionPreview.setAttribute('y1', anchor.getAttribute('cy'));
      this.connectionPreview.setAttribute('x2', anchor.getAttribute('cx'));
      this.connectionPreview.setAttribute('y2', anchor.getAttribute('cy'));
      this.connectionPreview.style.pointerEvents = 'none';

      this.renderer.connectionsGroup.appendChild(this.connectionPreview);

      // Visual feedback
      anchor.style.fill = '#1976d2';
      NotificationService.info('Click on another anchor to complete the connection');
    } else {
      // Complete connection if different node
      const startNodeId = this.connectionStart;
      if (nodeId !== startNodeId) {
        this.completeConnection(nodeId);

        // Reset anchor styles
        if (this.connectionStartAnchor) {
          this.connectionStartAnchor.style.fill = '#2196f3';
        }
      } else {
        // Cancel if same node
        this.cancelConnection();
      }
    }
  }

  // showNotification method removed - using NotificationService instead

  handleMouseMove(e) {
    if (this.isDragging && this.draggedNode) {
      this.dragNode(e);
    } else if (this.isConnecting && this.connectionPreview) {
      this.updateConnectionPreview(e);
    }
  }

  updateConnectionPreview(e) {
    if (!this.connectionPreview) {
      return;
    }

    const point = this.getSVGPoint(e);
    this.connectionPreview.setAttribute('x2', point.x);
    this.connectionPreview.setAttribute('y2', point.y);
  }

  handleMouseUp(e) {
    if (this.isDragging) {
      this.stopDragging();
    }
  }

  handleDoubleClick(e) {
    const nodeElement = e.target.closest('.process-node');
    if (nodeElement) {
      const nodeId = nodeElement.getAttribute('data-node-id');
      this.editNode(nodeId);
      return;
    }

    const edgeElement = e.target.closest('.connection-line');
    if (edgeElement) {
      const fromId = edgeElement.getAttribute('data-from');
      const toId = edgeElement.getAttribute('data-to');
      this.editEdge(fromId, toId);
      return;
    }

    const labelElement = e.target.closest('.connection-label');
    if (labelElement) {
      const fromId = labelElement.getAttribute('data-from');
      const toId = labelElement.getAttribute('data-to');
      this.editEdge(fromId, toId);
      return;
    }

    const laneElement = e.target.closest('.swimlane');
    if (laneElement && !nodeElement) {
      const laneId = laneElement.parentElement.getAttribute('data-lane-id');
      this.editLane(laneId);
      return;
    }

    const phaseElement = e.target.closest('.phase-label, .phase-divider-group');
    if (phaseElement) {
      const phaseGroup = phaseElement.closest('.phase-divider-group') || phaseElement;
      const phaseId = phaseGroup.getAttribute('data-phase-id');
      this.editPhase(phaseId);
    }
  }

  handleKeyDown(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          this.undo();
          break;
        case 'y':
          e.preventDefault();
          this.redo();
          break;
        case 's':
          e.preventDefault();
          this.save();
          break;
      }
    }

    if (e.key === 'Delete' && this.renderer.selectedNode) {
      this.deleteSelectedNode();
    }
  }

  startDragging(e, nodeElement) {
    this.saveState();
    this.isDragging = true;
    this.draggedNode = nodeElement;
    const nodeId = nodeElement.getAttribute('data-node-id');
    const node = this.renderer.findNode(nodeId);

    const svgPoint = this.getSVGPoint(e);

    this.dragOffset = {
      x: svgPoint.x - node.position.x,
      y: svgPoint.y - node.position.y,
    };

    nodeElement.classList.add('node-dragging');
  }

  dragNode(e) {
    // Use throttled version for better performance
    this.throttledDragNode(e);
  }

  dragNodeImpl(e) {
    if (!this.draggedNode) {
      return;
    }

    const nodeId = this.draggedNode.getAttribute('data-node-id');
    const node = this.renderer.findNode(nodeId);

    const svgPoint = this.getSVGPoint(e);

    // Update node position
    node.position.x = svgPoint.x - this.dragOffset.x;
    node.position.y = svgPoint.y - this.dragOffset.y;

    // Check if node moved to a different lane
    const currentLaneId = this.draggedNode.getAttribute('data-lane-id');
    const newLaneId = this.getLaneAtPosition(node.position.y);
    if (newLaneId && newLaneId !== currentLaneId) {
      this.moveNodeToLane(nodeId, newLaneId);
      // Update the data attribute after moving
      this.draggedNode.setAttribute('data-lane-id', newLaneId);
    }

    // Ensure dragging class is set before render
    this.draggedNode.classList.add('node-dragging');

    // Use differential rendering for better performance
    this.renderer.render(this.renderer.processData, { forceFull: false });

    // Update reference if element was replaced during render
    const currentNode = this.svg.querySelector(`[data-node-id="${nodeId}"]`);
    if (currentNode && currentNode !== this.draggedNode) {
      this.draggedNode = currentNode;
      this.draggedNode.classList.add('node-dragging');
    }
  }

  stopDragging() {
    if (this.draggedNode) {
      this.draggedNode.classList.remove('node-dragging');
    }
    this.isDragging = false;
    this.draggedNode = null;
    this.dragOffset = { x: 0, y: 0 };
  }

  getLaneAtPosition(y) {
    for (const lane of this.renderer.processData.lanes) {
      if (y >= lane.y && y <= lane.y + (lane.height || 140)) {
        return lane.id;
      }
    }
    return null;
  }

  moveNodeToLane(nodeId, newLaneId) {
    const processData = this.renderer.processData;
    let node = null;
    let oldLaneId = null;

    for (const lane of processData.lanes) {
      const nodeIndex = lane.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex !== -1) {
        node = lane.nodes[nodeIndex];
        oldLaneId = lane.id;
        lane.nodes.splice(nodeIndex, 1);
        break;
      }
    }

    if (node) {
      const newLane = processData.lanes.find((l) => l.id === newLaneId);
      if (newLane) {
        newLane.nodes.push(node);
      }
    }
  }

  startConnecting(fromNodeId) {
    this.isConnecting = true;
    this.connectionStart = fromNodeId;

    const fromNode = this.renderer.findNode(fromNodeId);
    if (fromNode) {
      this.connectionPreview = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.connectionPreview.classList.add('connection-preview');
      this.connectionPreview.setAttribute('x1', fromNode.position.x);
      this.connectionPreview.setAttribute('y1', fromNode.position.y);
      this.connectionPreview.setAttribute('x2', fromNode.position.x);
      this.connectionPreview.setAttribute('y2', fromNode.position.y);
      this.renderer.connectionsGroup.appendChild(this.connectionPreview);
    }
  }

  completeConnection(toNodeId) {
    if (this.connectionStart && toNodeId && this.connectionStart !== toNodeId) {
      this.saveState();
      const label = prompt('Enter connection label (optional):');
      this.renderer.addConnection(this.connectionStart, toNodeId, label || '');
    }

    this.cancelConnection();
  }

  cancelConnection() {
    this.isConnecting = false;
    this.connectionStart = null;
    if (this.connectionPreview) {
      this.connectionPreview.remove();
      this.connectionPreview = null;
    }
    if (this.connectionStartAnchor) {
      this.connectionStartAnchor.style.fill = '#2196f3';
      this.connectionStartAnchor = null;
    }
  }

  editNode(nodeId) {
    const node = this.renderer.findNode(nodeId);
    if (!node) {
      return;
    }

    const modal = document.getElementById('nodeModal');
    const nodeText = document.getElementById('nodeText');
    const nodeDescription = document.getElementById('nodeDescription');

    nodeText.value = node.text;
    nodeDescription.value = node.description || '';

    modal.style.display = 'flex';
    this.renderer.selectedNode = nodeId;

    const saveBtn = document.getElementById('saveNodeBtn');
    const deleteBtn = document.getElementById('deleteNodeBtn');
    const cancelBtn = document.getElementById('cancelNodeBtn');
    const addRiskBtn = document.getElementById('addRiskBtn');
    const closeBtn = modal.querySelector('.close-btn');

    const saveHandler = () => {
      this.saveState();
      this.renderer.updateNode(nodeId, {
        text: nodeText.value,
        description: nodeDescription.value,
        // Keep existing type - don't allow editing
        type: node.type,
        // Don't save color - it should be determined by type
        // color: nodeColor.value,
        icon: this.renderer.getNodeIcon(node.type),
      });
      modal.style.display = 'none';
      this.cleanup();
    };

    const deleteHandler = () => {
      if (confirm('Are you sure you want to delete this node?')) {
        this.saveState();
        this.renderer.deleteNode(nodeId);
        modal.style.display = 'none';
        this.cleanup();
      }
    };

    const addRiskHandler = () => {
      // Save current node values first
      this.renderer.updateNode(nodeId, {
        text: nodeText.value,
        description: nodeDescription.value,
        type: node.type,
        icon: this.renderer.getNodeIcon(node.type),
      });

      // Hide the node modal
      modal.style.display = 'none';

      // Show the risk modal for this node by dispatching event
      const updatedNode = this.renderer.findNode(nodeId);
      const showEvent = new CustomEvent('riskBadgeClick', {
        detail: { node: updatedNode },
      });
      document.dispatchEvent(showEvent);

      // The global handler in app.js will handle the update
    };

    const cancelHandler = () => {
      modal.style.display = 'none';
      this.cleanup();
    };

    const cleanup = () => {
      saveBtn.removeEventListener('click', saveHandler);
      deleteBtn.removeEventListener('click', deleteHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
      addRiskBtn.removeEventListener('click', addRiskHandler);
      closeBtn.removeEventListener('click', cancelHandler);
      this.renderer.selectedNode = null;
    };

    this.cleanup = cleanup;

    saveBtn.addEventListener('click', saveHandler);
    deleteBtn.addEventListener('click', deleteHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    addRiskBtn.addEventListener('click', addRiskHandler);
    closeBtn.addEventListener('click', cancelHandler);
  }

  editLane(laneId) {
    const lane = this.renderer.findLane(laneId);
    if (!lane) {
      return;
    }

    const modal = document.getElementById('laneModal');
    const laneName = document.getElementById('laneName');
    const laneNumber = document.getElementById('laneNumber');

    laneName.value = lane.name;

    // Set the current lane position (1-based for user)
    const lanes = this.renderer.processData.lanes;
    const currentPosition = lanes.findIndex((l) => l.id === laneId) + 1;
    laneNumber.value = currentPosition;
    laneNumber.max = lanes.length;

    modal.style.display = 'flex';
    this.renderer.selectedLane = laneId;

    const saveBtn = document.getElementById('saveLaneBtn');
    const deleteBtn = document.getElementById('deleteLaneBtn');
    const cancelBtn = document.getElementById('cancelLaneBtn');
    const closeBtn = modal.querySelector('.close-btn');

    const saveHandler = () => {
      this.saveState();
      lane.name = laneName.value;
      // Lane color is now automatically assigned, not user-editable

      // Handle lane reordering
      const newPosition = parseInt(laneNumber.value) - 1; // Convert to 0-based index
      const currentPosition = lanes.findIndex((l) => l.id === laneId);

      if (newPosition !== currentPosition && newPosition >= 0 && newPosition < lanes.length) {
        // Remove lane from current position
        const [movedLane] = lanes.splice(currentPosition, 1);
        // Insert at new position
        lanes.splice(newPosition, 0, movedLane);
        NotificationService.success(`Lane moved to position ${newPosition + 1}`);
        // Force full render when lanes are reordered
        this.renderer.render(this.renderer.processData, { forceFull: true });
      } else {
        // Regular render for name changes only
        this.renderer.render(this.renderer.processData);
      }
      modal.style.display = 'none';
      this.cleanup();
    };

    const deleteHandler = () => {
      if (confirm('Are you sure you want to delete this lane and all its nodes?')) {
        this.saveState();
        this.renderer.deleteLane(laneId);
        modal.style.display = 'none';
        this.cleanup();
      }
    };

    const cancelHandler = () => {
      modal.style.display = 'none';
      this.cleanup();
    };

    const cleanup = () => {
      saveBtn.removeEventListener('click', saveHandler);
      deleteBtn.removeEventListener('click', deleteHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
      closeBtn.removeEventListener('click', cancelHandler);
      this.renderer.selectedLane = null;
    };

    this.cleanup = cleanup;

    saveBtn.addEventListener('click', saveHandler);
    deleteBtn.addEventListener('click', deleteHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    closeBtn.addEventListener('click', cancelHandler);
  }

  editPhase(phaseId) {
    const phase = this.renderer.findPhase(phaseId);
    if (!phase) {
      return;
    }

    const modal = document.getElementById('phaseModal');
    const phaseName = document.getElementById('phaseName');
    const phaseLength = document.getElementById('phaseLength');
    const phasePosition = document.getElementById('phasePosition'); // Hidden field

    phaseName.value = phase.name;

    // Calculate the phase length in circles based on its position and the previous phase
    const phases = this.renderer.processData?.phases || [];
    const sortedPhases = [...phases].sort((a, b) => a.position - b.position);
    const phaseIndex = sortedPhases.findIndex((p) => p.id === phaseId);

    let phaseStart = 20; // Default start
    if (phaseIndex > 0) {
      phaseStart = sortedPhases[phaseIndex - 1].position;
    }

    const phaseLengthPixels = phase.position - phaseStart;
    const numCircles = Math.max(3, Math.round(phaseLengthPixels / 40));

    phaseLength.value = numCircles;
    phasePosition.value = phase.position; // Store actual position

    modal.style.display = 'flex';
    this.renderer.selectedPhase = phaseId;

    const saveBtn = document.getElementById('savePhaseBtn');
    const deleteBtn = document.getElementById('deletePhaseBtn');
    const cancelBtn = document.getElementById('cancelPhaseBtn');
    const closeBtn = modal.querySelector('.close-btn');

    const saveHandler = () => {
      this.saveState();

      // Calculate new position based on phase length
      const newNumCircles = parseInt(phaseLength.value);
      const phaseStart = phaseIndex > 0 ? sortedPhases[phaseIndex - 1].position : 20;
      const newPosition = phaseStart + newNumCircles * 40;

      this.renderer.updatePhase(phaseId, {
        name: phaseName.value,
        position: newPosition,
      });
      modal.style.display = 'none';
      this.cleanup();
      NotificationService.success('Phase updated!');
    };

    const deleteHandler = () => {
      if (confirm('Are you sure you want to delete this phase?')) {
        this.saveState();
        this.renderer.deletePhase(phaseId);
        modal.style.display = 'none';
        this.cleanup();
        NotificationService.success('Phase deleted!');
      }
    };

    const cancelHandler = () => {
      modal.style.display = 'none';
      this.cleanup();
    };

    const cleanup = () => {
      saveBtn.removeEventListener('click', saveHandler);
      deleteBtn.removeEventListener('click', deleteHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
      closeBtn.removeEventListener('click', cancelHandler);
      this.renderer.selectedPhase = null;
    };

    this.cleanup = cleanup;

    saveBtn.addEventListener('click', saveHandler);
    deleteBtn.addEventListener('click', deleteHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    closeBtn.addEventListener('click', cancelHandler);
  }

  editEdge(fromId, toId) {
    const connection = this.renderer.findConnection(fromId, toId);
    if (!connection) {
      return;
    }

    const modal = document.getElementById('edgeModal');
    const edgeLabel = document.getElementById('edgeLabel');

    edgeLabel.value = connection.label || '';

    modal.style.display = 'flex';
    this.currentEdge = { fromId, toId };

    const saveBtn = document.getElementById('saveEdgeBtn');
    const deleteBtn = document.getElementById('deleteEdgeBtn');
    const cancelBtn = document.getElementById('cancelEdgeBtn');
    const addRiskBtn = document.getElementById('addEdgeRiskBtn');
    const closeBtn = modal.querySelector('.close-btn');

    const saveHandler = () => {
      this.saveState();
      this.renderer.updateConnection(fromId, toId, edgeLabel.value);
      modal.style.display = 'none';
      this.cleanup();
    };

    const deleteHandler = () => {
      if (confirm('Are you sure you want to delete this connection?')) {
        this.saveState();
        this.renderer.deleteConnection(fromId, toId);
        modal.style.display = 'none';
        this.cleanup();
      }
    };

    const cancelHandler = () => {
      modal.style.display = 'none';
      this.cleanup();
    };

    const riskHandler = () => {
      // Save the current label value first
      this.renderer.updateConnection(fromId, toId, edgeLabel.value);

      // Close the Edit Connection modal
      modal.style.display = 'none';

      // Get the updated connection with the latest data
      const updatedConnection = this.renderer.findConnection(fromId, toId);

      // Get the actual node names
      const fromNode = this.renderer.findNode(fromId);
      const toNode = this.renderer.findNode(toId);
      const fromName = fromNode ? fromNode.text : fromId;
      const toName = toNode ? toNode.text : toId;

      // Create a connection object that looks like a node for the risk modal
      const connectionAsNode = {
        id: `connection_${fromId}_${toId}`,
        text: `Connection: ${fromName} → ${toName}`,
        type: 'connection',
        risks: updatedConnection.risks || [],
        isConnection: true,
        fromId,
        toId,
        label: updatedConnection.label,
      };

      // Dispatch event to show risk modal (handled by app.js)
      const showEvent = new CustomEvent('connectionRiskClick', {
        detail: { connection: connectionAsNode },
      });
      document.dispatchEvent(showEvent);

      // Clean up the Edit Connection modal event listeners
      this.cleanup();
    };

    const cleanup = () => {
      saveBtn.removeEventListener('click', saveHandler);
      deleteBtn.removeEventListener('click', deleteHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
      addRiskBtn.removeEventListener('click', riskHandler);
      closeBtn.removeEventListener('click', cancelHandler);
      this.currentEdge = null;
    };

    this.cleanup = cleanup;

    saveBtn.addEventListener('click', saveHandler);
    deleteBtn.addEventListener('click', deleteHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    addRiskBtn.addEventListener('click', riskHandler);
    closeBtn.addEventListener('click', cancelHandler);
  }

  // Lane reorder menu methods removed - now handled through Lane Number field in edit form

  saveState() {
    const state = JSON.stringify(this.renderer.processData);

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(state);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = JSON.parse(this.history[this.historyIndex]);
      this.renderer.render(state);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = JSON.parse(this.history[this.historyIndex]);
      this.renderer.render(state);
    }
  }

  save() {
    const event = new CustomEvent('save', { detail: this.renderer.processData });
    document.dispatchEvent(event);
  }

  deleteSelectedNode() {
    if (this.renderer.selectedNode) {
      this.saveState();
      this.renderer.deleteNode(this.renderer.selectedNode);
      this.renderer.selectedNode = null;
    }
  }

  destroy() {
    // Remove all event listeners
    if (this.boundHandlers) {
      this.svg.removeEventListener('mousedown', this.boundHandlers.handleMouseDown);
      this.svg.removeEventListener('mousemove', this.boundHandlers.handleMouseMove);
      this.svg.removeEventListener('mouseup', this.boundHandlers.handleMouseUp);
      this.svg.removeEventListener('dblclick', this.boundHandlers.handleDoubleClick);
      this.svg.removeEventListener('click', this.boundHandlers.handleAnchorClick);
      document.removeEventListener('keydown', this.boundHandlers.handleKeyDown);
    }

    // Clean up any active connections
    this.cancelConnection();

    // Clean up any open modals
    if (this.cleanup) {
      this.cleanup();
    }

    // Clear references
    this.svg = null;
    this.renderer = null;
    this.boundHandlers = null;
  }
}

window.DiagramEditor = DiagramEditor;

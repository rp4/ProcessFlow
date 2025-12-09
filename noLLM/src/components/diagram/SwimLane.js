import { Theme } from '../../core/config/theme.js';
import { Logger } from '../../core/utils/Logger.js';

export class SwimLaneRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.swimlanesGroup = this.svg.querySelector('#swimlanes');
    this.phasesGroup = this.svg.querySelector('#phases');
    this.nodesGroup = this.svg.querySelector('#nodes');
    this.connectionsGroup = this.svg.querySelector('#connections');
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.processData = null;
    this.selectedNode = null;
    this.selectedLane = null;
    this.selectedPhase = null;

    // Event delegation for tooltips to prevent memory leaks
    this.tooltipElement = null;
    this.setupEventDelegation();

    // Path cache for performance
    this.pathCache = new Map();
    this.maxCacheSize = 100;

    // Arrow marker removed - edges will display without arrows
  }

  setupEventDelegation() {
    // Single delegated listener for all tooltips - prevents memory leaks
    this.nodesGroup.addEventListener(
      'mouseenter',
      (e) => {
        const nodeGroup = e.target.closest('.process-node');
        if (nodeGroup && nodeGroup.dataset.description) {
          this.showTooltip(e, nodeGroup.dataset.description);
        }
      },
      true,
    );

    this.nodesGroup.addEventListener(
      'mouseleave',
      (e) => {
        if (e.target.closest('.process-node')) {
          this.hideTooltip();
        }
      },
      true,
    );

    this.nodesGroup.addEventListener(
      'mousemove',
      (e) => {
        if (this.tooltipElement && this.tooltipElement.style.display === 'block') {
          this.tooltipElement.style.left = `${e.clientX + 10}px`;
          this.tooltipElement.style.top = `${e.clientY - 30}px`;
        }
      },
      true,
    );
  }

  showTooltip(e, description) {
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className = 'node-tooltip';
      document.body.appendChild(this.tooltipElement);
    }

    this.tooltipElement.textContent = description;
    this.tooltipElement.style.left = `${e.clientX + 10}px`;
    this.tooltipElement.style.top = `${e.clientY - 30}px`;
    this.tooltipElement.style.display = 'block';
  }

  hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
    }
  }

  addNodeTooltip(nodeGroup, node) {
    // Now just add data attribute for event delegation
    if (node.description && node.description.trim() !== '') {
      nodeGroup.dataset.description = node.description;
    }
  }

  // Helper to create SVG elements more efficiently
  createSVGElement(type) {
    return document.createElementNS('http://www.w3.org/2000/svg', type);
  }

  // Shared method for creating risk badges for both nodes and connections
  createRiskBadge(x, y, risk, index, totalRisks) {
    const hasControl =
      (risk.controls && risk.controls.length > 0) ||
      (risk.controlIds && risk.controlIds.length > 0);

    const badgeGroup = this.createSVGElement('g');
    badgeGroup.classList.add('risk-badge');
    badgeGroup.dataset.riskId = risk.id;

    // Position badges in a row above the node (relative to node center)
    const badgeSpacing = 30;
    const startX = x - ((totalRisks - 1) * badgeSpacing) / 2;
    const badgeX = startX + index * badgeSpacing;
    const badgeY = y - 45; // Position above the node center

    // Create warning triangle
    const warningPath = this.createSVGElement('path');
    const size = 12;
    const trianglePath = `M ${badgeX} ${badgeY - size} L ${badgeX + size} ${badgeY + size} L ${badgeX - size} ${badgeY + size} Z`;
    warningPath.setAttribute('d', trianglePath);
    warningPath.setAttribute('fill', hasControl ? '#ff9800' : '#f44336');

    // Create exclamation mark
    const exclamationDot = this.createSVGElement('circle');
    exclamationDot.setAttribute('cx', badgeX);
    exclamationDot.setAttribute('cy', badgeY + 5);
    exclamationDot.setAttribute('r', '1.5');
    exclamationDot.setAttribute('fill', 'white');

    const exclamationLine = this.createSVGElement('rect');
    exclamationLine.setAttribute('x', badgeX - 1.5);
    exclamationLine.setAttribute('y', badgeY - 5);
    exclamationLine.setAttribute('width', '3');
    exclamationLine.setAttribute('height', '7');
    exclamationLine.setAttribute('fill', 'white');

    // Add tooltip
    const title = this.createSVGElement('title');
    const controlCount = risk.controls ? risk.controls.length : 0;
    const controlStatus = hasControl ? `Controls: ${controlCount} active` : 'No controls';
    const levelText = risk.level ? `[${risk.level.toUpperCase()}]` : '';
    title.textContent = `${risk.text}\n${levelText}\n${controlStatus}\n${risk.description || 'Click for details'}`;

    badgeGroup.appendChild(title);
    badgeGroup.appendChild(warningPath);
    badgeGroup.appendChild(exclamationLine);
    badgeGroup.appendChild(exclamationDot);
    badgeGroup.style.cursor = 'pointer';

    return badgeGroup;
  }

  addRiskBadge(nodeGroup, x, y, node) {
    Logger.debug(`Adding risk badges for node ${node.id} at position (${x}, ${y}) with ${node.risks.length} risks`);

    // Create a container for all risk badges
    const risksContainer = this.createSVGElement('g');
    risksContainer.classList.add('risks-container');

    // Create individual badge for each risk using shared method
    node.risks.forEach((risk, index) => {
      Logger.debug(`Creating risk badge ${index + 1}/${node.risks.length} for risk: ${risk.text}`);
      const badgeGroup = this.createRiskBadge(x, y, risk, index, node.risks.length);

      // Add click handler specific to nodes
      badgeGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        const event = new CustomEvent('riskBadgeClick', {
          detail: {
            node,
            risk,
            allRisks: node.risks,
            allControls: node.controls || [],
          },
        });
        document.dispatchEvent(event);
      });

      risksContainer.appendChild(badgeGroup);
    });

    nodeGroup.appendChild(risksContainer);
  }

  addConnectionAnchors(nodeGroup, x, y, nodeId) {
    const anchors = [
      { x: x + 35, y, position: 'right' },
      { x: x - 35, y, position: 'left' },
    ];

    anchors.forEach((anchor) => {
      const anchorCircle = this.createSVGElement('circle');
      anchorCircle.setAttribute('cx', anchor.x);
      anchorCircle.setAttribute('cy', anchor.y);
      anchorCircle.setAttribute('r', '8');
      anchorCircle.classList.add('connection-anchor');
      anchorCircle.setAttribute('data-node-id', nodeId);
      anchorCircle.setAttribute('data-position', anchor.position);
      anchorCircle.style.opacity = '0';
      anchorCircle.style.fill = '#2196f3';
      anchorCircle.style.stroke = 'white';
      anchorCircle.style.strokeWidth = '2';
      anchorCircle.style.cursor = 'crosshair';
      anchorCircle.style.transition = 'opacity 0.2s';

      nodeGroup.appendChild(anchorCircle);
    });

    // Show anchors on hover
    const handleAnchorShow = () => {
      const anchors = nodeGroup.querySelectorAll('.connection-anchor');
      anchors.forEach((a) => (a.style.opacity = '0.8'));
    };

    const handleAnchorHide = () => {
      const anchors = nodeGroup.querySelectorAll('.connection-anchor');
      anchors.forEach((a) => (a.style.opacity = '0'));
    };

    nodeGroup.addEventListener('mouseenter', handleAnchorShow);
    nodeGroup.addEventListener('mouseleave', handleAnchorHide);

    // Store handlers for cleanup
    nodeGroup._anchorHandlers = { handleAnchorShow, handleAnchorHide };
  }

  // Arrow marker method removed - edges will display without arrows

  // Lane divider method removed - now handled in renderPhases()

  render(processData, options = {}) {
    const forceFull = options.forceFull || false;
    const previousData = this.processData;
    this.processData = processData;

    // Initialize phases array if not present
    if (!this.processData.phases) {
      this.processData.phases = [];
    }

    // Initialize connections array if not present
    if (!this.processData.connections) {
      this.processData.connections = [];
    }

    // Perform differential rendering if possible
    if (!forceFull && previousData && this.canUseDifferentialRender(previousData, processData)) {
      this.renderDifferential(previousData, processData);
    } else {
      // Full render for major structural changes
      this.clear();
      this.renderSwimLanes();
      this.renderPhases();
      this.renderNodes();
      this.renderConnections();
    }
    this.fitToScreen();
  }

  canUseDifferentialRender(oldData, newData) {
    // Check if we can use differential rendering
    if (!oldData || !newData) {
      return false;
    }
    if (oldData.lanes.length !== newData.lanes.length) {
      return false;
    }
    if ((oldData.phases?.length || 0) !== (newData.phases?.length || 0)) {
      return false;
    }
    return true;
  }

  renderDifferential(oldData, newData) {
    // Track existing elements
    const existingNodes = new Map();
    const existingConnections = new Map();

    // Index existing nodes
    this.nodesGroup.querySelectorAll('.process-node').forEach((node) => {
      existingNodes.set(node.dataset.nodeId, node);
    });

    // Index existing connections
    this.connectionsGroup.querySelectorAll('.process-connection').forEach((conn) => {
      const key = `${conn.dataset.from}-${conn.dataset.to}`;
      existingConnections.set(key, conn);
    });

    // Update lanes (positions and colors)
    newData.lanes.forEach((lane) => {
      const laneGroup = this.swimlanesGroup.querySelector(`[data-lane-id="${lane.id}"]`);
      if (laneGroup) {
        const rect = laneGroup.querySelector('rect');
        if (rect && lane.color) {
          rect.setAttribute('fill', lane.color);
        }
        const text = laneGroup.querySelector('text');
        if (text && text.textContent !== lane.name) {
          text.textContent = lane.name;
        }
      }
    });

    // Process nodes differentially
    const processedNodes = new Set();
    newData.lanes.forEach((lane) => {
      lane.nodes?.forEach((node) => {
        processedNodes.add(node.id);
        const existingNode = existingNodes.get(node.id);

        if (existingNode) {
          // Update existing node position and attributes
          this.updateNodeElement(existingNode, node, lane);
          existingNodes.delete(node.id);
        } else {
          // Add new node
          this.addSingleNode(node, lane);
        }
      });
    });

    // Remove deleted nodes
    existingNodes.forEach((node) => node.remove());

    // Process connections differentially
    const processedConnections = new Set();
    newData.connections?.forEach((conn) => {
      const key = `${conn.from}-${conn.to}`;
      processedConnections.add(key);
      const existingConn = existingConnections.get(key);

      if (existingConn) {
        // Update existing connection if needed
        this.updateConnectionElement(existingConn, conn);
        existingConnections.delete(key);
      } else {
        // Add new connection
        this.addSingleConnection(conn);
      }
    });

    // Remove deleted connections
    existingConnections.forEach((conn) => conn.remove());
  }

  updateNodeElement(nodeElement, nodeData, laneData) {
    // Update position using transform for better performance
    const currentTransform = nodeElement.getAttribute('transform') || '';
    const newTransform = `translate(${nodeData.position.x}, ${nodeData.position.y})`;

    if (currentTransform !== newTransform) {
      nodeElement.setAttribute('transform', newTransform);
    }

    // Preserve dragging state during updates
    const isDragging = nodeElement.classList.contains('node-dragging');

    // Update both icon and text elements to match renderNodes structure
    const textElements = nodeElement.querySelectorAll('text');
    if (textElements.length >= 2) {
      // First text is icon, second is node text
      const iconElement = textElements[0];
      const textElement = textElements[1];

      if (iconElement && iconElement.textContent !== (nodeData.icon || '')) {
        iconElement.textContent = nodeData.icon || '';
      }

      // Check if text content has changed
      const currentText = Array.from(textElement.querySelectorAll('tspan'))
        .map(t => t.textContent)
        .join(' ')
        .replace(/\.\.\.$/, ''); // Remove ellipsis for comparison

      if (!currentText.includes(nodeData.text.substring(0, 20))) {
        // Rebuild multi-line text
        while (textElement.firstChild) {
          textElement.removeChild(textElement.firstChild);
        }

        const words = nodeData.text.split(' ');
        const maxWidth = nodeData.type === 'decision' ? 50 : 90;
        const lineHeight = 12;
        let line = '';
        let lines = [];

        words.forEach(word => {
          const testLine = line + (line ? ' ' : '') + word;
          if (testLine.length * 6 > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        });
        if (line) lines.push(line);

        if (lines.length > 3) {
          lines = lines.slice(0, 3);
          lines[2] = lines[2].substring(0, lines[2].length - 3) + '...';
        }

        const startY = 5 - ((lines.length - 1) * lineHeight) / 2;
        textElement.setAttribute('y', startY);

        lines.forEach((lineText, i) => {
          const tspan = this.createSVGElement('tspan');
          tspan.setAttribute('x', 0);
          tspan.setAttribute('dy', i === 0 ? 0 : lineHeight);
          tspan.textContent = lineText;
          textElement.appendChild(tspan);
        });
      }
    }

    // Restore dragging state if it was lost
    if (isDragging && !nodeElement.classList.contains('node-dragging')) {
      nodeElement.classList.add('node-dragging');
    }

    // Update risks if changed
    let risksContainer = nodeElement.querySelector('.risks-container');

    // Remove existing risks container if risks have changed
    if (risksContainer && nodeData.risks?.length > 0) {
      risksContainer.remove();
      risksContainer = null;
    }

    // Add new risks container if there are risks and no container exists
    if (nodeData.risks?.length > 0 && !risksContainer) {
      // Use relative coordinates (0,0) since the node group is already transformed
      this.addRiskBadge(nodeElement, 0, 0, nodeData);
    } else if (!nodeData.risks?.length && risksContainer) {
      risksContainer.remove();
    }
  }

  updateConnectionElement(connElement, connData) {
    // Update path if nodes have moved
    const fromNode = this.findNode(connData.from);
    const toNode = this.findNode(connData.to);

    if (fromNode && toNode) {
      const pathData = this.getCachedPath(fromNode, toNode);
      const pathElement = connElement.querySelector('path');
      if (pathElement) {
        pathElement.setAttribute('d', pathData);
      }

      // Update label or create it if needed
      const labelElement = connElement.querySelector('text.connection-label');
      if (connData.label) {
        const midPoint = this.getPathMidpoint(fromNode, toNode);
        if (labelElement) {
          // Update existing label text and position
          labelElement.textContent = connData.label;
          labelElement.setAttribute('x', midPoint.x);
          labelElement.setAttribute('y', midPoint.y - 10);
        } else {
          // Create new label if it doesn't exist
          const newLabel = this.createSVGElement('text');
          newLabel.setAttribute('x', midPoint.x);
          newLabel.setAttribute('y', midPoint.y - 10);
          newLabel.classList.add('connection-label');
          newLabel.textContent = connData.label;
          connElement.appendChild(newLabel);
        }
      } else if (labelElement) {
        // Remove label if it no longer exists in data
        labelElement.remove();
      }

      // Update risks if changed
      let risksContainer = connElement.querySelector('.connection-risks-container');

      // Remove existing risks container if risks have changed
      if (risksContainer) {
        risksContainer.remove();
        risksContainer = null;
      }

      // Add new risks container if there are risks
      if (connData.risks?.length > 0) {
        Logger.debug('Updating connection with risks:', {
          from: connData.from,
          to: connData.to,
          risksCount: connData.risks.length
        });
        this.addConnectionRisks(connElement, connData, fromNode, toNode);
      }
    }
  }

  addSingleNode(nodeData, laneData) {
    // Add a single node matching the structure from renderNodes
    const nodeGroup = this.createSVGElement('g');
    nodeGroup.classList.add('process-node');
    nodeGroup.dataset.nodeId = nodeData.id;
    nodeGroup.dataset.laneId = laneData.id;
    nodeGroup.style.cursor = 'move';
    nodeGroup.setAttribute(
      'transform',
      `translate(${nodeData.position.x}, ${nodeData.position.y})`,
    );

    // Create node shape matching renderNodes
    const nodeShape = this.createNodeShape(nodeData.type, 0, 0, laneData);
    nodeShape.style.fill = nodeData.color || this.getNodeColor(nodeData.type);
    nodeShape.style.stroke = 'white';
    nodeShape.style.strokeWidth = '2';
    nodeGroup.appendChild(nodeShape);

    // Add icon text matching renderNodes
    const nodeIcon = this.createSVGElement('text');
    nodeIcon.setAttribute('x', 0);
    nodeIcon.setAttribute('y', -10);
    nodeIcon.setAttribute('text-anchor', 'middle');
    nodeIcon.classList.add('node-text');
    nodeIcon.style.fontSize = '20px';
    nodeIcon.textContent = nodeData.icon || '';
    nodeGroup.appendChild(nodeIcon);

    // Create multi-line text within the node
    const nodeText = this.createSVGElement('text');
    nodeText.setAttribute('x', 0);
    nodeText.setAttribute('y', 5);
    nodeText.setAttribute('text-anchor', 'middle');
    nodeText.classList.add('node-text');
    nodeText.style.fontSize = '11px';
    nodeText.style.fontWeight = '500';

    // Word wrap logic for text within node bounds
    const words = nodeData.text.split(' ');
    const maxWidth = nodeData.type === 'decision' ? 50 : 90; // Narrower for diamond shapes
    const lineHeight = 12;
    let line = '';
    let lines = [];

    words.forEach(word => {
      const testLine = line + (line ? ' ' : '') + word;
      // Rough estimation: 6px per character average
      if (testLine.length * 6 > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    });
    if (line) lines.push(line);

    // Limit to 3 lines and add ellipsis if needed
    if (lines.length > 3) {
      lines = lines.slice(0, 3);
      lines[2] = lines[2].substring(0, lines[2].length - 3) + '...';
    }

    // Center the text block vertically
    const startY = 5 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((lineText, i) => {
      const tspan = this.createSVGElement('tspan');
      tspan.setAttribute('x', 0);
      tspan.setAttribute('dy', i === 0 ? 0 : lineHeight);
      tspan.textContent = lineText;
      nodeText.appendChild(tspan);
    });

    // Adjust starting position for first tspan
    if (lines.length > 0) {
      nodeText.setAttribute('y', startY);
    }

    nodeGroup.appendChild(nodeText);

    // Add risks if present
    if (nodeData.risks?.length > 0) {
      this.addRiskBadge(nodeGroup, 0, 0, nodeData);
    }

    // Add tooltip if present
    if (nodeData.description) {
      this.addNodeTooltip(nodeGroup, nodeData);
    }

    // Add connection anchors
    this.addConnectionAnchors(nodeGroup, 0, 0, nodeData.id);

    this.nodesGroup.appendChild(nodeGroup);
  }

  addSingleConnection(connData) {
    // Add a single connection without re-rendering everything
    const fromNode = this.findNode(connData.from);
    const toNode = this.findNode(connData.to);

    if (!fromNode || !toNode) {
      return;
    }

    const connectionGroup = this.createSVGElement('g');
    connectionGroup.classList.add('process-connection');
    connectionGroup.dataset.from = connData.from;
    connectionGroup.dataset.to = connData.to;

    const pathData = this.getCachedPath(fromNode, toNode);
    const path = this.createSVGElement('path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#5a6c7d');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    connectionGroup.appendChild(path);

    // Add label if present
    if (connData.label) {
      const midPoint = this.getPathMidpoint(fromNode, toNode);
      const label = this.createSVGElement('text');
      label.setAttribute('x', midPoint.x);
      label.setAttribute('y', midPoint.y - 10);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = connData.label;
      connectionGroup.appendChild(label);
    }

    // Add risks if present
    if (connData.risks?.length > 0) {
      this.addConnectionRisks(connectionGroup, connData, fromNode, toNode);
    }

    this.connectionsGroup.appendChild(connectionGroup);
  }

  createNodeShape(type, x, y, laneData) {
    let nodeShape;

    switch (type) {
      case 'start':
      case 'end':
        nodeShape = this.createSVGElement('circle');
        nodeShape.setAttribute('cx', x);
        nodeShape.setAttribute('cy', y);
        nodeShape.setAttribute('r', '35');
        break;
      case 'decision':
        nodeShape = this.createSVGElement('polygon');
        const points = `${x},${y - 35} ${x + 35},${y} ${x},${y + 35} ${x - 35},${y}`;
        nodeShape.setAttribute('points', points);
        break;
      default:
        nodeShape = this.createSVGElement('rect');
        nodeShape.setAttribute('x', x - 50);
        nodeShape.setAttribute('y', y - 25);
        nodeShape.setAttribute('width', '100');
        nodeShape.setAttribute('height', '50');
        nodeShape.setAttribute('rx', '25');
        nodeShape.setAttribute('ry', '25');
        break;
    }

    nodeShape.classList.add(`node-${type}`);
    nodeShape.style.fill = laneData?.color || this.getNodeColor(type);
    nodeShape.style.stroke = '#ffffff';
    nodeShape.style.strokeWidth = '2';

    return nodeShape;
  }

  addConnectionRisks(connectionGroup, connData, fromNode, toNode) {
    Logger.debug('Adding connection risks:', {
      from: connData.from,
      to: connData.to,
      risksCount: connData.risks.length,
      risks: connData.risks
    });

    const midPoint = this.getPathMidpoint(fromNode, toNode);
    const risksContainer = this.createSVGElement('g');
    risksContainer.classList.add('connection-risks-container');

    connData.risks.forEach((risk, index) => {
      const badgeGroup = this.createRiskBadge(
        midPoint.x,
        midPoint.y,
        risk,
        index,
        connData.risks.length,
      );
      badgeGroup.classList.add('connection-risk-badge');

      badgeGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        const fromName = fromNode ? fromNode.text : connData.from;
        const toName = toNode ? toNode.text : connData.to;

        const connectionAsNode = {
          id: `connection_${connData.from}_${connData.to}`,
          text: `Connection: ${fromName} → ${toName}`,
          type: 'connection',
          risks: connData.risks || [],
          isConnection: true,
          fromId: connData.from,
          toId: connData.to,
          label: connData.label,
        };

        const showEvent = new CustomEvent('connectionRiskClick', {
          detail: { connection: connectionAsNode },
        });
        document.dispatchEvent(showEvent);
      });

      risksContainer.appendChild(badgeGroup);
    });

    connectionGroup.appendChild(risksContainer);
  }

  clear() {
    // Clean up event listeners before removing nodes
    this.cleanupEventListeners();

    // Safe DOM manipulation to prevent XSS
    while (this.swimlanesGroup.firstChild) {
      this.swimlanesGroup.removeChild(this.swimlanesGroup.firstChild);
    }
    while (this.phasesGroup.firstChild) {
      this.phasesGroup.removeChild(this.phasesGroup.firstChild);
    }
    while (this.nodesGroup.firstChild) {
      this.nodesGroup.removeChild(this.nodesGroup.firstChild);
    }
    while (this.connectionsGroup.firstChild) {
      this.connectionsGroup.removeChild(this.connectionsGroup.firstChild);
    }
  }

  renderSwimLanes() {
    let currentY = 50;

    // Calculate total width based on phases
    const totalWidth = this.calculateTotalWidth();

    this.processData.lanes.forEach((lane, index) => {
      const laneGroup = this.createSVGElement('g');
      laneGroup.setAttribute('data-lane-id', lane.id);
      laneGroup.classList.add('lane-group');

      const laneRect = this.createSVGElement('rect');
      laneRect.setAttribute('x', '20');
      laneRect.setAttribute('y', currentY);
      laneRect.setAttribute('width', totalWidth - 40); // Leave 20px margin on each side
      laneRect.setAttribute('height', lane.height || 140);
      laneRect.setAttribute('rx', '2');
      laneRect.setAttribute('ry', '2');
      laneRect.classList.add('swimlane');
      // Ensure white background is set explicitly
      laneRect.setAttribute('fill', 'white');

      const laneLabel = this.createSVGElement('text');
      laneLabel.setAttribute('x', '40');
      laneLabel.setAttribute('y', currentY + 30);
      laneLabel.classList.add('lane-label');
      laneLabel.textContent = lane.name;

      // Note: Lane dividers are now handled in renderPhases()

      laneGroup.appendChild(laneRect);
      laneGroup.appendChild(laneLabel);

      this.swimlanesGroup.appendChild(laneGroup);

      lane.y = currentY;
      currentY += (lane.height || 140) + 10;
    });

    this.svg.setAttribute('viewBox', `0 0 ${totalWidth} ${currentY + 50}`);
  }

  renderNodes() {
    this.processData.lanes.forEach((lane) => {
      lane.nodes.forEach((node) => {
        const nodeGroup = this.createSVGElement('g');
        nodeGroup.setAttribute('data-node-id', node.id);
        nodeGroup.setAttribute('data-lane-id', lane.id);
        nodeGroup.classList.add('process-node');
        nodeGroup.style.cursor = 'move';

        const x = node.position.x;
        // Always use lane center for y position - nodes should align with their lanes
        const y = lane.y + 70;

        // Store the calculated position
        node.position.y = y;

        // Use transform for positioning the entire group
        nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);

        // Create node shape at origin (0, 0) since group is transformed
        const nodeShape = this.createNodeShape(node.type, 0, 0, lane);
        nodeShape.style.fill = node.color || this.getNodeColor(node.type);
        nodeShape.style.stroke = 'white';
        nodeShape.style.strokeWidth = '2';

        const nodeIcon = this.createSVGElement('text');
        nodeIcon.setAttribute('x', 0);
        nodeIcon.setAttribute('y', -10);
        nodeIcon.setAttribute('text-anchor', 'middle');
        nodeIcon.classList.add('node-text');
        nodeIcon.style.fontSize = '20px';
        nodeIcon.textContent = node.icon || '';

        // Create multi-line text within the node
        const nodeText = this.createSVGElement('text');
        nodeText.setAttribute('x', 0);
        nodeText.setAttribute('y', 5);
        nodeText.setAttribute('text-anchor', 'middle');
        nodeText.classList.add('node-text');
        nodeText.style.fontSize = '11px';
        nodeText.style.fontWeight = '500';

        // Word wrap logic for text within node bounds
        const words = node.text.split(' ');
        const maxWidth = node.type === 'decision' ? 50 : 90; // Narrower for diamond shapes
        const lineHeight = 12;
        let line = '';
        let lines = [];

        words.forEach(word => {
          const testLine = line + (line ? ' ' : '') + word;
          // Rough estimation: 6px per character average
          if (testLine.length * 6 > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        });
        if (line) lines.push(line);

        // Limit to 3 lines and add ellipsis if needed
        if (lines.length > 3) {
          lines = lines.slice(0, 3);
          lines[2] = lines[2].substring(0, lines[2].length - 3) + '...';
        }

        // Center the text block vertically
        const startY = 5 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((lineText, i) => {
          const tspan = this.createSVGElement('tspan');
          tspan.setAttribute('x', 0);
          tspan.setAttribute('dy', i === 0 ? 0 : lineHeight);
          tspan.textContent = lineText;
          nodeText.appendChild(tspan);
        });

        // Adjust starting position for first tspan
        if (lines.length > 0) {
          nodeText.setAttribute('y', startY);
        }

        nodeGroup.appendChild(nodeShape);
        nodeGroup.appendChild(nodeIcon);
        nodeGroup.appendChild(nodeText);

        // Add risk badges if node has risks (use 0,0 since group is transformed)
        if (node.risks && node.risks.length > 0) {
          this.addRiskBadge(nodeGroup, 0, 0, node);
        }

        // Add connection anchors (use 0,0 since group is transformed)
        this.addConnectionAnchors(nodeGroup, 0, 0, node.id);

        // Add tooltip functionality
        this.addNodeTooltip(nodeGroup, node);

        this.nodesGroup.appendChild(nodeGroup);
      });
    });
  }

  renderConnections() {
    if (!this.processData.connections) {
      this.processData.connections = [];
    }

    this.processData.connections.forEach((conn) => {
      const fromNode = this.findNode(conn.from);
      const toNode = this.findNode(conn.to);

      if (fromNode && toNode) {
        // Create a connection group container
        const connectionGroup = this.createSVGElement('g');
        connectionGroup.classList.add('process-connection');
        connectionGroup.dataset.from = conn.from;
        connectionGroup.dataset.to = conn.to;

        const path = this.getCachedPath(fromNode, toNode);

        const connectionPath = this.createSVGElement('path');
        connectionPath.setAttribute('d', path);
        connectionPath.classList.add('connection-line');
        connectionPath.setAttribute('data-from', conn.from);
        connectionPath.setAttribute('data-to', conn.to);

        // Add the path to the group
        connectionGroup.appendChild(connectionPath);

        // Add label if present
        if (conn.label) {
          const midPoint = this.getPathMidpoint(fromNode, toNode);
          const label = this.createSVGElement('text');
          label.setAttribute('x', midPoint.x);
          label.setAttribute('y', midPoint.y - 5);
          label.classList.add('connection-label');
          label.textContent = conn.label;
          connectionGroup.appendChild(label);
        }

        // Add risk indicator badges if connection has risks
        if (conn.risks && conn.risks.length > 0) {
          Logger.debug('Connection has risks in renderConnections:', {
            from: conn.from,
            to: conn.to,
            risksCount: conn.risks.length
          });
          const midPoint = this.getPathMidpoint(fromNode, toNode);

          // Create a container for all risk badges
          const risksContainer = this.createSVGElement('g');
          risksContainer.classList.add('connection-risks-container');

          // Create individual badge for each risk using shared method
          conn.risks.forEach((risk, index) => {
            const badgeGroup = this.createRiskBadge(
              midPoint.x,
              midPoint.y,
              risk,
              index,
              conn.risks.length,
            );
            badgeGroup.classList.add('connection-risk-badge');

            // Add click handler specific to connections
            badgeGroup.addEventListener('click', (e) => {
              e.stopPropagation();

              const fromName = fromNode ? fromNode.text : conn.from;
              const toName = toNode ? toNode.text : conn.to;

              const connectionAsNode = {
                id: `connection_${conn.from}_${conn.to}`,
                text: `Connection: ${fromName} → ${toName}`,
                type: 'connection',
                risks: conn.risks || [],
                isConnection: true,
                fromId: conn.from,
                toId: conn.to,
                label: conn.label,
              };

              const showEvent = new CustomEvent('connectionRiskClick', {
                detail: { connection: connectionAsNode },
              });
              document.dispatchEvent(showEvent);
            });

            risksContainer.appendChild(badgeGroup);
          });

          connectionGroup.appendChild(risksContainer);
        }

        // Add the complete connection group to the connections container
        this.connectionsGroup.appendChild(connectionGroup);
      }
    });
  }

  getCachedPath(fromNode, toNode) {
    // Use path cache for performance
    const cacheKey = `${fromNode.id}-${toNode.id}-${fromNode.position.x},${fromNode.position.y}-${toNode.position.x},${toNode.position.y}`;

    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey);
    }

    const path = this.calculatePath(fromNode, toNode);

    // Maintain cache size limit
    if (this.pathCache.size >= this.maxCacheSize) {
      const firstKey = this.pathCache.keys().next().value;
      this.pathCache.delete(firstKey);
    }

    this.pathCache.set(cacheKey, path);
    return path;
  }

  calculatePath(fromNode, toNode) {
    const fromX = fromNode.position.x;
    const fromY = fromNode.position.y;
    const toX = toNode.position.x;
    const toY = toNode.position.y;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const anchorDistance = 35;

    // Determine which anchors to use (left or right)
    let startX, startY, endX, endY;

    if (dx > 0) {
      // Target is to the right of source
      startX = fromX + anchorDistance; // Right anchor of source
      startY = fromY;
      endX = toX - anchorDistance; // Left anchor of target
      endY = toY;
    } else {
      // Target is to the left of source
      startX = fromX - anchorDistance; // Left anchor of source
      startY = fromY;
      endX = toX + anchorDistance; // Right anchor of target
      endY = toY;
    }

    // Determine path type based on node positions
    const verticalOffset = Math.abs(dy);
    const horizontalGap = Math.abs(endX - startX);

    // Case 1: Nodes are horizontally aligned (straight line)
    if (verticalOffset < 10) {
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    // Case 2: Nodes need to connect around each other (going backwards)
    if ((dx > 0 && endX < startX) || (dx < 0 && endX > startX)) {
      // Create a rectangular path when nodes overlap horizontally
      const midPointOffset = Math.max(50, Math.abs(dx) * 0.3);
      const extendX1 = dx > 0 ? startX + midPointOffset : startX - midPointOffset;
      const extendX2 = dx > 0 ? endX - midPointOffset : endX + midPointOffset;

      return `M ${startX} ${startY} L ${extendX1} ${startY} L ${extendX1} ${endY} L ${endX} ${endY}`;
    }

    // Case 3: Standard curved connection for vertical offset
    if (horizontalGap > 100) {
      // Use bezier curve for longer distances
      const controlOffset = Math.min(horizontalGap * 0.5, 150);
      const controlX1 = startX + (dx > 0 ? controlOffset : -controlOffset);
      const controlY1 = startY;
      const controlX2 = endX + (dx > 0 ? -controlOffset : controlOffset);
      const controlY2 = endY;

      return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
    } else {
      // Use quadratic curve for shorter distances
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      return `M ${startX} ${startY} Q ${midX} ${startY}, ${midX} ${midY} T ${endX} ${endY}`;
    }
  }

  getPathMidpoint(fromNode, toNode) {
    return {
      x: (fromNode.position.x + toNode.position.x) / 2,
      y: (fromNode.position.y + toNode.position.y) / 2,
    };
  }

  findNode(nodeId) {
    for (const lane of this.processData.lanes) {
      const node = lane.nodes.find((n) => n.id === nodeId);
      if (node) {
        return node;
      }
    }
    return null;
  }

  findLane(laneId) {
    return this.processData.lanes.find((l) => l.id === laneId);
  }

  getNodeColor(type) {
    return Theme.nodes.getColor(type);
  }

  fitToScreen() {
    const totalWidth = this.calculateTotalWidth();
    const totalHeight = this.calculateTotalHeight();
    const viewBox = `0 0 ${totalWidth} ${totalHeight}`;
    this.svg.setAttribute('viewBox', viewBox);
  }

  zoom(factor) {
    const viewBox = this.svg.getAttribute('viewBox') || '0 0 1440 800';
    const [x, y, width, height] = viewBox.split(' ').map(Number);

    // Calculate the center point of the current view
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Calculate new dimensions
    const newWidth = width / factor;
    const newHeight = height / factor;

    // Calculate new position to keep center point stable
    const newX = centerX - newWidth / 2;
    const newY = centerY - newHeight / 2;

    this.svg.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
  }

  zoomAtPoint(factor, mouseX, mouseY) {
    const viewBox = this.svg.getAttribute('viewBox') || '0 0 1440 800';
    const [x, y, width, height] = viewBox.split(' ').map(Number);

    // Convert mouse position to SVG coordinates
    const svgX = x + (mouseX / this.svg.clientWidth) * width;
    const svgY = y + (mouseY / this.svg.clientHeight) * height;

    // Calculate new dimensions
    const newWidth = width / factor;
    const newHeight = height / factor;

    // Calculate new position to keep mouse point stable
    const newX = svgX - (mouseX / this.svg.clientWidth) * newWidth;
    const newY = svgY - (mouseY / this.svg.clientHeight) * newHeight;

    // Apply limits to prevent extreme zoom
    const minWidth = 200;
    const maxWidth = 10000;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      this.svg.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
    }
  }

  pan(dx, dy) {
    const viewBox = this.svg.getAttribute('viewBox') || '0 0 1440 800';
    const [x, y, width, height] = viewBox.split(' ').map(Number);

    const newX = x - dx * (width / this.svg.clientWidth);
    const newY = y - dy * (height / this.svg.clientHeight);

    this.svg.setAttribute('viewBox', `${newX} ${newY} ${width} ${height}`);
  }

  applyTransform() {
    // This method is no longer needed as we're using viewBox directly
    // Kept for backward compatibility
  }

  addLane(name) {
    const newLane = {
      id: `lane_${Date.now()}`,
      name: name || `New Lane ${this.processData.lanes.length + 1}`,
      color: this.generateLaneColor(this.processData.lanes.length),
      nodes: [],
      height: 140,
    };

    this.processData.lanes.push(newLane);
    this.render(this.processData);
    return newLane;
  }

  addNode(laneId, type = 'process', text = 'New Node', x = null, y = null) {
    const lane = this.findLane(laneId);
    if (!lane) {
      return null;
    }

    const newNode = {
      id: `node_${Date.now()}`,
      text,
      type,
      description: '', // Initialize with empty description
      position: {
        x: x !== null ? x : 150 + lane.nodes.length * 200,
        y: lane.y + 70, // Always place nodes at the center of their lane
      },
      color: this.getNodeColor(type),
      icon: this.getNodeIcon(type),
    };

    lane.nodes.push(newNode);
    this.render(this.processData);
    return newNode;
  }

  getNodeIcon(type) {
    return Theme.nodes.getIcon(type);
  }

  generateLaneColor(index) {
    return Theme.lanes.getColor(index);
  }

  updateNode(nodeId, updates) {
    const node = this.findNode(nodeId);
    if (node) {
      Object.assign(node, updates);
      // Always set color based on type
      if (updates.type) {
        node.color = this.getNodeColor(updates.type);
      } else {
        node.color = this.getNodeColor(node.type);
      }
      // Force full render if risks are being updated to ensure badges are displayed
      const forceFullRender = updates.risks !== undefined;
      this.render(this.processData, { forceFull: forceFullRender });
    }
  }

  deleteNode(nodeId) {
    if (!this.processData) return false;

    // Find and remove the node from its lane
    for (const lane of this.processData.lanes) {
      const index = lane.nodes.findIndex((n) => n.id === nodeId);
      if (index !== -1) {
        lane.nodes.splice(index, 1);

        // Remove all connections to or from this node
        if (this.processData.connections) {
          this.processData.connections = this.processData.connections.filter(
            (conn) => conn.from !== nodeId && conn.to !== nodeId
          );
        } else {
          this.processData.connections = [];
        }

        // Force a full render to ensure connections are updated
        this.render(this.processData, { forceFull: true });
        return true;
      }
    }
    return false;
  }

  deleteLane(laneId) {
    const index = this.processData.lanes.findIndex((l) => l.id === laneId);
    if (index !== -1) {
      const lane = this.processData.lanes[index];
      const nodeIds = lane.nodes.map((n) => n.id);
      this.processData.connections = this.processData.connections.filter(
        (conn) => !nodeIds.includes(conn.from) && !nodeIds.includes(conn.to),
      );
      this.processData.lanes.splice(index, 1);
      this.render(this.processData, { forceFull: true });
      return true;
    }
    return false;
  }

  addConnection(fromId, toId, label = '') {
    const connection = {
      from: fromId,
      to: toId,
      label,
      risks: [], // Initialize empty risks array for connections
    };
    this.processData.connections.push(connection);
    this.render(this.processData);
    return connection;
  }

  findConnection(fromId, toId) {
    return this.processData.connections.find((conn) => conn.from === fromId && conn.to === toId);
  }

  updateConnection(fromId, toId, newLabel) {
    const connection = this.findConnection(fromId, toId);
    if (connection) {
      connection.label = newLabel;
      this.render(this.processData);
      return true;
    }
    return false;
  }

  deleteConnection(fromId, toId) {
    const index = this.processData.connections.findIndex(
      (conn) => conn.from === fromId && conn.to === toId,
    );
    if (index !== -1) {
      this.processData.connections.splice(index, 1);
      this.render(this.processData);
      return true;
    }
    return false;
  }

  renderPhases() {
    if (!this.processData.lanes || this.processData.lanes.length < 2) {
      return; // Need at least 2 lanes to have dividers between them
    }

    // Define phase colors that alternate
    const phaseColors = ['#FF5722', '#2196F3']; // Red, Blue

    // Sort phases by position for proper color assignment
    const sortedPhases = this.processData.phases
      ? [...this.processData.phases].sort((a, b) => a.position - b.position)
      : [];

    // Create horizontal dividers between lanes
    this.processData.lanes.forEach((lane, index) => {
      if (index === 0) {
        return;
      } // Skip first lane (no divider above it)

      const prevLane = this.processData.lanes[index - 1];
      const dividerY = prevLane.y + (prevLane.height || 140) + 5; // Position between lanes

      // Create a group for this divider
      const dividerGroup = this.createSVGElement('g');
      dividerGroup.classList.add('lane-divider-group');
      dividerGroup.setAttribute('data-divider-index', index);

      // If no phases defined, don't create dividers
      if (sortedPhases.length === 0) {
        return;
      }

      // Create segmented divider based on phases
      let startX = 20;
      const totalWidth = this.calculateTotalWidth();
      const endX = totalWidth - 20; // Match the lane width

      sortedPhases.forEach((phase, phaseIndex) => {
        const phaseEndX = phase.position;
        const segmentEndX = Math.min(phaseEndX, endX);

        if (startX < segmentEndX) {
          // Create segment for this phase
          const segment = this.createSVGElement('line');
          segment.setAttribute('x1', startX);
          segment.setAttribute('y1', dividerY);
          segment.setAttribute('x2', segmentEndX);
          segment.setAttribute('y2', dividerY);
          segment.classList.add('phase-segment');

          // Assign color based on phase index (alternates red/blue)
          const colorIndex = phaseIndex % phaseColors.length;
          segment.style.stroke = phaseColors[colorIndex];
          segment.style.strokeWidth = '5';
          segment.style.strokeDasharray = '15, 5';
          segment.style.opacity = '0.8';

          dividerGroup.appendChild(segment);

          // Add buoys along this segment
          const segmentLength = segmentEndX - startX;
          const numBuoys = Math.floor(segmentLength / 40);
          for (let i = 0; i <= numBuoys; i++) {
            const buoyX = startX + i * 40;
            if (buoyX <= segmentEndX) {
              const buoy = this.createSVGElement('circle');
              buoy.setAttribute('cx', buoyX);
              buoy.setAttribute('cy', dividerY);
              buoy.setAttribute('r', '6');
              buoy.style.fill = phaseColors[colorIndex];
              buoy.style.stroke = 'white';
              buoy.style.strokeWidth = '2';
              dividerGroup.appendChild(buoy);
            }
          }
        }

        startX = segmentEndX;
      });

      // No final segment - pool ends at last phase

      this.phasesGroup.appendChild(dividerGroup);
    });

    // Add phase labels at the top
    if (sortedPhases.length > 0) {
      sortedPhases.forEach((phase, index) => {
        const phaseLabel = this.createSVGElement('text');
        const labelX =
          index === 0
            ? (20 + phase.position) / 2
            : (sortedPhases[index - 1].position + phase.position) / 2;

        phaseLabel.setAttribute('x', labelX);
        phaseLabel.setAttribute('y', '30');
        phaseLabel.setAttribute('text-anchor', 'middle');
        phaseLabel.classList.add('phase-label');
        phaseLabel.style.fontSize = '14px';
        phaseLabel.style.fontWeight = 'bold';
        phaseLabel.style.fill = phaseColors[index % phaseColors.length];
        phaseLabel.textContent = phase.name;
        phaseLabel.setAttribute('data-phase-id', phase.id);

        this.phasesGroup.appendChild(phaseLabel);
      });

      // No 'continues' label - pool ends at last phase
    }
  }

  calculateTotalHeight() {
    let totalHeight = 50; // Starting Y position
    this.processData.lanes.forEach((lane) => {
      totalHeight += (lane.height || 140) + 10;
    });
    return totalHeight;
  }

  calculateTotalWidth() {
    // Calculate width based on total phase positions
    if (!this.processData.phases || this.processData.phases.length === 0) {
      return 1440; // Default width if no phases
    }

    // Find the maximum phase position
    const maxPosition = Math.max(...this.processData.phases.map((p) => p.position));
    // Add some padding
    return maxPosition + 40;
  }

  addPhase(name, position) {
    if (!this.processData.phases) {
      this.processData.phases = [];
    }

    // If no position provided, calculate based on existing phases
    let finalPosition = position;
    if (!finalPosition) {
      if (this.processData.phases.length === 0) {
        finalPosition = 400; // Default for first phase (10 circles)
      } else {
        // Find the maximum position and add 400 (10 circles default)
        const maxPosition = Math.max(...this.processData.phases.map((p) => p.position));
        finalPosition = maxPosition + 400; // No cap - extends as needed
      }
    }

    const newPhase = {
      id: `phase_${Date.now()}`,
      name: name || `Phase ${this.processData.phases.length + 1}`,
      position: finalPosition,
    };

    this.processData.phases.push(newPhase);
    this.render(this.processData);
    return newPhase;
  }

  updatePhase(phaseId, updates) {
    const phase = this.processData.phases.find((p) => p.id === phaseId);
    if (phase) {
      Object.assign(phase, updates);
      this.render(this.processData);
    }
  }

  deletePhase(phaseId) {
    const index = this.processData.phases.findIndex((p) => p.id === phaseId);
    if (index !== -1) {
      this.processData.phases.splice(index, 1);
      this.render(this.processData);
      return true;
    }
    return false;
  }

  findPhase(phaseId) {
    return this.processData.phases.find((p) => p.id === phaseId);
  }

  getProcessData() {
    return this.processData;
  }

  cleanupEventListeners() {
    // Clean up tooltip and anchor handlers from all nodes
    const nodeGroups = this.nodesGroup.querySelectorAll('.process-node');
    nodeGroups.forEach((nodeGroup) => {
      // Clean up tooltip handlers
      if (nodeGroup._tooltipData) {
        nodeGroup.removeEventListener('mouseenter', nodeGroup._tooltipData.showTooltip);
        nodeGroup.removeEventListener('mouseleave', nodeGroup._tooltipData.hideTooltip);
        nodeGroup.removeEventListener('mousemove', nodeGroup._tooltipData.moveTooltip);
        if (nodeGroup._tooltipData.tooltip) {
          nodeGroup._tooltipData.tooltip.remove();
        }
        delete nodeGroup._tooltipData;
      }
      // Clean up anchor handlers
      if (nodeGroup._anchorHandlers) {
        nodeGroup.removeEventListener('mouseenter', nodeGroup._anchorHandlers.handleAnchorShow);
        nodeGroup.removeEventListener('mouseleave', nodeGroup._anchorHandlers.handleAnchorHide);
        delete nodeGroup._anchorHandlers;
      }
    });

    // Clean up any remaining tooltips
    document.querySelectorAll('.node-tooltip').forEach((t) => t.remove());
  }

  cleanup() {
    // Complete cleanup method for the component
    this.cleanupEventListeners();
    this.clear();
    this.processData = null;
  }
}

window.SwimLaneRenderer = SwimLaneRenderer;

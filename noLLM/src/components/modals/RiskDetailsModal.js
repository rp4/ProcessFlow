/**
 * RiskDetailsModal - Modal for displaying and editing risk and control information
 */
export class RiskDetailsModal {
  constructor() {
    this.modal = null;
    this.currentNode = null;
    this.onSave = null;
    // Store bound handler for proper cleanup
    this.boundHandlers = {
      handleRiskBadgeClick: this.handleRiskBadgeClick.bind(this),
    };
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Remove any existing listener first to prevent duplicates
    document.removeEventListener('riskBadgeClick', this.boundHandlers.handleRiskBadgeClick);
    // Listen for risk badge clicks
    document.addEventListener('riskBadgeClick', this.boundHandlers.handleRiskBadgeClick);
  }

  handleRiskBadgeClick(e) {
    this.show(e.detail.node);
  }

  show(node) {
    // Store node ID to find fresh node later
    this.nodeId = node.id;
    // Check if this is a connection
    this.isConnection = node.isConnection || false;
    this.fromId = node.fromId;
    this.toId = node.toId;
    // Create deep copies of the node to avoid modifying the original
    this.originalNode = JSON.parse(JSON.stringify(node));
    this.currentNode = JSON.parse(JSON.stringify(node));
    // Ensure all risks have a controls array
    if (this.currentNode.risks && Array.isArray(this.currentNode.risks)) {
      this.currentNode.risks = this.currentNode.risks.map((risk) => ({
        ...risk,
        controls: risk.controls || [],
      }));
    }
    this.createModal();
    this.populateModal();
  }

  createModal() {
    // Remove existing modal if present
    if (this.modal) {
      this.modal.remove();
    }

    // Create modal structure
    this.modal = document.createElement('div');
    this.modal.className = 'risk-modal-overlay';
    this.modal.innerHTML = `
      <div class="risk-modal">
        <div class="risk-modal-header">
          <h2>Risks & Controls</h2>
          <button class="risk-modal-close">&times;</button>
        </div>
        <div class="risk-modal-body">
          <div class="node-info">
            <h3>${this.currentNode.text}</h3>
            <span class="node-type-badge">${this.isConnection ? this.currentNode.label || 'Connection' : this.currentNode.type}</span>
          </div>

          <div class="risks-section">
            <h3>Risks & Controls</h3>
            <div class="risks-list"></div>
            <button class="add-risk-btn">+ Add Risk</button>
          </div>
        </div>
        <div class="risk-modal-footer">
          <button class="btn-save">Save Changes</button>
          <button class="btn-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Add modal styles if not already present
    this.addModalStyles();

    // Setup modal interactions
    this.setupModalInteractions();
  }

  populateModal() {
    const risksContainer = this.modal.querySelector('.risks-list');

    // Clear existing content
    risksContainer.innerHTML = '';

    // Populate risks with their controls
    if (this.currentNode.risks && this.currentNode.risks.length > 0) {
      this.currentNode.risks.forEach((risk, index) => {
        const riskElement = this.createRiskElement(risk, index);
        risksContainer.appendChild(riskElement);
      });
    } else {
      risksContainer.innerHTML = '<p class="empty-message">No risks identified</p>';
    }
  }

  createRiskElement(risk, index) {
    const hasControls = risk.controls && risk.controls.length > 0;
    const riskDiv = document.createElement('div');
    riskDiv.className = `risk-item ${hasControls ? 'controlled' : 'uncontrolled'}`;
    riskDiv.dataset.riskId = risk.id;
    riskDiv.dataset.riskIndex = index;

    riskDiv.innerHTML = `
      <div class="risk-header">
        <div class="risk-indicator ${hasControls ? 'yellow' : 'red'}">⚠</div>
        <input type="text" class="risk-text" value="${risk.text}" placeholder="Risk name">
        <select class="risk-level">
          <option value="low" ${risk.level === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${risk.level === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${risk.level === 'high' ? 'selected' : ''}>High</option>
          <option value="critical" ${risk.level === 'critical' ? 'selected' : ''}>Critical</option>
        </select>
        <button class="remove-risk-btn" data-index="${index}">&times;</button>
      </div>
      <textarea class="risk-description" placeholder="Risk description">${risk.description || ''}</textarea>
      <div class="risk-controls">
        <div class="controls-header">
          <label>Controls for this Risk:</label>
          <button class="add-control-to-risk-btn" data-risk-index="${index}">+ Add Control</button>
        </div>
        <div class="controls-list-within-risk">
          ${this.createControlsForRisk(risk.controls || [], index)}
        </div>
      </div>
    `;

    return riskDiv;
  }

  createControlsForRisk(controls, riskIndex) {
    if (!controls || controls.length === 0) {
      return '<p class="no-controls-message">No controls defined for this risk</p>';
    }

    return controls
      .map(
        (control, controlIndex) => `
        <div class="control-item" data-control-id="${control.id}" data-risk-index="${riskIndex}" data-control-index="${controlIndex}">
          <div class="control-header">
            <div class="control-indicator">🛡️</div>
            <input type="text" class="control-text" value="${control.text}" placeholder="Control name">
            <select class="control-type">
              <option value="preventive" ${control.type === 'preventive' ? 'selected' : ''}>Preventive</option>
              <option value="detective" ${control.type === 'detective' ? 'selected' : ''}>Detective</option>
              <option value="corrective" ${control.type === 'corrective' ? 'selected' : ''}>Corrective</option>
            </select>
            <button class="remove-control-btn" data-risk-index="${riskIndex}" data-control-index="${controlIndex}">&times;</button>
          </div>
          <textarea class="control-description" placeholder="Control description">${control.description || ''}</textarea>
        </div>
      `,
      )
      .join('');
  }

  addControlToRisk(riskIndex) {
    // Save current form data before re-rendering
    this.saveFormDataToModel();

    if (!this.currentNode.risks[riskIndex].controls) {
      this.currentNode.risks[riskIndex].controls = [];
    }

    const newControl = {
      id: `control_${Date.now()}`,
      text: 'New Control',
      type: 'preventive',
      description: '',
    };

    this.currentNode.risks[riskIndex].controls.push(newControl);
    this.populateModal();
  }

  setupModalInteractions() {
    // Close button
    this.modal.querySelector('.risk-modal-close').addEventListener('click', () => {
      this.close();
    });

    // Cancel button
    this.modal.querySelector('.btn-cancel').addEventListener('click', () => {
      this.close();
    });

    // Save button
    this.modal.querySelector('.btn-save').addEventListener('click', () => {
      this.save();
    });

    // Add risk button
    this.modal.querySelector('.add-risk-btn').addEventListener('click', () => {
      this.addNewRisk();
    });

    // Event delegation for dynamic buttons
    this.modal.addEventListener('click', (e) => {
      // Remove risk button
      if (e.target.classList.contains('remove-risk-btn')) {
        const index = parseInt(e.target.dataset.index);
        this.removeRisk(index);
      }

      // Add control to specific risk button
      if (e.target.classList.contains('add-control-to-risk-btn')) {
        const riskIndex = parseInt(e.target.dataset.riskIndex);
        this.addControlToRisk(riskIndex);
      }

      // Remove control from specific risk
      if (e.target.classList.contains('remove-control-btn')) {
        const riskIndex = parseInt(e.target.dataset.riskIndex);
        const controlIndex = parseInt(e.target.dataset.controlIndex);
        this.removeControlFromRisk(riskIndex, controlIndex);
      }
    });

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  saveFormDataToModel() {
    // Only save if modal exists
    if (!this.modal) {
      return;
    }

    // Save all current form values to the data model before re-rendering
    const riskItems = this.modal.querySelectorAll('.risk-item');

    riskItems.forEach((item, index) => {
      if (this.currentNode.risks[index]) {
        // Save risk data
        const riskText = item.querySelector('.risk-text');
        const riskLevel = item.querySelector('.risk-level');
        const riskDescription = item.querySelector('.risk-description');

        if (riskText) {
          this.currentNode.risks[index].text = riskText.value;
        }
        if (riskLevel) {
          this.currentNode.risks[index].level = riskLevel.value;
        }
        if (riskDescription) {
          this.currentNode.risks[index].description = riskDescription.value;
        }

        // Save control data
        const controlItems = item.querySelectorAll('.control-item');
        controlItems.forEach((controlEl, controlIndex) => {
          if (
            this.currentNode.risks[index].controls &&
            this.currentNode.risks[index].controls[controlIndex]
          ) {
            const controlText = controlEl.querySelector('.control-text');
            const controlType = controlEl.querySelector('.control-type');
            const controlDescription = controlEl.querySelector('.control-description');

            if (controlText) {
              this.currentNode.risks[index].controls[controlIndex].text = controlText.value;
            }
            if (controlType) {
              this.currentNode.risks[index].controls[controlIndex].type = controlType.value;
            }
            if (controlDescription) {
              this.currentNode.risks[index].controls[controlIndex].description =
                controlDescription.value;
            }
          }
        });
      }
    });
  }

  addNewRisk() {
    // Save current form data before re-rendering
    this.saveFormDataToModel();

    if (!this.currentNode.risks) {
      this.currentNode.risks = [];
    }

    const newRisk = {
      id: `risk_${Date.now()}`,
      text: 'New Risk',
      level: 'medium',
      description: '',
      controls: [],
    };

    this.currentNode.risks.push(newRisk);
    this.populateModal();
  }

  removeControlFromRisk(riskIndex, controlIndex) {
    // Save current form data before re-rendering
    this.saveFormDataToModel();

    if (
      this.currentNode.risks &&
      this.currentNode.risks[riskIndex] &&
      this.currentNode.risks[riskIndex].controls &&
      this.currentNode.risks[riskIndex].controls[controlIndex]
    ) {
      this.currentNode.risks[riskIndex].controls.splice(controlIndex, 1);
      this.populateModal();
    }
  }

  removeRisk(index) {
    // Save current form data before re-rendering
    this.saveFormDataToModel();

    if (this.currentNode.risks && this.currentNode.risks[index]) {
      this.currentNode.risks.splice(index, 1);
      this.populateModal();
    }
  }

  save() {
    // Collect updated data from form
    const riskItems = this.modal.querySelectorAll('.risk-item');

    // Update risks with embedded controls
    const updatedRisks = Array.from(riskItems).map((item) => {
      const riskId = item.dataset.riskId;
      const riskIndex = item.dataset.riskIndex;

      // Collect controls for this risk
      const controlElements = item.querySelectorAll('.control-item');
      const controls = Array.from(controlElements).map((controlEl) => ({
        id: controlEl.dataset.controlId,
        text: controlEl.querySelector('.control-text').value,
        type: controlEl.querySelector('.control-type').value,
        description: controlEl.querySelector('.control-description').value,
      }));

      return {
        id: riskId,
        text: item.querySelector('.risk-text').value,
        level: item.querySelector('.risk-level').value,
        description: item.querySelector('.risk-description').value,
        controls,
      };
    });

    // Dispatch save event with just the risks update
    if (this.isConnection) {
      const event = new CustomEvent('connectionRiskDetailsUpdated', {
        detail: {
          fromId: this.fromId,
          toId: this.toId,
          risks: updatedRisks,
        },
      });
      document.dispatchEvent(event);
    } else {
      const event = new CustomEvent('riskDetailsUpdated', {
        detail: {
          nodeId: this.nodeId,
          risks: updatedRisks,
        },
      });
      document.dispatchEvent(event);
    }

    this.close();
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.currentNode = null;
    this.originalNode = null;
    this.nodeId = null;
    this.isConnection = false;
    this.fromId = null;
    this.toId = null;
  }

  destroy() {
    // Remove event listeners
    document.removeEventListener('riskBadgeClick', this.boundHandlers.handleRiskBadgeClick);
    // Close modal if open
    this.close();
  }

  addModalStyles() {
    if (document.getElementById('risk-modal-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'risk-modal-styles';
    style.textContent = `
      .risk-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
      }

      .risk-modal {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
      }

      .risk-modal-header {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
        color: white;
        border-radius: 12px 12px 0 0;
      }

      .risk-modal-close {
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: white;
        opacity: 0.8;
        transition: opacity 0.3s;
      }

      .risk-modal-close:hover {
        opacity: 1;
      }

      .risk-modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .node-info {
        margin-bottom: 20px;
        padding: 15px;
        background: #f5f5f5;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .node-type-badge {
        padding: 5px 10px;
        background: #2196f3;
        color: white;
        border-radius: 15px;
        font-size: 12px;
        text-transform: uppercase;
      }

      .risks-section {
        margin-bottom: 25px;
      }

      .risks-section h3 {
        margin-bottom: 15px;
        color: #333;
        border-bottom: 2px solid #667eea;
        padding-bottom: 8px;
      }

      .risk-item, .control-item {
        margin-bottom: 15px;
        padding: 15px;
        background: #f9f9f9;
        border-radius: 8px;
        border-left: 4px solid #ccc;
      }

      .risk-item.uncontrolled {
        border-left-color: #f44336;
        background: #fff5f5;
      }

      .risk-item.controlled {
        border-left-color: #ff9800;
        background: #fffaf0;
      }

      .control-item {
        border-left-color: #4caf50;
        background: #f5fff5;
      }

      .risk-header, .control-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .risk-indicator {
        font-size: 20px;
      }

      .risk-indicator.red {
        color: #f44336;
      }

      .risk-indicator.yellow {
        color: #ff9800;
      }

      .control-indicator {
        font-size: 20px;
      }

      .risk-text, .control-text {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }

      .risk-level, .control-type {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }

      .risk-description, .control-description {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        resize: vertical;
        min-height: 60px;
        margin-bottom: 10px;
      }

      .risk-controls {
        margin-top: 15px;
        padding: 15px;
        background: #f0f8ff;
        border-radius: 6px;
        border: 1px solid #ddd;
      }

      .controls-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .controls-header label {
        font-weight: 600;
        color: #555;
        font-size: 14px;
      }

      .add-control-to-risk-btn {
        padding: 6px 12px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.3s;
      }

      .add-control-to-risk-btn:hover {
        background: #45a049;
      }

      .controls-list-within-risk {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .controls-list-within-risk .control-item {
        margin-bottom: 0;
        background: white;
        border-left: 3px solid #4caf50;
      }

      .no-controls-message {
        color: #999;
        font-style: italic;
        font-size: 14px;
        text-align: center;
        padding: 10px;
      }

      .remove-risk-btn, .remove-control-btn {
        background: #f44336;
        color: white;
        border: none;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.3s;
      }

      .remove-risk-btn:hover, .remove-control-btn:hover {
        background: #d32f2f;
      }

      .add-risk-btn, .add-control-btn {
        padding: 10px 20px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.3s;
      }

      .add-risk-btn:hover, .add-control-btn:hover {
        background: #5a67d8;
      }

      .empty-message {
        color: #999;
        font-style: italic;
        text-align: center;
        padding: 20px;
      }

      .risk-modal-footer {
        padding: 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .btn-save, .btn-cancel {
        padding: 10px 25px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;
      }

      .btn-save {
        background: #4caf50;
        color: white;
      }

      .btn-save:hover {
        background: #45a049;
      }

      .btn-cancel {
        background: #f5f5f5;
        color: #666;
      }

      .btn-cancel:hover {
        background: #e0e0e0;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export default RiskDetailsModal;

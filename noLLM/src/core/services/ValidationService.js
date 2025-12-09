/**
 * ValidationService - Handles input validation and sanitization
 * Protects against XSS, injection attacks, and malformed data
 */
export class ValidationService {
  static MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  static MAX_TEXT_LENGTH = 1000;
  static MAX_LANES = 20;
  static MAX_NODES_PER_LANE = 50;
  static MAX_CONNECTIONS = 200;
  static MAX_PHASES = 20;

  /**
   * Sanitize text content to prevent XSS
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') {
      return '';
    }

    // Simply truncate and return - textContent is used when displaying,
    // which automatically prevents XSS without encoding special characters
    return text.substring(0, this.MAX_TEXT_LENGTH);
  }

  /**
   * Validate and sanitize process data
   * @param {Object} data - Process data to validate
   * @returns {Object} Validated and sanitized data
   * @throws {Error} If data is invalid
   */
  static validateProcessData(data) {
    // Check if data is an object
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format: expected an object');
    }

    // Check file size
    const dataSize = new Blob([JSON.stringify(data)]).size;
    if (dataSize > this.MAX_FILE_SIZE) {
      throw new Error(`File too large: maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Validate title
    if (data.title && typeof data.title !== 'string') {
      throw new Error('Invalid title: must be a string');
    }
    data.title = this.sanitizeText(data.title || 'Untitled Process');

    // Validate lanes
    if (!Array.isArray(data.lanes)) {
      throw new Error('Invalid data structure: lanes must be an array');
    }

    if (data.lanes.length > this.MAX_LANES) {
      throw new Error(`Too many lanes: maximum is ${this.MAX_LANES}`);
    }

    // Validate and sanitize each lane
    data.lanes = data.lanes.map((lane, index) => {
      if (!lane || typeof lane !== 'object') {
        throw new Error(`Invalid lane at index ${index}`);
      }

      // Validate required fields
      if (!lane.id || typeof lane.id !== 'string') {
        throw new Error(`Lane at index ${index} missing valid id`);
      }

      // Sanitize lane data
      const sanitizedLane = {
        id: this.sanitizeId(lane.id),
        name: this.sanitizeText(lane.name || `Lane ${index + 1}`),
        color: this.sanitizeColor(lane.color),
        height: this.sanitizeNumber(lane.height, 140, 50, 500),
        nodes: [],
      };

      // Validate nodes
      if (Array.isArray(lane.nodes)) {
        if (lane.nodes.length > this.MAX_NODES_PER_LANE) {
          throw new Error(
            `Too many nodes in lane ${lane.name}: maximum is ${this.MAX_NODES_PER_LANE}`,
          );
        }

        sanitizedLane.nodes = lane.nodes.map((node, nodeIndex) => {
          if (!node || typeof node !== 'object') {
            throw new Error(`Invalid node at lane ${index}, node ${nodeIndex}`);
          }

          return this.validateNode(node);
        });
      }

      return sanitizedLane;
    });

    // Validate phases
    if (data.phases) {
      if (!Array.isArray(data.phases)) {
        throw new Error('Phases must be an array');
      }

      if (data.phases.length > this.MAX_PHASES) {
        throw new Error(`Too many phases: maximum is ${this.MAX_PHASES}`);
      }

      data.phases = data.phases.map((phase, index) => {
        if (!phase || typeof phase !== 'object') {
          throw new Error(`Invalid phase at index ${index}`);
        }

        // Validate required fields
        if (!phase.id || typeof phase.id !== 'string') {
          throw new Error(`Phase at index ${index} missing valid id`);
        }

        // Sanitize phase data
        return {
          id: this.sanitizeId(phase.id),
          name: this.sanitizeText(phase.name || `Phase ${index + 1}`),
          position: this.sanitizeNumber(phase.position, 400, 20, 10000), // Min 20, Max 10000, Default 400
        };
      });
    } else {
      data.phases = [];
    }

    // Validate connections
    if (data.connections) {
      if (!Array.isArray(data.connections)) {
        throw new Error('Connections must be an array');
      }

      if (data.connections.length > this.MAX_CONNECTIONS) {
        throw new Error(`Too many connections: maximum is ${this.MAX_CONNECTIONS}`);
      }

      data.connections = data.connections.map((conn, index) => {
        if (!conn || typeof conn !== 'object') {
          throw new Error(`Invalid connection at index ${index}`);
        }

        return {
          from: this.sanitizeId(conn.from),
          to: this.sanitizeId(conn.to),
          label: this.sanitizeText(conn.label || ''),
          type: this.sanitizeConnectionType(conn.type),
          // Preserve risks for connections
          risks: this.validateRisks(conn.risks),
        };
      });
    } else {
      data.connections = [];
    }

    return data;
  }

  /**
   * Validate and sanitize a node
   * @param {Object} node - Node to validate
   * @returns {Object} Validated node
   */
  static validateNode(node) {
    const validTypes = ['start', 'process', 'decision', 'end'];

    return {
      id: this.sanitizeId(node.id),
      text: this.sanitizeText(node.text || 'New Node'),
      type: validTypes.includes(node.type) ? node.type : 'process',
      description: this.sanitizeText(node.description || ''),
      position: this.validatePosition(node.position),
      risks: this.validateRisks(node.risks),
    };
  }

  /**
   * Validate position object
   * @param {Object} position - Position to validate
   * @returns {Object} Valid position
   */
  static validatePosition(position) {
    if (!position || typeof position !== 'object') {
      return { x: 100, y: 50 };
    }

    return {
      x: this.sanitizeNumber(position.x, 100, 0, 2000),
      y: this.sanitizeNumber(position.y, 50, 0, 1000),
    };
  }

  /**
   * Sanitize ID strings
   * @param {string} id - ID to sanitize
   * @returns {string} Sanitized ID
   */
  static sanitizeId(id) {
    if (typeof id !== 'string') {
      return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Allow only alphanumeric, underscore, and hyphen
    return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || `id_${Date.now()}`;
  }

  /**
   * Sanitize color values
   * @param {string} color - Color to sanitize
   * @returns {string} Valid color
   */
  static sanitizeColor(color) {
    if (!color || typeof color !== 'string') {
      return '#2196f3';
    }

    // Allow hex colors
    const hexMatch = color.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
    if (hexMatch) {
      return color;
    }

    // Allow rgb/rgba
    const rgbMatch = color.match(
      /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[0-9.]+\s*)?\)$/,
    );
    if (rgbMatch) {
      return color;
    }

    // Default color
    return '#2196f3';
  }

  /**
   * Sanitize numeric values
   * @param {*} value - Value to sanitize
   * @param {number} defaultValue - Default value
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Sanitized number
   */
  static sanitizeNumber(value, defaultValue, min, max) {
    const num = Number(value);
    if (isNaN(num)) {
      return defaultValue;
    }
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Validate risks array
   * @param {Array} risks - Risks to validate
   * @returns {Array} Validated risks
   */
  static validateRisks(risks) {
    if (!Array.isArray(risks)) {
      return [];
    }
    return risks.map((risk) => ({
      id: this.sanitizeId(risk.id || `risk_${Date.now()}_${Math.random()}`),
      text: this.sanitizeText(risk.text || 'Unnamed risk'),
      level: ['low', 'medium', 'high', 'critical'].includes(risk.level) ? risk.level : 'medium',
      description: this.sanitizeText(risk.description || ''),
      // Embedded controls within risks
      controls: Array.isArray(risk.controls) ? this.validateControls(risk.controls) : [],
    }));
  }

  /**
   * Validate controls array
   * @param {Array} controls - Controls to validate
   * @returns {Array} Validated controls
   */
  static validateControls(controls) {
    if (!Array.isArray(controls)) {
      return [];
    }
    return controls.map((control) => ({
      id: this.sanitizeId(control.id || `control_${Date.now()}_${Math.random()}`),
      text: this.sanitizeText(control.text || 'Unnamed control'),
      type: ['preventive', 'detective', 'corrective'].includes(control.type)
        ? control.type
        : 'preventive',
      description: this.sanitizeText(control.description || ''),
    }));
  }

  /**
   * Sanitize connection type
   * @param {string} type - Connection type
   * @returns {string} Valid connection type
   */
  static sanitizeConnectionType(type) {
    const validTypes = ['normal', 'conditional', 'error'];
    return validTypes.includes(type) ? type : 'normal';
  }

  /**
   * Validate file upload
   * @param {File} file - File to validate
   * @throws {Error} If file is invalid
   */
  static validateFileUpload(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File too large: maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file type
    const validTypes = ['application/json', 'text/json', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.json')) {
      throw new Error('Invalid file type: only JSON files are allowed');
    }

    return true;
  }

  /**
   * Validate export format
   * @param {string} format - Export format
   * @returns {string} Valid format
   */
  static validateExportFormat(format) {
    const validFormats = ['json', 'png', 'svg'];
    return validFormats.includes(format) ? format : 'json';
  }
}

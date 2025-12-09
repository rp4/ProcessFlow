/**
 * Theme Configuration
 * Centralized color and style definitions for the application
 */
export const Theme = {
  // Node colors by type
  nodes: {
    colors: {
      start: '#4caf50',
      process: '#2196f3',
      decision: '#ff9800',
      end: '#f44336',
      default: '#2196f3',
    },
    icons: {
      start: '',
      process: '',
      decision: '',
      end: '',
      default: '',
    },
    /**
     * Get color for node type
     * @param {string} type - Node type
     * @returns {string} Color hex code
     */
    getColor(type) {
      return this.colors[type] || this.colors.default;
    },
    /**
     * Get icon for node type
     * @param {string} type - Node type
     * @returns {string} Icon emoji
     */
    getIcon(type) {
      return this.icons[type] || this.icons.default;
    },
  },

  // Lane colors palette
  lanes: {
    palette: [
      '#e3f2fd', // Light Blue
      '#f3e5f5', // Light Purple
      '#e8f5e9', // Light Green
      '#fff3e0', // Light Orange
      '#fce4ec', // Light Pink
      '#f1f8e9', // Light Lime
      '#e0f2f1', // Light Teal
      '#ede7f6', // Light Deep Purple
      '#fff8e1', // Light Amber
      '#efebe9', // Light Brown
    ],
    waterPalette: [
      '#64b5f6', // Blue 300
      '#4fc3f7', // Light Blue 300
      '#29b6f6', // Light Blue 400
      '#03a9f4', // Light Blue 500
      '#039be5', // Light Blue 600
      '#0288d1', // Light Blue 700
    ],
    /**
     * Get color for lane by index
     * @param {number} index - Lane index
     * @param {boolean} useWaterTheme - Use water theme colors
     * @returns {string} Color hex code
     */
    getColor(index, useWaterTheme = false) {
      const palette = useWaterTheme ? this.waterPalette : this.palette;
      return palette[index % palette.length];
    },
  },

  // Connection/Edge colors
  connections: {
    colors: {
      normal: '#666666',
      conditional: '#ff9800',
      error: '#f44336',
      success: '#4caf50',
      default: '#666666',
    },
    strokeWidth: {
      normal: 2,
      selected: 3,
      hover: 2.5,
    },
    /**
     * Get color for connection type
     * @param {string} type - Connection type
     * @returns {string} Color hex code
     */
    getColor(type) {
      return this.colors[type] || this.colors.default;
    },
  },

  // Risk level colors
  riskLevels: {
    low: '#4caf50',
    medium: '#ff9800',
    high: '#f44336',
    critical: '#9c27b0',
    /**
     * Get color for risk level
     * @param {string} level - Risk level
     * @returns {string} Color hex code
     */
    getColor(level) {
      return this[level] || '#666666';
    },
  },

};

// Default export for convenience
export default Theme;

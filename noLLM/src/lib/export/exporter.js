/**
 * ProcessExporter - Handles exporting diagram data
 * Simplified to include only actively used methods
 */
export class ProcessExporter {
  constructor() {
    this.svgNamespace = 'http://www.w3.org/2000/svg';
  }

  /**
   * Export process data to JSON string
   * @param {Object} processData - Process data to export
   * @returns {string} JSON string
   */
  exportToJSON(processData) {
    const exportData = {
      title: processData.title,
      phases: processData.phases
        ? processData.phases.map((phase) => ({
            id: phase.id,
            name: phase.name,
            position: phase.position,
          }))
        : [],
      lanes: processData.lanes.map((lane) => ({
        id: lane.id,
        name: lane.name,
        color: lane.color,
        height: lane.height,
        nodes: lane.nodes.map((node) => ({
          id: node.id,
          text: node.text,
          type: node.type,
          description: node.description || '',
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          // Include risks with embedded controls
          risks: node.risks
            ? node.risks.map((risk) => ({
                id: risk.id,
                text: risk.text,
                level: risk.level,
                description: risk.description || '',
                controls: risk.controls
                  ? risk.controls.map((control) => ({
                      id: control.id,
                      text: control.text,
                      type: control.type,
                      description: control.description || '',
                    }))
                  : [],
              }))
            : [],
          // Don't export color - it should be determined by type
          metadata: node.metadata || {},
        })),
      })),
      connections: processData.connections.map((conn) => ({
        from: conn.from,
        to: conn.to,
        label: conn.label || '',
        // Include risks with embedded controls for connections
        risks: conn.risks
          ? conn.risks.map((risk) => ({
              id: risk.id,
              text: risk.text,
              level: risk.level,
              description: risk.description || '',
              controls: risk.controls
                ? risk.controls.map((control) => ({
                    id: control.id,
                    text: control.text,
                    type: control.type,
                    description: control.description || '',
                  }))
                : [],
            }))
          : [],
      })),
      metadata: processData.metadata || {},
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Download process data as JSON file
   * @param {Object} processData - Process data to download
   * @param {string} filename - Name of the file to download
   */
  downloadJSON(processData, filename = 'swimlane-process.json') {
    const jsonString = this.exportToJSON(processData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    this.downloadFile(blob, filename);
  }

  /**
   * Helper method to download a file
   * @param {Blob} blob - File blob to download
   * @param {string} filename - Name of the file
   */
  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Export for global access if needed
window.ProcessExporter = ProcessExporter;

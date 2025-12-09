import { Logger } from '../utils/Logger.js';

export class UrlParamsHandler {
  constructor(app) {
    this.app = app;
  }

  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');

    if (data) {
      this.loadSharedDiagram(data);
    }
  }

  loadSharedDiagram(data) {
    try {
      // Add size check to prevent extremely large payloads
      if (data.length > 100000) {
        throw new Error('Data payload too large');
      }

      const jsonString = decodeURIComponent(atob(data));
      // Add another size check after decoding
      if (jsonString.length > 500000) {
        throw new Error('Decoded data too large');
      }

      const jsonData = JSON.parse(jsonString);
      // Use parse() instead of parseProcess() to ensure proper validation
      const processData = this.app.parser.parse(jsonData);
      this.app.controls.displayDiagram(processData);
    } catch (error) {
      Logger.error('Failed to load shared diagram:', error);
      this.showErrorMessage('Failed to load shared diagram. The link may be corrupted.');
    }
  }

  createShareableUrl(jsonData) {
    const jsonString = JSON.stringify(jsonData);
    const encodedData = btoa(encodeURIComponent(jsonString));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?data=${encodedData}`;
  }

  showErrorMessage(message) {
    // This could be enhanced with a better UI notification system
    Logger.error(message);
    alert(message);
  }
}

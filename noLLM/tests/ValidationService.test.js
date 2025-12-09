import { describe, it, expect, beforeEach } from '@jest/globals';
import { ValidationService } from '../src/core/services/ValidationService.js';

describe('ValidationService', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = ValidationService.sanitizeInput(input);
      expect(result).toBe('Hello  World');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = ValidationService.sanitizeInput(input);
      expect(result).toBe('<div>Click me</div>');
    });

    it('should preserve safe HTML', () => {
      const input = '<b>Bold</b> and <i>italic</i> text';
      const result = ValidationService.sanitizeInput(input);
      expect(result).toBe('<b>Bold</b> and <i>italic</i> text');
    });

    it('should handle null and undefined', () => {
      expect(ValidationService.sanitizeInput(null)).toBe('');
      expect(ValidationService.sanitizeInput(undefined)).toBe('');
    });
  });

  describe('validateNodeType', () => {
    it('should accept valid node types', () => {
      expect(ValidationService.validateNodeType('start')).toBe(true);
      expect(ValidationService.validateNodeType('end')).toBe(true);
      expect(ValidationService.validateNodeType('process')).toBe(true);
      expect(ValidationService.validateNodeType('decision')).toBe(true);
      expect(ValidationService.validateNodeType('risk')).toBe(true);
      expect(ValidationService.validateNodeType('control')).toBe(true);
    });

    it('should reject invalid node types', () => {
      expect(ValidationService.validateNodeType('invalid')).toBe(false);
      expect(ValidationService.validateNodeType('')).toBe(false);
      expect(ValidationService.validateNodeType(null)).toBe(false);
    });
  });

  describe('validateProcessData', () => {
    let validData;

    beforeEach(() => {
      validData = {
        title: 'Test Process',
        lanes: [
          {
            id: 'lane1',
            name: 'Lane 1',
            color: '#ff0000',
            nodes: [
              {
                id: 'node1',
                text: 'Start',
                type: 'start',
                position: { x: 100, y: 100 }
              }
            ]
          }
        ],
        connections: []
      };
    });

    it('should accept valid process data', () => {
      const errors = ValidationService.validateProcessData(validData);
      expect(errors).toHaveLength(0);
    });

    it('should reject data without title', () => {
      delete validData.title;
      const errors = ValidationService.validateProcessData(validData);
      expect(errors.some(e => e.includes('title'))).toBe(true);
    });

    it('should reject data without lanes', () => {
      delete validData.lanes;
      const errors = ValidationService.validateProcessData(validData);
      expect(errors.some(e => e.includes('lanes'))).toBe(true);
    });

    it('should reject lanes without required fields', () => {
      delete validData.lanes[0].id;
      const errors = ValidationService.validateProcessData(validData);
      expect(errors.some(e => e.includes('Lane 0') && e.includes('id'))).toBe(true);
    });

    it('should reject nodes without required fields', () => {
      delete validData.lanes[0].nodes[0].position;
      const errors = ValidationService.validateProcessData(validData);
      expect(errors.some(e => e.includes('Node 0') && e.includes('position'))).toBe(true);
    });

    it('should reject invalid connections', () => {
      validData.connections = [
        { from: 'node1', to: 'nonexistent' }
      ];
      const errors = ValidationService.validateProcessData(validData);
      expect(errors.some(e => e.includes('Connection'))).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files under size limit', () => {
      const file = new Blob(['x'.repeat(1000)]);
      expect(ValidationService.validateFileSize(file, 2000)).toBe(true);
    });

    it('should reject files over size limit', () => {
      const file = new Blob(['x'.repeat(3000)]);
      expect(ValidationService.validateFileSize(file, 2000)).toBe(false);
    });

    it('should handle missing file', () => {
      expect(ValidationService.validateFileSize(null, 1000)).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(ValidationService.escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(ValidationService.escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
      expect(ValidationService.escapeHtml("'apostrophe'")).toBe('&#x27;apostrophe&#x27;');
      expect(ValidationService.escapeHtml('&ampersand&')).toBe('&amp;ampersand&amp;');
    });

    it('should handle non-string inputs', () => {
      expect(ValidationService.escapeHtml(null)).toBe('');
      expect(ValidationService.escapeHtml(undefined)).toBe('');
      expect(ValidationService.escapeHtml(123)).toBe('123');
    });
  });
});
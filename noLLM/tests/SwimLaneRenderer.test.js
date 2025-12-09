import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SwimLaneRenderer } from '../src/components/diagram/SwimLane.js';

describe('SwimLaneRenderer', () => {
  let renderer;
  let mockSvg;

  beforeEach(() => {
    // Create mock SVG element
    mockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // Add required groups
    const groups = ['swimlanes', 'phases', 'nodes', 'connections'];
    groups.forEach(id => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.id = id;
      mockSvg.appendChild(group);
    });

    // Add to document for querySelector to work
    document.body.appendChild(mockSvg);

    renderer = new SwimLaneRenderer(mockSvg);
  });

  afterEach(() => {
    document.body.removeChild(mockSvg);
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(renderer.scale).toBe(1);
      expect(renderer.translateX).toBe(0);
      expect(renderer.translateY).toBe(0);
      expect(renderer.processData).toBeNull();
      expect(renderer.pathCache).toBeInstanceOf(Map);
    });

    it('should find all required SVG groups', () => {
      expect(renderer.swimlanesGroup).toBeTruthy();
      expect(renderer.phasesGroup).toBeTruthy();
      expect(renderer.nodesGroup).toBeTruthy();
      expect(renderer.connectionsGroup).toBeTruthy();
    });

    it('should setup event delegation', () => {
      expect(renderer.tooltipElement).toBeNull();
    });
  });

  describe('createSVGElement', () => {
    it('should create SVG elements with correct namespace', () => {
      const rect = renderer.createSVGElement('rect');
      expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(rect.tagName).toBe('rect');
    });
  });

  describe('createRiskBadge', () => {
    it('should create risk badge with correct attributes', () => {
      const risk = {
        id: 'risk1',
        text: 'Test Risk',
        level: 'high',
        description: 'Risk description'
      };

      const badge = renderer.createRiskBadge(100, 100, risk, 0, 1);

      expect(badge.classList.contains('risk-badge')).toBe(true);
      expect(badge.dataset.riskId).toBe('risk1');
      expect(badge.querySelector('path')).toBeTruthy();
      expect(badge.querySelector('circle')).toBeTruthy();
      expect(badge.querySelector('rect')).toBeTruthy();
      expect(badge.querySelector('title').textContent).toContain('Test Risk');
    });

    it('should use different colors for risks with and without controls', () => {
      const riskWithControl = {
        id: 'risk1',
        controls: ['control1']
      };

      const riskWithoutControl = {
        id: 'risk2'
      };

      const badgeWith = renderer.createRiskBadge(0, 0, riskWithControl, 0, 1);
      const badgeWithout = renderer.createRiskBadge(0, 0, riskWithoutControl, 0, 1);

      expect(badgeWith.querySelector('path').getAttribute('fill')).toBe('#ff9800');
      expect(badgeWithout.querySelector('path').getAttribute('fill')).toBe('#f44336');
    });
  });

  describe('render', () => {
    const mockProcessData = {
      title: 'Test Process',
      lanes: [
        {
          id: 'lane1',
          name: 'Lane 1',
          color: '#blue',
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

    it('should perform full render when no previous data', () => {
      const clearSpy = jest.spyOn(renderer, 'clear');
      const renderSwimLanesSpy = jest.spyOn(renderer, 'renderSwimLanes');

      renderer.render(mockProcessData);

      expect(clearSpy).toHaveBeenCalled();
      expect(renderSwimLanesSpy).toHaveBeenCalled();
      expect(renderer.processData).toBe(mockProcessData);
    });

    it('should use differential rendering when appropriate', () => {
      renderer.processData = mockProcessData;

      const renderDifferentialSpy = jest.spyOn(renderer, 'renderDifferential');
      const clearSpy = jest.spyOn(renderer, 'clear');

      const updatedData = { ...mockProcessData };
      renderer.render(updatedData);

      expect(renderDifferentialSpy).toHaveBeenCalled();
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('should force full render when option specified', () => {
      renderer.processData = mockProcessData;

      const clearSpy = jest.spyOn(renderer, 'clear');

      renderer.render(mockProcessData, { forceFull: true });

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('path caching', () => {
    it('should cache calculated paths', () => {
      const fromNode = { id: 'node1', position: { x: 0, y: 0 } };
      const toNode = { id: 'node2', position: { x: 100, y: 100 } };

      const calculatePathSpy = jest.spyOn(renderer, 'calculatePath');

      // First call should calculate
      const path1 = renderer.getCachedPath(fromNode, toNode);
      expect(calculatePathSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const path2 = renderer.getCachedPath(fromNode, toNode);
      expect(calculatePathSpy).toHaveBeenCalledTimes(1);
      expect(path1).toBe(path2);
    });

    it('should limit cache size', () => {
      renderer.maxCacheSize = 2;

      const node1 = { id: '1', position: { x: 0, y: 0 } };
      const node2 = { id: '2', position: { x: 10, y: 10 } };
      const node3 = { id: '3', position: { x: 20, y: 20 } };
      const node4 = { id: '4', position: { x: 30, y: 30 } };

      renderer.getCachedPath(node1, node2);
      renderer.getCachedPath(node2, node3);
      expect(renderer.pathCache.size).toBe(2);

      renderer.getCachedPath(node3, node4);
      expect(renderer.pathCache.size).toBe(2); // Should still be 2
    });
  });

  describe('findNode', () => {
    it('should find node by id', () => {
      renderer.processData = {
        lanes: [
          {
            nodes: [
              { id: 'node1', text: 'Node 1' },
              { id: 'node2', text: 'Node 2' }
            ]
          }
        ]
      };

      const node = renderer.findNode('node2');
      expect(node).toBeTruthy();
      expect(node.text).toBe('Node 2');
    });

    it('should return null for non-existent node', () => {
      renderer.processData = { lanes: [] };
      const node = renderer.findNode('nonexistent');
      expect(node).toBeNull();
    });
  });

  describe('zoom functionality', () => {
    it('should zoom in correctly', () => {
      renderer.scale = 1;
      renderer.zoomIn();
      expect(renderer.scale).toBe(1.1);
    });

    it('should zoom out correctly', () => {
      renderer.scale = 1;
      renderer.zoomOut();
      expect(renderer.scale).toBeCloseTo(0.909, 2);
    });

    it('should not zoom in beyond max', () => {
      renderer.scale = 2.5;
      renderer.zoomIn();
      expect(renderer.scale).toBe(2.5);
    });

    it('should not zoom out beyond min', () => {
      renderer.scale = 0.3;
      renderer.zoomOut();
      expect(renderer.scale).toBe(0.3);
    });
  });

  describe('clear', () => {
    it('should remove all child elements', () => {
      // Add some children
      ['swimlanesGroup', 'phasesGroup', 'nodesGroup', 'connectionsGroup'].forEach(groupName => {
        const group = renderer[groupName];
        const child = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        group.appendChild(child);
      });

      renderer.clear();

      expect(renderer.swimlanesGroup.children.length).toBe(0);
      expect(renderer.phasesGroup.children.length).toBe(0);
      expect(renderer.nodesGroup.children.length).toBe(0);
      expect(renderer.connectionsGroup.children.length).toBe(0);
    });
  });
});
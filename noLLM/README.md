# 🏊 Swim Lane Diagram Visualizer

An interactive, pool-themed swim lane diagram creator for visualizing business processes. Upload JSON process definitions, edit them visually, and export the results.

## Features

### 📤 Import/Export
- **Upload JSON** files with process definitions
- **Drag & Drop** support for file uploads
- **Export to JSON** with formatted structure
- **Export to PNG/SVG** images for presentations
- **Sample data** included for quick start

### ✏️ Interactive Editing
- **Drag nodes** to reposition them anywhere
- **Double-click nodes** to edit properties (text, type, color)
- **Double-click lanes** to edit lane properties
- **Add/remove lanes** dynamically
- **Connect nodes** with labeled connections
- **Undo/Redo** support for all actions

### 🎮 Controls
- **Zoom in/out** for better visibility
- **Fit to screen** option
- **Connection mode** for linking nodes
- **Keyboard shortcuts** for power users

## Quick Start

1. Open `index.html` in a modern web browser
2. Click "Load Sample Process" to see an example
3. Or upload your own JSON file
4. Edit the diagram by:
   - Dragging nodes to reposition
   - Double-clicking to edit
   - Using toolbar buttons for actions

## JSON Format

```json
{
  "title": "Process Name",
  "lanes": [
    {
      "id": "lane_1",
      "name": "Department",
      "color": "#64b5f6",
      "nodes": [
        {
          "id": "node_1",
          "text": "Task Description",
          "type": "process",
          "position": { "x": 100, "y": 50 }
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "node_1",
      "to": "node_2",
      "label": "Flow Label"
    }
  ]
}
```

## Browser Support

Works best in modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Free to use for personal and commercial projects.

## Credits

Created with vanilla JavaScript, SVG, and CSS3 animations.
Icons and emojis are native Unicode characters.

---

<p align="center">
  Made with ❤️ by AuditToolbox <a href="https://www.audittoolbox.com/">AuditToolbox</a> • 
</p>
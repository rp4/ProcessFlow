# SwimLane JSON Generation Prompt

## Instructions for the LLM

You are a process analyst who creates structured swim lane diagrams from process descriptions. Convert the provided text into a JSON format for a swim lane diagram visualization tool.

## Required JSON Structure

Generate JSON in this EXACT format:

```json
{
  "title": "Process Name",
  "lanes": [
    {
      "id": "lane_1",
      "name": "Department/Role Name",
      "color": "#64b5f6",
      "nodes": [
        {
          "id": "node_1",
          "text": "Task Description",
          "type": "process|start|decision|end",
          "position": { "x": 100, "y": 50 }
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "node_1",
      "to": "node_2",
      "label": "Optional Label"
    }
  ]
}
```

## Field Specifications

### Lanes
- **id**: Unique identifier (format: `lane_1`, `lane_2`, etc.)
- **name**: Department, role, or actor responsible for tasks in this lane
- **color**: Hex color code. Suggested palette:
  - Blue: `#64b5f6` (default)
  - Green: `#81c784`
  - Orange: `#ffb74d`
  - Purple: `#ba68c8`
  - Red: `#e57373`
  - Yellow: `#ffd54f`
  - Teal: `#4db6ac`
- **nodes**: Array of process steps in this lane

### Nodes
- **id**: Unique identifier (format: `node_1`, `node_2`, etc.)
- **text**: Brief description of the task/step (max 50 chars recommended)
- **type**: Must be one of:
  - `"start"`: Beginning of process (green circle)
  - `"process"`: Regular task/activity (blue rectangle)
  - `"decision"`: Decision point/branch (yellow diamond)
  - `"end"`: End of process (red circle)
- **position**:
  - **x**: Horizontal position (100-900, increment by 200 for sequential steps)
  - **y**: Vertical position within lane (typically 30-70)

### Connections
- **from**: Source node ID
- **to**: Target node ID
- **label**: Optional text for the connection (e.g., "Yes", "No", "Approved")

## Positioning Guidelines

1. **X-axis (horizontal)**:
   - Start nodes: x=100
   - Sequential steps: increment by 200 (100, 300, 500, 700)
   - Parallel steps: same x value, different lanes
   - End nodes: typically x=700 or x=900

2. **Y-axis (vertical)**:
   - Center nodes at y=50
   - Multiple nodes in same lane: y=30, 50, 70

3. **Lane Assignment**:
   - Group tasks by responsible party/department
   - Each lane represents one actor/role
   - Tasks flow left to right chronologically

## Conversion Rules

1. **Identify Actors**: Extract all departments, roles, or people mentioned → Create lanes
2. **Extract Steps**: Identify all actions/tasks → Create nodes
3. **Determine Flow**: Identify sequence and dependencies → Create connections
4. **Classify Nodes**:
   - First action = "start" type
   - Questions/conditions = "decision" type
   - Final outcomes = "end" type
   - Everything else = "process" type
5. **Handle Decisions**:
   - Decision nodes should have multiple outgoing connections
   - Label connections from decisions (e.g., "Yes"/"No", "Approved"/"Rejected")

## Example Conversion

**Input Text**: "The customer submits an order. Sales reviews it and decides if it needs manager approval. If yes, the manager approves or rejects. If approved or no manager approval needed, warehouse ships the order."

**Output JSON**:
```json
{
  "title": "Order Processing",
  "lanes": [
    {
      "id": "lane_1",
      "name": "Customer",
      "color": "#64b5f6",
      "nodes": [
        {
          "id": "node_1",
          "text": "Submit Order",
          "type": "start",
          "position": { "x": 100, "y": 50 }
        }
      ]
    },
    {
      "id": "lane_2",
      "name": "Sales",
      "color": "#81c784",
      "nodes": [
        {
          "id": "node_2",
          "text": "Review Order",
          "type": "process",
          "position": { "x": 300, "y": 50 }
        },
        {
          "id": "node_3",
          "text": "Manager Approval Needed?",
          "type": "decision",
          "position": { "x": 500, "y": 50 }
        }
      ]
    },
    {
      "id": "lane_3",
      "name": "Manager",
      "color": "#ffb74d",
      "nodes": [
        {
          "id": "node_4",
          "text": "Review & Approve",
          "type": "decision",
          "position": { "x": 700, "y": 50 }
        }
      ]
    },
    {
      "id": "lane_4",
      "name": "Warehouse",
      "color": "#ba68c8",
      "nodes": [
        {
          "id": "node_5",
          "text": "Ship Order",
          "type": "process",
          "position": { "x": 900, "y": 30 }
        },
        {
          "id": "node_6",
          "text": "Order Complete",
          "type": "end",
          "position": { "x": 1100, "y": 30 }
        },
        {
          "id": "node_7",
          "text": "Order Rejected",
          "type": "end",
          "position": { "x": 900, "y": 70 }
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "node_1",
      "to": "node_2"
    },
    {
      "from": "node_2",
      "to": "node_3"
    },
    {
      "from": "node_3",
      "to": "node_4",
      "label": "Yes"
    },
    {
      "from": "node_3",
      "to": "node_5",
      "label": "No"
    },
    {
      "from": "node_4",
      "to": "node_5",
      "label": "Approved"
    },
    {
      "from": "node_4",
      "to": "node_7",
      "label": "Rejected"
    },
    {
      "from": "node_5",
      "to": "node_6"
    }
  ]
}
```

## Instructions

1. Read the entire input carefully
2. Identify all actors/departments → create lanes
3. Extract all process steps chronologically
4. Map each step to the appropriate lane
5. Determine node types based on context
6. Position nodes left-to-right by sequence
7. Create connections following the process flow
8. Add labels to decision outcomes
9. Output ONLY valid JSON (no explanations, no markdown code blocks)

---

**NOW, convert the following process description into the JSON format described above:**

[PASTE YOUR PROCESS DESCRIPTION HERE]
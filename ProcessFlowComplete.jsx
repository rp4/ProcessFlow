import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Sparkles, RotateCcw, AlertTriangle, ShieldCheck, Download, MessageSquare, Plus, X, Trash2, ZoomIn, ZoomOut, Maximize, Paperclip, FileText, File } from 'lucide-react';

const generateId = () => `id-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const INITIAL_NODES = [
  { id: 'start', x: 50, y: 120, title: 'Start Process', risks: [] },
  { id: 'step1', x: 280, y: 120, title: 'Review Document', risks: [] },
];

const INITIAL_EDGES = [
  { id: 'e1', source: 'start', target: 'step1', label: '' },
];

const CHIPS = [
  { label: "Identify risks", prompt: "Identify potential risks in this process flow and add them to the relevant nodes using add_risk." },
  { label: "Add controls", prompt: "Add controls to mitigate the risks on nodes using add_control." },
  { label: "Create invoice flow", prompt: "Clear the graph and create an invoice approval workflow with steps: Receive Invoice, Verify Details, Manager Approval, Finance Review, Payment Processing, Complete. Connect them in sequence." },
];

const SYSTEM_PROMPT = `You are a Process Analyst and Internal Auditor. You help users create process flowcharts with associated risks and controls.

IMPORTANT: You MUST use the provided tools to modify the flowchart. Use them directly.

Available tools:
- add_node: Create a process step (id, title required)
- connect_nodes: Link steps (sourceId, targetId)
- add_risk: Add risk to a node (targetId, name)
- add_control: Add control to mitigate a risk (targetId, riskName, name)
- clear_graph: Remove all nodes and edges

Risk indicators: Red warning = unmitigated risk, Yellow = has controls.

When analyzing documents:
1. First, clear the graph if building a new process
2. Identify the main process steps and create nodes for each
3. Connect the nodes in logical sequence
4. Identify risks at each step (what could go wrong?)
5. Add controls for each risk (how to prevent/detect issues?)

Be thorough in identifying risks like:
- Data entry errors
- Unauthorized access
- Fraud opportunities
- Compliance violations
- Processing delays
- Missing documentation
- Segregation of duties issues

And controls like:
- Approval requirements
- System validations
- Reconciliations
- Access controls
- Audit trails
- Documentation requirements
- Segregation of duties`;

const TOOLS = [
  { name: "add_node", description: "Add a new process step node to the flowchart", input_schema: { type: "object", properties: { id: { type: "string", description: "Unique identifier for the node (use simple ids like step1, step2, etc)" }, title: { type: "string", description: "Title of the process step" } }, required: ["id", "title"] } },
  { name: "connect_nodes", description: "Create a connection/edge between two nodes", input_schema: { type: "object", properties: { sourceId: { type: "string", description: "ID of the source node" }, targetId: { type: "string", description: "ID of the target node" }, label: { type: "string", description: "Optional label for the connection" } }, required: ["sourceId", "targetId"] } },
  { name: "add_risk", description: "Add a risk to a specific node", input_schema: { type: "object", properties: { targetId: { type: "string", description: "ID of the node to add risk to" }, name: { type: "string", description: "Name/description of the risk" } }, required: ["targetId", "name"] } },
  { name: "add_control", description: "Add a control to mitigate a risk", input_schema: { type: "object", properties: { targetId: { type: "string", description: "ID of the node to add risk to" }, riskName: { type: "string", description: "Name of the risk to add control for" }, name: { type: "string", description: "Name/description of the control" } }, required: ["targetId", "riskName", "name"] } },
  { name: "clear_graph", description: "Remove all nodes and edges from the canvas", input_schema: { type: "object", properties: {} } },
];

// Parse XML tool calls from text (fallback)
function parseXMLToolCalls(text) {
  const toolCalls = [];
  const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
  let match;

  while ((match = invokeRegex.exec(text)) !== null) {
    const toolName = match[1];
    const paramsContent = match[2];
    const args = {};

    const paramsRegex = /<parameter\s+name="([^"]+)">([^<]*)<\/parameter>/g;
    let paramMatch;
    while ((paramMatch = paramsRegex.exec(paramsContent)) !== null) {
      args[paramMatch[1]] = paramMatch[2];
    }

    toolCalls.push({ name: toolName, args });
  }

  return toolCalls;
}

// Read file content
async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result;
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        content: content
      });
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    // Read as text for most files
    if (file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xml') ||
        file.name.endsWith('.html') ||
        file.name.endsWith('.js') ||
        file.name.endsWith('.ts') ||
        file.name.endsWith('.py')) {
      reader.readAsText(file);
    } else if (file.type === 'application/pdf') {
      // For PDF, we'll read as base64 but note limitations
      reader.readAsDataURL(file);
    } else {
      // Try to read as text anyway
      reader.readAsText(file);
    }
  });
}

// ============== EDIT MODAL ==============
function EditModal({ node, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(node?.title || '');
  const [risks, setRisks] = useState(node?.risks || []);
  const [newRiskName, setNewRiskName] = useState('');
  const [newControlInputs, setNewControlInputs] = useState({});

  if (!node) return null;

  const handleAddRisk = () => {
    if (!newRiskName.trim()) return;
    setRisks([...risks, { id: generateId(), name: newRiskName.trim(), controls: [] }]);
    setNewRiskName('');
  };

  const handleDeleteRisk = (riskId) => setRisks(risks.filter(r => r.id !== riskId));

  const handleAddControl = (riskId) => {
    const controlName = newControlInputs[riskId];
    if (!controlName?.trim()) return;
    setRisks(risks.map(r => r.id === riskId ? { ...r, controls: [...(r.controls || []), { id: generateId(), name: controlName.trim() }] } : r));
    setNewControlInputs({ ...newControlInputs, [riskId]: '' });
  };

  const handleDeleteControl = (riskId, controlId) => {
    setRisks(risks.map(r => r.id === riskId ? { ...r, controls: r.controls.filter(c => c.id !== controlId) } : r));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 380, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Edit Step</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 20, height: 20, color: '#64748b' }} />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>Risks & Controls ({risks.length})</label>
          {risks.map(risk => (
            <div key={risk.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: risk.controls?.length ? '#eab308' : '#ef4444', flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{risk.name}</span>
                <button onClick={() => handleDeleteRisk(risk.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Trash2 style={{ width: 14, height: 14, color: '#ef4444' }} />
                </button>
              </div>

              <div style={{ marginLeft: 24 }}>
                {risk.controls?.map(control => (
                  <div key={control.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 13 }}>
                    <ShieldCheck style={{ width: 14, height: 14, color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#374151' }}>{control.name}</span>
                    <button onClick={() => handleDeleteControl(risk.id, control)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      <X style={{ width: 12, height: 12, color: '#94a3b8' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input placeholder="Add control..." value={newControlInputs[risk.id] || ''} onChange={(e) => setNewControlInputs({ ...newControlInputs, [risk.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAddControl(risk.id)} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b' }} />
                <button onClick={() => handleAddControl(risk.id)} style={{ padding: '6px 10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  <Plus style={{ width: 12, height: 12 }} />Add
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input placeholder="Add new risk..." value={newRiskName} onChange={(e) => setNewRiskName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRisk()} style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: 'white' }} />
            <button onClick={handleAddRisk} style={{ padding: '10px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <AlertTriangle style={{ width: 14, height: 14 }} />Add
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <button onClick={() => onDelete(node.id)} style={{ flex: 1, padding: 12, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Delete
          </button>
          <button onClick={() => onSave(node.id, { title, risks })} style={{ flex: 2, padding: 12, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== EDGE COMPONENT ==============
function Edge({ edge, nodes, onDelete, zoom }) {
  const source = nodes.find(n => n.id === edge.source);
  const target = nodes.find(n => n.id === edge.target);
  if (!source || !target) return null;

  // Node width is 160, handles are at 50% height
  // Output handle: right: -10, so edge starts at node right edge + handle offset
  // Input handle: left: -10, so edge ends at node left edge - handle offset
  // Estimate node height ~50px for center calculation (padding 12 + content + padding 12)
  const nodeHeight = 50;
  const x1 = source.x + 168;
  const y1 = source.y + nodeHeight / 2;
  const x2 = target.x - 8;
  const y2 = target.y + nodeHeight / 2;
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  return (
    <g>
      <path d={path} fill="none" stroke="#94a3b8" strokeWidth={2 / zoom} markerEnd="url(#arrowhead)" />
      <path d={path} fill="none" stroke="transparent" strokeWidth={15 / zoom} style={{ cursor: 'pointer' }} onClick={() => onDelete(edge.id)} />
    </g>
  );
}

// ============== FILE ATTACHMENT PREVIEW ==============
function FilePreview({ file, onRemove }) {
  const getFileIcon = () => {
    if (file.name.endsWith('.pdf')) return '📄';
    if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) return '📝';
    if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) return '📊';
    if (file.name.endsWith('.csv')) return '📊';
    if (file.name.endsWith('.json')) return '{ }';
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) return '📄';
    return '📎';
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      background: '#f1f5f9',
      borderRadius: 8,
      marginBottom: 8,
      border: '1px solid #e2e8f0'
    }}>
      <span style={{ fontSize: 16 }}>{getFileIcon()}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {(file.size / 1024).toFixed(1)} KB
        </div>
      </div>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
        <X style={{ width: 14, height: 14, color: '#94a3b8' }} />
      </button>
    </div>
  );
}

// ============== MAIN APP ==============
export default function ProcessFlowApp() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const [messages, setMessages] = useState([{ id: '1', role: 'model', content: 'Welcome to Process Flow! 🎉\n\nI can help you build process flowcharts with risks and controls.\n\n📄 Upload a document (policy, procedure, workflow description)\n✍️ Or describe your process in the chat\n\nI\'ll analyze it and create a visual flowchart with identified risks and recommended controls.' }]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);

  const scrollRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, isTyping]);

  // Node dragging
  useEffect(() => {
    if (!draggingNode) return;
    const handleMouseMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      setNodes(ns => ns.map(n => n.id === draggingNode ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n));
    };
    const handleMouseUp = () => setDraggingNode(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [draggingNode, dragOffset, zoom, pan]);

  // Canvas panning
  useEffect(() => {
    if (!isPanning) return;
    const handleMouseMove = (e) => setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
    const handleMouseUp = () => setIsPanning(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isPanning]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.25), 2));
  };

  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setSelectedNode(nodeId);
    setDraggingNode(nodeId);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y
    });
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
    }
  };

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current) {
      setSelectedNode(null);
      setConnectingFrom(null);
    }
  };

  const fitView = () => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + 160));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + 60));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const contentWidth = maxX - minX + 100;
    const contentHeight = maxY - minY + 100;
    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.5);
    setZoom(newZoom);
    setPan({
      x: (rect.width - contentWidth * newZoom) / 2 - minX * newZoom + 50,
      y: (rect.height - contentHeight * newZoom) / 2 - minY * newZoom + 50
    });
  };

  const handleAddNode = () => {
    const id = generateId();
    const count = nodes.length;
    setNodes(ns => [...ns, { id, x: 50 + (count % 4) * 190, y: 70 + Math.floor(count / 4) * 100, title: 'New Step', risks: [] }]);
  };

  const handleDeleteNode = (id) => {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.source !== id && e.target !== id));
    setEditingNode(null);
  };

  const handleDeleteEdge = (id) => setEdges(es => es.filter(e => e.id !== id));

  const handleSaveNode = (id, data) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...data } : n));
    setEditingNode(null);
  };

  const handleOutputHandleClick = (e, nodeId) => {
    e.stopPropagation();
    setConnectingFrom(connectingFrom === nodeId ? null : nodeId);
  };

  const handleInputHandleClick = (e, nodeId) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom !== nodeId) {
      if (!edges.some(edge => edge.source === connectingFrom && edge.target === nodeId)) {
        setEdges(es => [...es, { id: generateId(), source: connectingFrom, target: nodeId, label: '' }]);
      }
    }
    setConnectingFrom(null);
  };

  // File handling
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const newFiles = [];

    for (const file of files) {
      try {
        const fileData = await readFileContent(file);
        newFiles.push(fileData);
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Execute tool calls
  const executeToolCalls = (toolCalls) => {
    let localNodes = [...nodes];
    let localEdges = [...edges];
    let log = [];

    for (const tool of toolCalls) {
      const args = tool.args || tool.input || {};

      if (tool.name === 'clear_graph') {
        localNodes = [];
        localEdges = [];
        log.push("Cleared canvas");
      }
      else if (tool.name === 'add_node') {
        const { id, title } = args;
        const nodeId = id || generateId();
        if (!localNodes.find(n => n.id === nodeId)) {
          const c = localNodes.length;
          localNodes.push({ id: nodeId, x: 50 + (c % 4) * 190, y: 70 + Math.floor(c / 4) * 100, title: title || 'Step', risks: [] });
          log.push(`Added: ${title}`);
        }
      }
      else if (tool.name === 'connect_nodes') {
        const { sourceId, targetId, label } = args;
        if (sourceId && targetId && !localEdges.some(e => e.source === sourceId && e.target === targetId)) {
          localEdges.push({ id: generateId(), source: sourceId, target: targetId, label: label || '' });
          log.push(`Connected: ${sourceId} → ${targetId}`);
        }
      }
      else if (tool.name === 'add_risk') {
        const { targetId, name } = args;
        const i = localNodes.findIndex(n => n.id === targetId);
        if (i !== -1 && name) {
          localNodes[i] = { ...localNodes[i], risks: [...(localNodes[i].risks || []), { id: generateId(), name, controls: [] }] };
          log.push(`Risk: ${name}`);
        }
      }
      else if (tool.name === 'add_control') {
        const { targetId, riskName, name } = args;
        const i = localNodes.findIndex(n => n.id === targetId);
        if (i !== -1 && riskName && name) {
          const risks = (localNodes[i].risks || []).map(r => r.name.toLowerCase() === riskName.toLowerCase() ? { ...r, controls: [...(r.controls || []), { id: generateId(), name }] } : r);
          localNodes[i] = { ...localNodes[i], risks };
          log.push(`Control: ${name}`);
        }
      }
    }

    setNodes(localNodes);
    setEdges(localEdges);
    return log;
  };

  const handleSend = async (text) => {
    if (!text?.trim() && attachedFiles.length === 0) return;

    // Build message content with files
    let userMessageContent = text || '';
    let fileContextForAPI = '';

    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ');
      userMessageContent = text ? `${text}\n\n📎 Attached: ${fileNames}` : `📎 Attached: ${fileNames}`;

      // Build file content for API
      fileContextForAPI = attachedFiles.map(f => {
        // Truncate very large files
        let content = f.content;
        if (content.length > 50000) {
          content = content.substring(0, 50000) + '\n\n[Content truncated due to length...]';
        }
        return `\n\n--- FILE: ${f.name} ---\n${content}\n--- END FILE ---`;
      }).join('');
    }

    setMessages(m => [...m, { id: generateId(), role: 'user', content: userMessageContent }]);
    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);

    const graphState = JSON.stringify({
      nodes: nodes.map(n => ({ id: n.id, title: n.title, risks: n.risks })),
      edges: edges.map(e => ({ source: e.source, target: e.target }))
    });

    const apiMessages = messages.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    // Build the full prompt with file content
    let fullPrompt = `Current graph state:\n${graphState}\n\nUser request: ${text || 'Analyze the attached document and create a process flow with risks and controls.'}`;

    if (fileContextForAPI) {
      fullPrompt += `\n\nATTACHED DOCUMENTS:${fileContextForAPI}\n\nPlease analyze the document(s) above and:
1. Clear the existing graph
2. Create process flow nodes for each major step
3. Connect them in logical sequence
4. Identify risks at each step
5. Add appropriate controls for each risk`;
    }

    apiMessages.push({ role: 'user', content: fullPrompt });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages: apiMessages })
      });

      const data = await res.json();
      let responseText = '';
      let toolCalls = [];

      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') responseText += block.text;
          else if (block.type === 'tool_use') toolCalls.push({ name: block.name, args: block.input });
        }
      }

      // Fallback: Parse XML tool calls
      if (toolCalls.length === 0 && responseText.includes('<invoke')) {
        toolCalls = parseXMLToolCalls(responseText);
      }

      if (toolCalls.length > 0) {
        const log = executeToolCalls(toolCalls);
        let cleanResponse = responseText
          .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
          .replace(/<invoke[\s\S]*?<\/invoke>/g, '')
          .trim();

        if (log.length > 0) {
          cleanResponse = (cleanResponse || 'Done!') + "\n\n📋 " + log.join("\n📋 ");
        }
        setMessages(m => [...m, { id: generateId(), role: 'model', content: cleanResponse || 'Done!' }]);
        setTimeout(fitView, 100);
      } else {
        setMessages(m => [...m, { id: generateId(), role: 'model', content: responseText || "I couldn't process that request." }]);
      }
    } catch (e) {
      setMessages(m => [...m, { id: generateId(), role: 'model', content: "Error: " + e.message }]);
    }

    setIsTyping(false);
  };

  const handleExport = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'process-flow.json';
    a.click();
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ height: 52, background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
        {/* Left side - Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Process Flow</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>AI-Powered Risk & Control Analysis</div>
          </div>
        </div>

        {/* Right side - Connection status, Steps count, Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {connectingFrom && (
            <div style={{ padding: '6px 12px', background: '#dbeafe', color: '#166534', borderRadius: 6, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%' }}></span>
              Click left dot of target
              <button onClick={() => setConnectingFrom(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
                <X style={{ width: 14, height: 14, color: '#166534' }} />
              </button>
            </div>
          )}

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>STEPS</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#334155' }}>{nodes.length}</div>
          </div>

          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Download style={{ width: 14, height: 14 }} /> Export
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f8fafc', cursor: isPanning ? 'grabbing' : draggingNode ? 'grabbing' : 'default' }}
        >
          {/* Toolbar */}
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 20 }}>
            <button onClick={(e) => { e.stopPropagation(); handleAddNode(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>
              <Plus style={{ width: 14, height: 14 }} /> Add Step
            </button>
          </div>

          {/* Zoom Controls */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 20 }}>
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 2))} style={{ width: 32, height: 32, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ZoomIn style={{ width: 16, height: 16, color: '#64748b' }} />
            </button>
            <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.25))} style={{ width: 32, height: 32, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ZoomOut style={{ width: 16, height: 16, color: '#64748b' }} />
            </button>
            <button onClick={fitView} style={{ width: 32, height: 32, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Maximize style={{ width: 16, height: 16, color: '#64748b' }} />
            </button>
            <div style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{Math.round(zoom * 100)}%</div>
          </div>

          {/* Grid background - rendered first so nodes appear on top */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${20 * zoom}px ${20 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px`, pointerEvents: 'none' }} />

          {/* Transformed container */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0 }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 3000, height: 3000, pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>
              <g style={{ pointerEvents: 'auto' }}>
                {edges.map(edge => <Edge key={edge.id} edge={edge} nodes={nodes} onDelete={handleDeleteEdge} zoom={zoom} />)}
              </g>
            </svg>

            {nodes.map(node => {
              const isSelected = selectedNode === node.id;
              const isConnectSource = connectingFrom === node.id;
              const isConnectTarget = connectingFrom && connectingFrom !== node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingNode(node); }}
                  style={{
                    position: 'absolute', left: node.x, top: node.y, width: 160,
                    background: 'white', borderRadius: 8,
                    boxShadow: isSelected ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: draggingNode === node.id ? 'grabbing' : 'grab',
                    userSelect: 'none', borderLeft: '4px solid #3b82f6',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <div
                    onClick={(e) => handleInputHandleClick(e, node.id)}
                    style={{
                      position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)',
                      width: isConnectTarget ? 20 : 16, height: isConnectTarget ? 20 : 16,
                      background: isConnectTarget ? '#22c55e' : '#e2e8f0',
                      borderRadius: '50%', cursor: isConnectTarget ? 'pointer' : 'default',
                      border: '3px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transition: 'all 0.15s ease', zIndex: 5,
                    }}
                  />

                  <div
                    onClick={(e) => handleOutputHandleClick(e, node.id)}
                    style={{
                      position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)',
                      width: 16, height: 16,
                      background: isConnectSource ? '#3b82f6' : '#64748b',
                      borderRadius: '50%', cursor: 'pointer',
                      border: '3px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transition: 'all 0.15s ease', zIndex: 5,
                    }}
                  />

                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', marginBottom: node.risks?.length ? 8 : 0 }}>{node.title}</div>
                    {node.risks?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, paddingTop: 8, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                        {node.risks.map(risk => (
                          <div key={risk.id} title={`${risk.name}${risk.controls?.length ? ' (controlled)' : ''}`}>
                            <AlertTriangle style={{ width: 14, height: 14, color: risk.controls?.length ? '#eab308' : '#ef4444' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div style={{ width: 360, borderLeft: '1px solid #e2e8f0', background: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ height: 44, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', background: '#fafbfc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles style={{ width: 16, height: 16, color: '#3b82f6' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>AI Assistant</span>
            </div>
            <button onClick={() => setMessages([{ id: '1', role: 'model', content: 'Chat cleared. Upload a document or describe a process!' }])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <RotateCcw style={{ width: 14, height: 14, color: '#94a3b8' }} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: 14, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
                  fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  ...(msg.role === 'user' ? { background: '#3e1e293b', color: 'white', borderBottomRightRadius: 4 } : { background: '#f1f5f9', color: '#1e293b', borderBottomLeftRadius: 4 })
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: 16, borderBottomLeftRadius: 4, fontSize: 13, color: '#64748b' }}>Analyzing document...</div>
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
              {CHIPS.map(chip => (
                <button key={chip.label} onClick={() => handleSend(chip.prompt)} disabled={isTyping} style={{ padding: '6px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* File attachments preview */}
          {attachedFiles.length > 0 && (
            <div style={{ padding: '0 14px 10px' }}>
              {attachedFiles.map((file, index) => (
                <FilePreview key={index} file={file} onRemove={() => removeFile(index)} />
              ))}
            </div>
          )}

          <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.json,.csv,.xml,.html,.doc,.docx,.pdf,.js,.ts,.py"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping}
                style={{
                  width: 40, height: 40, background: '#f1f5f9', border: '1px solid #e2e8f0',
                  borderRadius: 8, cursor: isTyping ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isTyping ? 0.5 : 1, flexShrink: 0,
                }}
                title="Attach document"
              >
                <Paperclip style={{ width: 18, height: 18, color: '#64748b' }} />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
                placeholder={attachedFiles.length > 0 ? "Add instructions..." : "Describe your process..."}
                disabled={isTyping}
                style={{ flex: 1, padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 24, fontSize: 14, outline: 'none', background: isTyping ? '#f8fafc' : 'white' }}
              />

              <button
                onClick={() => handleSend(input)}
                disabled={(!input.trim() && attachedFiles.length === 0) || isTyping}
                style={{
                  width: 40, height: 40, background: '#3b82f6', border: 'none',
                  borderRadius: '50%', cursor: (!input.trim() && attachedFiles.length === 0) || isTyping ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: (!input.trim() && attachedFiles.length === 0) || isTyping ? 0.5 : 1, flexShrink: 0
                }}
              >
                <Send style={{ width: 18, height: 18, color: 'white' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {editingNode && <EditModal node={editingNode} onSave={handleSaveNode} onDelete={handleDeleteNode} onClose={() => setEditingNode(null)} />}
    </div>
  );
}

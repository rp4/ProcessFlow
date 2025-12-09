import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import BowTieGraph from './components/BowTieGraph';
import ChatInterface from './components/ChatInterface';
import { INITIAL_REACTFLOW_NODES, INITIAL_REACTFLOW_EDGES } from './constants';
import { ChatMessage, ContentType, MessageRole, NodeType, ProcessNodeData, Risk, Control } from './types';
import { generateProcessResponse } from './services/geminiService';
import { 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection, 
  MarkerType 
} from 'reactflow';

const App: React.FC = () => {
  // State for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_REACTFLOW_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_REACTFLOW_EDGES);

  // State for Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: MessageRole.MODEL,
      content: "Welcome to Process Flow. \n\nUpload a procedure to generate a flowchart, then identify risks and controls.",
      type: ContentType.TEXT,
      timestamp: Date.now()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Sidebar Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  // File Input Ref for Import (Project Level)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Sidebar Resize Handlers ---

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = document.body.clientWidth - mouseMoveEvent.clientX;
        // Constraints: Min 300px, Max 800px or 60% of screen
        if (newWidth >= 300 && newWidth <= Math.min(800, document.body.clientWidth * 0.6)) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      document.body.style.cursor = "col-resize"; // Force cursor during resize
      document.body.style.userSelect = "none";   // Prevent text selection
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // --- Graph Manipulation Handlers ---

  // Defined first so it can be passed to nodes
  const handleUpdateNode = useCallback((id: string, data: Partial<ProcessNodeData>) => {
    setNodes((nds) => nds.map(node => {
      if (node.id === id) {
        return { 
          ...node, 
          data: { 
            ...node.data, 
            ...data 
          } 
        };
      }
      return node;
    }));
  }, [setNodes]);

  // Inject handleUpdateNode into nodes that don't have it (e.g. initial nodes)
  useEffect(() => {
    setNodes((nds) => nds.map(node => {
      if (!node.data.onEdit) {
        return { ...node, data: { ...node.data, onEdit: handleUpdateNode } };
      }
      return node;
    }));
  }, [handleUpdateNode, setNodes]);

  const handleAddNode = (type: NodeType, title?: string, description?: string, desiredId?: string) => {
    const xPos = 100 + (nodes.length * 50); 
    const yPos = 100 + (nodes.length * 50);

    const newNodeId = desiredId || `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const newNode: Node = {
      id: newNodeId,
      type: 'processNode',
      position: { x: xPos, y: yPos },
      data: {
        id: newNodeId,
        type: NodeType.PROCESS_STEP,
        title: title || `New Step`,
        description: description || '',
        risks: [],
        onEdit: handleUpdateNode
      },
    };
    setNodes((nds) => [...nds, newNode]);
    return newNodeId;
  };

  const handleDeleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  };

  const handleConnect = useCallback((params: Connection) => {
     const newEdge = { 
      ...params, 
      id: `e-${Date.now()}`,
      style: { strokeWidth: 2, stroke: '#64748b' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      data: { risks: [] }
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const handleUpdateEdge = (id: string, data: { label?: string, risks?: Risk[] }) => {
    setEdges((eds) => eds.map(e => {
      if (e.id === id) {
        const updatedEdge = { 
          ...e, 
          label: data.label !== undefined ? data.label : e.label,
          data: { 
            ...e.data, 
            risks: data.risks !== undefined ? data.risks : e.data.risks 
          }
        };
        return updatedEdge;
      }
      return e;
    }));
  };

  const handleDeleteEdge = (id: string) => {
    setEdges((eds) => eds.filter(e => e.id !== id));
  };

  // --- Chat Operations ---

  const addMessage = (role: MessageRole, content: string, type: ContentType = ContentType.TEXT, extra?: Partial<ChatMessage>) => {
    const newMsg: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      type,
      timestamp: Date.now(),
      ...extra
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'init-1',
        role: MessageRole.MODEL,
        content: "Welcome to Process Flow.",
        type: ContentType.TEXT,
        timestamp: Date.now()
      }
    ]);
  };

  const handleSendMessage = async (text: string, fileContent?: string) => {
    const userDisplayMessage = text || (fileContent ? "Attached document for analysis." : "...");
    addMessage(MessageRole.USER, userDisplayMessage, ContentType.TEXT, { attachedFileName: fileContent ? "Attached Document" : undefined });
    setIsTyping(true);

    // API Call Context
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content + (m.attachedFileName ? "\n[User attached a file in this turn]" : "") }]
    }));
    
    // Serialize full graph state with Risks and Controls
    const graphContext = JSON.stringify({
      nodes: nodes.map(n => ({ 
        id: n.id, 
        label: n.data.title, 
        description: n.data.description,
        risks: n.data.risks 
      })),
      edges: edges.map(e => ({ 
        id: e.id,
        source: e.source, 
        target: e.target, 
        label: e.label,
        risks: e.data?.risks 
      }))
    });

    const response = await generateProcessResponse(history, text, graphContext, fileContent);
    
    // Execute Tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      let changeLog = "";
      
      let localNodes = [...nodes];
      let localEdges = [...edges];

      // Helper for AI adding nodes
      const addNodeLocally = (title?: string, description?: string, desiredId?: string) => {
         const count = localNodes.length;
         const xPos = (count % 3) * 300;
         const yPos = Math.floor(count / 3) * 150;
         
         const newNodeId = desiredId || `n-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

         const newNode: Node = {
          id: newNodeId,
          type: 'processNode',
          position: { x: xPos, y: yPos },
          data: {
            id: newNodeId,
            type: NodeType.PROCESS_STEP,
            title: title || `Step`,
            description: description || '',
            risks: [],
            onEdit: handleUpdateNode 
          },
        };
        localNodes.push(newNode);
        return newNodeId;
      };

      response.toolCalls.forEach(tool => {
        if (tool.name === 'clear_graph') {
          localNodes = [];
          localEdges = [];
          changeLog += "• Cleared canvas\n";
        }
        else if (tool.name === 'add_node') {
          const { title, description, id } = tool.args;
          addNodeLocally(title, description, id);
          changeLog += `• Added Step: ${title}\n`;
        } 
        else if (tool.name === 'connect_nodes') {
          const { sourceId, targetId, label } = tool.args;
          const newEdge = {
            id: `e-ai-${Date.now()}-${Math.random()}`,
            source: sourceId,
            target: targetId,
            label: label || '',
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
            data: { risks: [] }
          };
          localEdges = addEdge(newEdge, localEdges);
          changeLog += `• Connected ${sourceId} -> ${targetId}\n`;
        }
        else if (tool.name === 'update_node') {
           const { id, title, description } = tool.args;
           const nodeIndex = localNodes.findIndex(n => n.id === id);
           if (nodeIndex !== -1) {
              const n = localNodes[nodeIndex];
              localNodes[nodeIndex] = {
                 ...n,
                 data: { 
                   ...n.data, 
                   title: title || n.data.title, 
                   description: description !== undefined ? description : n.data.description 
                 }
              };
              changeLog += `• Updated Step: ${title || n.data.title}\n`;
           }
        }
        else if (tool.name === 'add_risk') {
          const { targetId, targetType, name, description } = tool.args;
          const newRisk: Risk = { id: uuidv4(), name, description, controls: [] };
          
          if (targetType === 'NODE') {
             const nIndex = localNodes.findIndex(n => n.id === targetId);
             if (nIndex !== -1) {
               const n = localNodes[nIndex];
               const currentRisks = n.data.risks || [];
               localNodes[nIndex] = { ...n, data: { ...n.data, risks: [...currentRisks, newRisk] } };
               changeLog += `• Added Risk to Step: ${name}\n`;
             }
          } else if (targetType === 'EDGE') {
             const eIndex = localEdges.findIndex(e => e.id === targetId);
             if (eIndex !== -1) {
               const e = localEdges[eIndex];
               const currentRisks = (e.data?.risks as Risk[]) || [];
               localEdges[eIndex] = { ...e, data: { ...e.data, risks: [...currentRisks, newRisk] } };
               changeLog += `• Added Risk to Link: ${name}\n`;
             }
          }
        }
        else if (tool.name === 'add_control') {
          const { targetId, targetType, riskName, name, description } = tool.args;
          const newControl: Control = { id: uuidv4(), name, description };
          
          if (targetType === 'NODE') {
            const nIndex = localNodes.findIndex(n => n.id === targetId);
            if (nIndex !== -1) {
              const n = localNodes[nIndex];
              const updatedRisks = (n.data.risks || []).map(r => {
                if (r.name.toLowerCase() === riskName.toLowerCase()) {
                  return { ...r, controls: [...r.controls, newControl] };
                }
                return r;
              });
              localNodes[nIndex] = { ...n, data: { ...n.data, risks: updatedRisks } };
              changeLog += `• Added Control to Risk '${riskName}': ${name}\n`;
            }
          } else if (targetType === 'EDGE') {
             const eIndex = localEdges.findIndex(e => e.id === targetId);
             if (eIndex !== -1) {
               const e = localEdges[eIndex];
               const updatedRisks = ((e.data?.risks as Risk[]) || []).map(r => {
                 if (r.name.toLowerCase() === riskName.toLowerCase()) {
                   return { ...r, controls: [...r.controls, newControl] };
                 }
                 return r;
               });
               localEdges[eIndex] = { ...e, data: { ...e.data, risks: updatedRisks } };
               changeLog += `• Added Control to Link Risk '${riskName}': ${name}\n`;
             }
          }
        }
      });

      setNodes(localNodes);
      setEdges(localEdges);

      if (changeLog) {
        response.text = (response.text || "") + "\n\n**Updates:**\n" + changeLog;
      }
    }

    addMessage(MessageRole.MODEL, response.text || "Graph updated.");
    setIsTyping(false);
  };

  // --- Import / Export Handlers ---

  const handleSaveModel = () => {
    const modelData = {
      metadata: {
        version: '2.0',
        timestamp: new Date().toISOString(),
        appName: 'Process Flow'
      },
      nodes,
      edges
    };
    
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `process-flow-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          // Inject handler into imported nodes
          const importedNodes = data.nodes.map((n: Node) => ({
            ...n,
            data: { ...n.data, onEdit: handleUpdateNode }
          }));
          setNodes(importedNodes);
          setEdges(data.edges);
          addMessage(MessageRole.MODEL, `Imported ${data.nodes.length} steps.`);
        } else {
          addMessage(MessageRole.MODEL, "Invalid file format.");
        }
      } catch (error) {
        console.error("Import error:", error);
        addMessage(MessageRole.MODEL, "Error parsing file.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-blue-100">
      
      {/* HEADER */}
      <header className="h-auto bg-white border-b border-slate-200 flex flex-col shrink-0 z-30 shadow-sm">
        <div className="h-16 flex items-center px-8 justify-between">
           <div className="flex items-center gap-3">
             <img src="https://storage.googleapis.com/toolbox-478717-storage/branding/worker.png" alt="Process Flow" className="w-10 h-10 object-contain" />
             <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Process Flow</h1>
                <span className="text-[10px] font-medium text-slate-400 tracking-wider">by Auditor in the Loop</span>
             </div>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Steps</span>
                <span className="text-sm font-semibold text-slate-700">{nodes.length}</span>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".json"
              />

              <div className="h-8 w-px bg-slate-100"></div>
              
              <button 
                onClick={handleImportClick}
                className="px-3 py-2 text-slate-600 bg-white border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                Import
              </button>
              
              <button 
                onClick={handleSaveModel}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all"
              >
                Save
              </button>
           </div>
        </div>
      </header>

      {/* CONTENT WRAPPER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* MAIN CONTENT: Graph */}
        <main className="flex-1 relative bg-slate-100 min-w-0">
          <BowTieGraph 
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onAddNode={(type) => handleAddNode(type)} 
            onUpdateNode={(id, title, description) => handleUpdateNode(id, { title, description })} 
            onDeleteNode={handleDeleteNode}
            onUpdateEdge={handleUpdateEdge}
            onDeleteEdge={handleDeleteEdge}
          />
        </main>

        {/* Resizer Handle */}
        <div
          onMouseDown={startResizing}
          className={`w-1 hover:w-1.5 cursor-col-resize bg-slate-200 hover:bg-blue-400 transition-all z-50 flex flex-col justify-center items-center group relative select-none ${isResizing ? 'w-1.5 bg-blue-500' : ''}`}
          title="Drag to resize"
        >
             {/* Grip handle visual */}
             <div className={`h-8 w-1 rounded-full transition-colors absolute ${isResizing ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`}></div>
        </div>

        {/* RIGHT SIDEBAR: Chat */}
        <aside 
          style={{ width: sidebarWidth }}
          className="shrink-0 z-40 relative border-l border-slate-200 bg-white shadow-xl shadow-slate-200/50 flex flex-col transition-none"
        >
          <ChatInterface 
            messages={messages} 
            isTyping={isTyping} 
            onSendMessage={handleSendMessage}
            onSuggestionClick={(text) => handleSendMessage(text)}
            onClearChat={handleClearChat}
          />
        </aside>

      </div>
    </div>
  );
};

export default App;
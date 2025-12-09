import React, { useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Edge, 
  Node, 
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ReactFlowProvider,
  Panel,
} from 'reactflow';
import { NodeType, Risk, Control } from '../types';
import ProcessNode from './RiskNode';
import { X, Plus, AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ProcessGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onAddNode: (type: NodeType) => void;
  onUpdateNode: (id: string, title: string, description: string) => void; // Keeping signature but App handles partial
  onDeleteNode: (id: string) => void;
  onUpdateEdge: (id: string, data: { label?: string, risks?: Risk[] }) => void;
  onDeleteEdge: (id: string) => void;
}

const nodeTypes = {
  processNode: ProcessNode,
};

interface EdgeRiskItemProps {
  risk: Risk;
  onUpdate: (r: Risk) => void;
  onRemove: () => void;
}

// Mini component for Edge Risk Item to handle its own control input state
const EdgeRiskItem: React.FC<EdgeRiskItemProps> = ({ risk, onUpdate, onRemove }) => {
    const [newControl, setNewControl] = useState('');
    
    const addControl = () => {
        if(!newControl.trim()) return;
        const ctrl: Control = { id: uuidv4(), name: newControl, description: '' };
        onUpdate({ ...risk, controls: [...risk.controls, ctrl] });
        setNewControl('');
    };

    return (
        <div className="border border-slate-100 rounded p-2 bg-slate-50 text-xs">
            <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-3 h-3 ${risk.controls.length > 0 ? 'text-yellow-500' : 'text-red-500'}`} />
                <span className="font-medium flex-1">{risk.name}</span>
                <button onClick={onRemove} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3"/></button>
            </div>
            <div className="pl-5 space-y-1">
                {risk.controls.map(c => (
                    <div key={c.id} className="flex items-center gap-1 text-[10px] text-slate-500">
                        <ShieldCheck className="w-3 h-3 text-green-500"/>
                        <span>{c.name}</span>
                        <button onClick={() => onUpdate({...risk, controls: risk.controls.filter(x => x.id !== c.id)})} className="ml-auto text-slate-300 hover:text-red-400"><X className="w-2 h-2"/></button>
                    </div>
                ))}
                <div className="flex gap-1 mt-1">
                    <input value={newControl} onChange={e => setNewControl(e.target.value)} placeholder="Add control..." className="w-full border rounded px-1 py-0.5 text-[10px]" />
                    <button onClick={addControl} className="bg-slate-200 hover:bg-slate-300 rounded px-1"><Plus className="w-3 h-3"/></button>
                </div>
            </div>
        </div>
    )
}

const ProcessGraphContent: React.FC<ProcessGraphProps> = ({ 
  nodes, edges, onNodesChange, onEdgesChange, onConnect,
  onAddNode, onDeleteNode, onUpdateEdge, onDeleteEdge
}) => {
  
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  // Edge Edit State
  const [edgeLabelInput, setEdgeLabelInput] = useState('');
  const [edgeRisks, setEdgeRisks] = useState<Risk[]>([]);
  const [newRiskName, setNewRiskName] = useState('');

  React.useEffect(() => {
    // Only keep the delete listener as it is triggered from the node
    const handleNodeDelete = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id } = customEvent.detail;
      onDeleteNode(id);
    };

    window.addEventListener('node-delete', handleNodeDelete);
    
    return () => {
      window.removeEventListener('node-delete', handleNodeDelete);
    };
  }, [onDeleteNode]);

  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEditingEdge(edge);
    setEdgeLabelInput(edge.label as string || '');
    setEdgeRisks((edge.data?.risks as Risk[]) || []);
  };

  const saveEdgeEdit = () => {
    if (editingEdge) {
      onUpdateEdge(editingEdge.id, { label: edgeLabelInput, risks: edgeRisks });
      setEditingEdge(null);
    }
  };

  const deleteEdge = () => {
    if (editingEdge) {
      onDeleteEdge(editingEdge.id);
      setEditingEdge(null);
    }
  };

  const addRisk = () => {
    if (!newRiskName.trim()) return;
    const newRisk: Risk = { id: uuidv4(), name: newRiskName, controls: [] };
    setEdgeRisks([...edgeRisks, newRisk]);
    setNewRiskName('');
  };

  const updateRisk = (riskId: string, updatedRisk: Risk) => {
    setEdgeRisks(edgeRisks.map(r => r.id === riskId ? updatedRisk : r));
  };

  const removeRisk = (riskId: string) => {
    setEdgeRisks(edgeRisks.filter(r => r.id !== riskId));
  };

  return (
    <div className="w-full h-full relative bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        attributionPosition="bottom-right"
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls className="bg-white border border-slate-200 shadow-sm" />
        
        <Panel position="top-center" className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-slate-200 flex gap-2">
          <button 
            onClick={() => onAddNode(NodeType.PROCESS_STEP)} 
            className="flex items-center gap-2 text-xs font-bold text-slate-700 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-400 rounded-md transition-all shadow-sm"
          >
            <span className="text-lg leading-none text-blue-500">+</span> Add Process Step
          </button>
        </Panel>
      </ReactFlow>

      {/* Edge Edit Modal */}
      {editingEdge && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl shadow-2xl border border-slate-200 z-50 w-80 max-h-[500px] flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 mb-4 shrink-0">Edit Link</h3>
          
          <div className="overflow-y-auto flex-1 space-y-4 pr-2 scrollbar-thin">
            {/* Label Input */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Label</label>
              <input 
                type="text" 
                placeholder="e.g., Yes, No, If Valid"
                value={edgeLabelInput}
                onChange={(e) => setEdgeLabelInput(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            {/* Risks Section */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2 flex justify-between">
                Link Risks & Controls
                <span className="text-[10px] bg-slate-100 px-1.5 rounded">{edgeRisks.length}</span>
              </label>
              
              <div className="space-y-2 mb-2">
                  {edgeRisks.map(risk => (
                      <EdgeRiskItem 
                        key={risk.id} 
                        risk={risk} 
                        onUpdate={(r) => updateRisk(risk.id, r)} 
                        onRemove={() => removeRisk(risk.id)} 
                      />
                  ))}
              </div>

              <div className="flex gap-1">
                  <input 
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                    placeholder="Add risk to link..."
                    value={newRiskName}
                    onChange={(e) => setNewRiskName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRisk()}
                  />
                  <button onClick={addRisk} className="bg-slate-800 text-white rounded px-2 hover:bg-slate-700"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-2 mt-4 pt-4 border-t border-slate-100 shrink-0">
             <button onClick={deleteEdge} className="flex-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded">
               Delete
             </button>
             <button onClick={() => setEditingEdge(null)} className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded">
               Cancel
             </button>
             <button onClick={saveEdgeEdit} className="flex-1 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded">
               Save
             </button>
          </div>
        </div>
      )}
      {editingEdge && <div className="absolute inset-0 bg-black/20 z-40" onClick={() => setEditingEdge(null)}></div>}
    </div>
  );
};

const BowTieGraphWrapper: React.FC<ProcessGraphProps> = (props) => (
  <ReactFlowProvider>
    <ProcessGraphContent {...props} />
  </ReactFlowProvider>
);

export default BowTieGraphWrapper;
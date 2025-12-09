import React, { useState, memo, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { ProcessNodeData, Risk, Control } from '../types';
import { Layout, X, Trash2, AlertTriangle, Plus, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ProcessNodeProps {
  id: string;
  data: ProcessNodeData;
}

interface RiskEditItemProps {
  risk: Risk;
  onChange: (r: Risk) => void;
  onDelete: () => void;
}

// Helper to render a single risk item in the edit list
const RiskEditItem: React.FC<RiskEditItemProps> = ({ risk, onChange, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newControlName, setNewControlName] = useState('');

  const addControl = () => {
    if (!newControlName.trim()) return;
    const newControl: Control = { id: uuidv4(), name: newControlName, description: '' };
    onChange({ ...risk, controls: [...risk.controls, newControl] });
    setNewControlName('');
  };

  const deleteControl = (controlId: string) => {
    onChange({ ...risk, controls: risk.controls.filter(c => c.id !== controlId) });
  };

  return (
    <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
        <input 
          className="flex-1 text-xs bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none"
          value={risk.name}
          onChange={(e) => onChange({ ...risk, name: e.target.value })}
          placeholder="Risk Name"
        />
        <button onClick={onDelete} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
      </div>
      
      {isExpanded && (
        <div className="pl-6 space-y-2">
          <div className="space-y-1">
            {risk.controls.map(control => (
              <div key={control.id} className="flex items-center gap-2 text-[10px] text-slate-600 bg-white border border-slate-100 px-2 py-1 rounded">
                <ShieldCheck className="w-3 h-3 text-green-500 shrink-0" />
                <span className="flex-1 truncate">{control.name}</span>
                <button onClick={() => deleteControl(control.id)} className="text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input 
              className="flex-1 text-[10px] border border-slate-200 rounded px-1 py-0.5"
              placeholder="New Control..."
              value={newControlName}
              onChange={(e) => setNewControlName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addControl()}
            />
            <button onClick={addControl} className="bg-slate-200 hover:bg-slate-300 text-slate-600 rounded px-1.5"><Plus className="w-3 h-3" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

// Use memo to prevent unnecessary re-renders in React Flow
const ProcessNode = memo(({ id, data }: ProcessNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit State
  const [tempTitle, setTempTitle] = useState(data.title);
  const [tempRisks, setTempRisks] = useState<Risk[]>(data.risks || []);
  const [newRiskName, setNewRiskName] = useState('');

  // Sync local state with props when they change
  useEffect(() => {
    setTempTitle(data.title);
    setTempRisks(data.risks || []);
  }, [data.title, data.risks]);

  const handleSave = () => {
    if (data.onEdit) {
      data.onEdit(id, { title: tempTitle, risks: tempRisks });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    const event = new CustomEvent('node-delete', {
      detail: { id }
    });
    window.dispatchEvent(event);
    setIsEditing(false); 
  };

  const addNewRisk = () => {
    if (!newRiskName.trim()) return;
    const newRisk: Risk = { id: uuidv4(), name: newRiskName, controls: [] };
    setTempRisks([...tempRisks, newRisk]);
    setNewRiskName('');
  };

  return (
    <>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-slate-400 !-ml-1.5 hover:!bg-blue-500 transition-colors" 
      />

      <div className="relative group">
        {/* Popover for Editing */}
        {isEditing && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-4 animate-in fade-in zoom-in duration-200 cursor-default max-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Edit Step</h4>
              <button onClick={() => setIsEditing(false)}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-1 space-y-4 scrollbar-thin">
              {/* General Section */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                <input 
                  type="text" 
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Risks Section */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2 flex justify-between items-center">
                  Risks & Controls
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{tempRisks.length}</span>
                </label>
                
                <div className="space-y-2 mb-2">
                  {tempRisks.map(risk => (
                    <RiskEditItem 
                      key={risk.id} 
                      risk={risk} 
                      onChange={(updated) => setTempRisks(tempRisks.map(r => r.id === updated.id ? updated : r))}
                      onDelete={() => setTempRisks(tempRisks.filter(r => r.id !== risk.id))}
                    />
                  ))}
                </div>

                <div className="flex gap-1 mt-2">
                  <input 
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5"
                    placeholder="Add new risk..."
                    value={newRiskName}
                    onChange={(e) => setNewRiskName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNewRisk()}
                  />
                  <button onClick={addNewRisk} className="bg-slate-800 text-white rounded px-2 hover:bg-slate-700"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 pt-3 mt-2 border-t border-slate-100 shrink-0">
              <button 
                onClick={handleDelete}
                className="flex-1 text-xs py-2 bg-red-50 text-red-600 border border-red-100 rounded hover:bg-red-100 flex items-center justify-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
              <button 
                onClick={handleSave}
                className="flex-[2] text-xs py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div 
          onDoubleClick={() => setIsEditing(true)}
          className={`
            bg-white border-l-4 border-l-blue-500 hover:border-blue-600
            relative w-52 p-3 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-2
            border-y border-r border-slate-200/80 select-none min-h-[60px]
          `}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm text-slate-800 leading-snug line-clamp-2">{data.title}</span>
            <Layout className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          
          {/* Risk Indicators */}
          {data.risks && data.risks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 mt-1">
              {data.risks.map((risk) => {
                const hasControls = risk.controls && risk.controls.length > 0;
                return (
                  <div key={risk.id} className="group/tooltip relative">
                    <AlertTriangle 
                      className={`w-4 h-4 ${hasControls ? 'text-yellow-500' : 'text-red-500'} fill-current bg-white rounded-full`} 
                    />
                     {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover/tooltip:block z-50">
                      <div className="bg-slate-800 text-white text-[10px] rounded p-2 shadow-xl">
                        <div className="font-bold mb-1 text-amber-300 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" /> {risk.name}
                        </div>
                        {risk.description && <div className="mb-2 opacity-80">{risk.description}</div>}
                        
                        {hasControls ? (
                          <div className="space-y-1">
                             <div className="font-semibold text-slate-400">Controls:</div>
                             {risk.controls.map(c => (
                               <div key={c.id} className="flex items-start gap-1">
                                 <ShieldCheck className="w-3 h-3 text-green-400 shrink-0 top-0.5 relative" />
                                 <span>{c.name}</span>
                               </div>
                             ))}
                          </div>
                        ) : (
                          <div className="text-red-300 italic">No controls defined.</div>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-slate-800 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-slate-400 !-mr-1.5 hover:!bg-blue-500 transition-colors" 
      />
    </>
  );
});

export default ProcessNode;
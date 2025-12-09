export enum NodeType {
  PROCESS_STEP = 'PROCESS_STEP'
}

export interface Control {
  id: string;
  name: string;
  description?: string;
}

export interface Risk {
  id: string;
  name: string;
  description?: string;
  controls: Control[];
}

export interface ProcessNodeData {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  risks: Risk[];
  // Updated to accept partial data update
  onEdit?: (id: string, data: Partial<ProcessNodeData>) => void;
}

export interface EdgeData {
  label?: string;
  risks?: Risk[];
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export enum ContentType {
  TEXT = 'text',
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string; // Text content
  type: ContentType;
  timestamp: number;
  attachedFileName?: string;
}

export interface SimulationResult {
  bin: string;
  frequency: number;
}
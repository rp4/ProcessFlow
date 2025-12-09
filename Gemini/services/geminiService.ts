import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';

const apiKey = process.env.API_KEY || ''; 

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

// --- Tool Definitions ---

const addNodeTool: FunctionDeclaration = {
  name: 'add_node',
  description: 'Add a new process step to the graph. IMPORTANT: Assign a unique "id" if you plan to connect it immediately.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title of the process step (concise)' },
      description: { type: Type.STRING, description: 'Optional details about the step' },
      id: { type: Type.STRING, description: 'Optional unique ID (e.g. "step1"). Use this if you need to connect this node in the same turn.' }
    },
    required: ['title']
  }
};

const connectNodesTool: FunctionDeclaration = {
  name: 'connect_nodes',
  description: 'Connect two existing steps with a directional arrow',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourceId: { type: Type.STRING, description: 'ID of the source step' },
      targetId: { type: Type.STRING, description: 'ID of the target step' },
      label: { type: Type.STRING, description: 'Label for the connection (e.g., "Yes", "On Success")' },
    },
    required: ['sourceId', 'targetId']
  }
};

const updateNodeTool: FunctionDeclaration = {
  name: 'update_node',
  description: 'Update an existing step title or description',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'ID of the node to update' },
      title: { type: Type.STRING, description: 'New title' },
      description: { type: Type.STRING, description: 'New description' },
    },
    required: ['id']
  }
};

const addRiskTool: FunctionDeclaration = {
  name: 'add_risk',
  description: 'Add a Risk to a specific Node or Edge. Returns a riskId to add controls to.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetId: { type: Type.STRING, description: 'ID of the Node or Edge to add the risk to' },
      targetType: { type: Type.STRING, description: 'Either "NODE" or "EDGE"' },
      name: { type: Type.STRING, description: 'Name of the risk' },
      description: { type: Type.STRING, description: 'Description of the risk' },
    },
    required: ['targetId', 'targetType', 'name']
  }
};

const addControlTool: FunctionDeclaration = {
  name: 'add_control',
  description: 'Add a Control to a specific Risk on a Node or Edge.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetId: { type: Type.STRING, description: 'ID of the Node or Edge containing the risk' },
      targetType: { type: Type.STRING, description: 'Either "NODE" or "EDGE"' },
      riskName: { type: Type.STRING, description: 'The exact name of the Risk to attach this control to' },
      name: { type: Type.STRING, description: 'Name of the control' },
      description: { type: Type.STRING, description: 'Description of the control' }
    },
    required: ['targetId', 'targetType', 'riskName', 'name']
  }
};

const clearGraphTool: FunctionDeclaration = {
  name: 'clear_graph',
  description: 'Delete all nodes and edges to start with an empty canvas.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  }
};

export interface GeminiResponse {
  text: string;
  toolCalls?: {
    name: string;
    args: any;
  }[];
}

export const generateProcessResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  currentMessage: string,
  contextData: string, // The current graph state as JSON string
  fileContent?: string // Optional uploaded file content
): Promise<GeminiResponse> => {
  if (!ai) {
    return { text: "API Key not configured. Please ensure process.env.API_KEY is set." };
  }

  try {
    const model = 'gemini-2.5-flash';
    
    let finalUserMessage = `
    Context (Current Graph JSON):
    ${contextData}

    User Query: ${currentMessage}
    `;

    if (fileContent) {
      finalUserMessage += `\n\nUploaded Document Content:\n${fileContent}`;
    }

    // Combine history with the new message
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: finalUserMessage }] }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{
          functionDeclarations: [
            addNodeTool, 
            connectNodesTool, 
            updateNodeTool, 
            clearGraphTool, 
            addRiskTool, 
            addControlTool
          ]
        }]
      }
    });

    const result: GeminiResponse = {
      text: response.text || "",
      toolCalls: []
    };

    // Parse Function Calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      result.toolCalls = response.functionCalls.map(call => ({
        name: call.name,
        args: call.args
      }));
    }

    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "I encountered an error processing the request." };
  }
};
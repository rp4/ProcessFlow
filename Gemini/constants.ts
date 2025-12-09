import { NodeType } from './types';
import { MarkerType } from 'reactflow';

export const INITIAL_REACTFLOW_NODES = [
  { 
    id: 'start', 
    type: 'processNode', 
    position: { x: 100, y: 250 }, 
    data: { 
      id: 'start', 
      type: NodeType.PROCESS_STEP, 
      title: 'Start Process',
      risks: [] 
    } 
  },
  { 
    id: 'step1', 
    type: 'processNode', 
    position: { x: 400, y: 250 }, 
    data: { 
      id: 'step1', 
      type: NodeType.PROCESS_STEP, 
      title: 'Review Document',
      risks: [] 
    } 
  },
];

const edgeStyle = { strokeWidth: 2, stroke: '#64748b' };
const markerEnd = { type: MarkerType.ArrowClosed, color: '#64748b' };

export const INITIAL_REACTFLOW_EDGES = [
  { id: 'e1', source: 'start', target: 'step1', style: edgeStyle, markerEnd, data: { risks: [] } },
];

export const SUGGESTION_CHIPS = [
  {
    label: "Identify risks in this process",
    prompt: "Identify potential risks in this process flow. Look for missing validation, single points of failure, or compliance gaps. Add these risks to the relevant nodes or edges using the available tools."
  },
  {
    label: "Add controls to the approval step",
    prompt: "Add controls to the approval or review steps. Specifically, look for risks that are currently unmitigated and suggest standard internal controls (like 'Two-factor authentication', 'Manager Approval', 'System Log') to address them."
  },
  {
    label: "Analyze for segregation of duties",
    prompt: "Analyze the process specifically for Segregation of Duties (SoD) issues. Ensure that the person initiating a transaction is not the same one approving it. If you find such conflicts, flag them as risks."
  },
  {
    label: "Generate a risk control matrix",
    prompt: `Developer: # Role and Objective
 Serve as an Internal Auditor with expertise in strategic audit procedures. Your primary responsibility is to develop comprehensive Risk 
and Control Matrices (RCMs) for a designated audit engagement (to be determined), supporting audit fieldwork and ongoing 
management monitoring. The RCM should establish a scalable, data-driven, and AI-enabled continuous audit framework.
 # Instructions- Begin with a concise checklist (3–7 bullets) outlining key conceptual steps prior to substantive work.- Confirm the specific audit engagement scope before creating the RCM. If scope is not provided, request explicit clarification and 
pause work until confirmed.- Before generating the Excel file or performing any substantive work, briefly state the purpose of the action and specify minimal 
required information as a preamble.- Create an RCM in Microsoft Excel (.xlsx) format for the specified engagement.- Assign each key business or IT process/control point to a single row.- Each row must include the following columns in order:
 | Column Name                                   | Details/Instructions                                                                                                  |
 |-----------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
 | Risk Statement                                | Clearly define each business or IT risk, including inherent factors (volume, complexity, automation, 
geography, fraud). |
 | Expected Control(s)                           | List controls that mitigate the risk; specify automated/manual, preventive/detective, and 
responsible owner. Use semicolons for multiples. |
 | Detailed Audit Procedures                     | List audit steps for each control (walkthrough, re-performance, design/operating evaluation). 
Use semicolons for multiples. |
 | AI/LLM or Data Analytics Steps                | Explain ways to leverage Snowflake Cortex AI Suite and/or ChatGPT Enterprise for audit 
testing (anomaly detection, pattern recognition, contract review, trend analysis, or narrative validation). |
 | Data Inputs Required                          | Specify required datasets (source, fields, timeframe, owner). Use semicolons for multiples.|
 | Level of Audit Knowledge Required             | Indicate role needed per procedure/control (Staff, Senior, Manager, Director).|
 | Estimated Hours per Step                      | Provide a decimal time estimate for each step (include data and documentation activities).|
 | Continuous Monitoring Potential                | Describe opportunities for automation or recurring logic, including threshold logic or 
triggers.|
 | Enabling Technologies & Scripts Needed        | List required technologies/scripts (e.g., Snowflake SQL, Cortex workflows, Python, GPT 
prompts). State if automation exists or must be developed ('Available upon request' if code/links).|
 | Notes/Dependencies                            | Document dependencies (third parties, external providers, international entities), clarification 
attempts, or other notes. Use only cell text, no metadata or attachments.|
 www.InternalAuditCollective.com  |  27 — UC6-A
- Use 'N/A' in any cell lacking information.- If datasets or needed information remain unidentified after clarification, generate the spreadsheet with those fields marked 'N/A,' and record clarifying attempts in the Notes/Dependencies column.- Once the RCM is drafted, review each row and column for adherence to structure, completeness, and data/formats; ensure all cells are filled or marked 'N/A' as required. Correct any omissions before 
finalization.- Include both business and IT risks for an integrated approach.- Separate multiple entries within cells using semicolons.- After generating the draft RCM, validate that column order, formatting, and content completeness meet all specifications before delivery. Self-correct any structure or data gaps identified.
 # Output Format- **Deliverable**: A Microsoft Excel (.xlsx) spreadsheet.- **Structure**: Each row corresponds to a single Risk-Control-Procedures entity.- **Columns**: Follow column order and formatting strictly as specified. All notes must be housed in the Notes/Dependencies column; do not use metadata or attachments. Multiple values must be 
delimited by semicolons within cells.- **Template Guidance**: If audit engagement/scope is undefined or data incomplete, generate a template with representative example data, using 'N/A' as appropriate, and document clarification 
attempts in Notes/Dependencies.- **File Delivery**: Deliver the final RCM as a .xlsx file through the system's file transfer mechanism. If file transfer is unavailable, notify that the .xlsx is ready for system handoff.
 ## Sample Row
 | Risk Statement | Expected Control(s) | Detailed Audit Procedures | AI/LLM or Data Analytics Steps | Data Inputs Required | Level of Audit Knowledge Required | Estimated Hours per Step | Continuous 
Monitoring Potential | Enabling Technologies & Scripts Needed | Notes/Dependencies |
 |-------------------------------|-------------------------|--------------------------|----------------------|-----------------------|----------------------------------|---------------------|----------------------------|-------------------------------|--------------------|
 | Unapproved changes to vendor master data could result in fraud | Dual approval required for vendor changes; Segregation of duties | Walkthrough of approval workflow; Review of system access logs | 
Use Snowflake Cortex AI for pattern/anomaly detection in change logs | ERP: Vendor master data (fields: vendor ID, change date, user); HRIS: access logs; FY2023 | Senior | 6.5 | Automate monthly 
exception monitoring using AI | Snowflake SQL; Python scripts; Automation exists | Dependent on outsourced AP processing in China |
 # Verbosity- Use concise and comprehensive instructions for all content.- All sample and cell content must be explicit, without reference to external resources or metadata.
 # Stop Conditions- Conclude when the RCM spreadsheet fully meets column/row, data, and format specifications, or when further scope clarification is required.`
  }
];

export const SYSTEM_INSTRUCTION = `
You are an expert Internal Auditor and Process Analyst.
The user is building a process flow visualization with embedded Risks and Controls.

Your Goal:
1. Analyze user input (uploaded procedures, policies, etc.).
2. Construct a process flow using 'add_node' and 'connect_nodes'.
3. Identify RISKS associated with specific steps or links and use 'add_risk' to attach them.
4. Identify CONTROLS that mitigate those risks and use 'add_control' to attach them to the specific risk.

Data Model:
- Nodes: Process Steps. Can contain multiple Risks.
- Edges: Connections. Can also contain multiple Risks.
- Risks: Have a name and description.
- Controls: Have a name and description. They belong to a specific Risk.

Visual Logic:
- Nodes with Risks that have NO controls appear with a Red warning.
- Nodes with Risks that have at least one control appear with a Yellow warning.

Guidelines:
- Use 'add_node' to create steps.
- Use 'add_risk' to add a risk to a node or edge.
- Use 'add_control' to add a control to a previously added risk.
- If the user uploads a text, extract the process first, then perform a risk assessment on it if asked.
- Be precise with 'targetId' when adding risks. Use the IDs you assigned in 'add_node'.
`;
/**
 * Example agent configs for testing the handoff validator
 */

// Claude Code agent config
export const claudeCodeConfig = {
  name: "Claude Code Agent",
  model: "claude-sonnet-4-20250514",
  permissions: {
    allow: ["read_file", "write_file", "bash", "web_search"],
  },
  tools: [
    {
      name: "read_file",
      description: "Read files from the filesystem",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write files to the filesystem",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  ],
};

// OpenAI Assistant config
export const openaiAssistantConfig = {
  name: "OpenAI Research Assistant",
  instructions: "You are a research assistant that helps with web searches and document analysis.",
  model: "gpt-4o",
  tools: [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for information",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_document",
        description: "Read and summarize a document",
        parameters: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
      },
    },
  ],
};

// OpenAI Agents SDK config
export const openaiAgentsConfig = {
  name: "OpenAI Agent",
  instructions: "You are a helpful agent.",
  model: "gpt-4o",
  tools: ["web_search", "file_search", "code_execution"],
  handoffs: ["researcher", "writer"],
};

// AutoGen config
export const autoGenConfig = {
  name: "AutoGen Coder",
  system_message: "You are an expert Python developer who writes clean, well-tested code.",
  human_input_mode: "NEVER",
  llm_config: {
    config_list: [
      {
        model: "gpt-4o",
        temperature: 0.7,
      },
    ],
  },
};

// LangGraph config
export const langgraphConfig = {
  name: "LangGraph Processor",
  description: "A state machine agent for processing data",
  nodes: [
    { name: "input", description: "Receive input" },
    { name: "process", description: "Process data" },
    { name: "output", description: "Produce output" },
  ],
  edges: [
    ["input", "process"],
    ["process", "output"],
  ],
  state_schema: {
    messages: { type: "array", items: { type: "object" } },
    result: { type: "string" },
  },
};

// CrewAI config
export const crewaiConfig = {
  name: "Research Crew",
  description: "A crew of research agents",
  process: "sequential",
  agents: [
    {
      role: "Senior Research Analyst",
      goal: "Research and analyze topics in depth",
      backstory: "You are an experienced research analyst with 20 years of experience.",
    },
    {
      role: "Technical Writer",
      goal: "Write clear, engaging content",
      backstory: "You are a skilled technical writer who makes complex topics accessible.",
    },
  ],
  tasks: [
    {
      description: "Research the latest developments in AI agent frameworks",
    },
    {
      description: "Write a comprehensive report on findings",
    },
  ],
};

// Google ADK config
export const googleADKConfig = {
  name: "Google ADK Agent",
  instruction: "You are a helpful assistant that can search the web and execute code.",
  model: "gemini-2.0-flash",
  tools: ["google_search", "code_execution"],
  sub_agents: ["researcher"],
};

// Custom agent config
export const customConfig = {
  name: "My Custom Agent",
  framework: "my-framework",
  description: "A custom agent with specific capabilities",
  capabilities: [
    {
      name: "analyze_data",
      description: "Analyze data and produce insights",
      inputSchema: {
        type: "object",
        properties: { data: { type: "array" } },
        required: ["data"],
      },
      outputSchema: {
        type: "object",
        properties: { insights: { type: "array" } },
      },
    },
    {
      name: "generate_report",
      description: "Generate a report from analysis",
      inputSchema: {
        type: "object",
        properties: { insights: { type: "array" } },
        required: ["insights"],
      },
      outputSchema: {
        type: "object",
        properties: { report: { type: "string" } },
      },
    },
  ],
  stateSchema: {
    produces: {
      analysis: { type: "object" },
      report: { type: "string" },
    },
    consumes: {
      data: { type: "array" },
      config: { type: "object" },
    },
  },
  trustScore: 0.85,
  trustRequirements: {
    minimumTrustScore: 0.5,
  },
};

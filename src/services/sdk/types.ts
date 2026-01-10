import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface AgentExecutionOptions {
  cwd?: string;
  model?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
  systemPrompt?: string;
  [key: string]: any;
}

export type ClientMessage = 
  | { type: 'start_query'; requestId: string; prompt: string; options?: AgentExecutionOptions }
  | { type: 'interrupt'; requestId: string }
  | { type: 'input'; requestId: string; content: string };

export type ServerMessage = 
  | { type: 'chunk'; requestId: string; data: SDKMessage }
  | { type: 'error'; requestId: string; error: string }
  | { type: 'done'; requestId: string };

export interface SdkCallbacks {
  onMessage: (message: SDKMessage) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

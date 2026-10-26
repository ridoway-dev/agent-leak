import { Severity } from '../types/index.js';

export interface AIAgentCheck {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  check: (filePath: string, content?: string) => boolean;
  remediation: string;
}

export const AI_AGENT_DIRS = ['.claude', '.cursor', '.codex', '.continue', '.cline', '.roo'];

const AGENT_CONTEXT_FILE_NAMES = [
  'context.json',
  'chat-history.json',
  'history.json',
  'session.json',
  'sessions.json',
  'state.json',
  'transcript.jsonl',
  'memory.json',
  'workspace-context.json',
  'prompt-history.json',
];

export const AI_AGENT_CHECKS: AIAgentCheck[] = [
  {
    id: 'agent-context-leak',
    name: 'AI Agent Context / Memory Leak',
    description: 'AI coding agent session state, prompt history, or memory dump detected',
    severity: 'HIGH',
    check: (filePath: string) => {
      const normalized = filePath.replace(/\\/g, '/').toLowerCase();
      const fileName = normalized.split('/').pop() || '';

      // Check if file is a known session state or memory file
      if (AGENT_CONTEXT_FILE_NAMES.includes(fileName)) {
        return true;
      }

      // Check if inside agent internal session directories (excluding harmless skill/rule definitions)
      const isInsideAgentDir = AI_AGENT_DIRS.some(
        (dir) => normalized.includes(`/${dir}/`) || normalized.startsWith(`${dir}/`)
      );

      if (isInsideAgentDir) {
        // Flag state, cache, dumps, and logs inside agent dirs
        if (
          fileName.endsWith('.json') && !fileName.includes('config') && !fileName.includes('schema') ||
          fileName.endsWith('.jsonl') ||
          fileName.endsWith('.log') ||
          fileName.endsWith('.cache')
        ) {
          return true;
        }
      }

      return false;
    },
    remediation: 'Ensure agent context and session histories are excluded from git commits and public repositories.',
  },
  {
    id: 'agent-debug-log',
    name: 'Agent Debug / Execution Log',
    description: 'Log file likely containing agent execution traces or raw terminal outputs',
    severity: 'MEDIUM',
    check: (filePath: string) => {
      const lower = filePath.toLowerCase();
      return (
        lower.includes('agent-debug') ||
        lower.includes('claude-debug') ||
        lower.includes('cursor-debug') ||
        (lower.endsWith('.log') && (lower.includes('agent') || lower.includes('session') || lower.includes('prompt')))
      );
    },
    remediation: 'Agent run logs often record API responses with live tokens. Add *.log to .gitignore.',
  },
  {
    id: 'agent-prompt-dump',
    name: 'Prompt / Transcript Dump',
    description: 'Stored transcript, prompt dump, or model output file',
    severity: 'MEDIUM',
    check: (filePath: string) => {
      const lower = filePath.toLowerCase();
      return (
        lower.includes('prompt-dump') ||
        lower.includes('transcript.jsonl') ||
        lower.includes('chat-history.json')
      );
    },
    remediation: 'Do not commit prompt histories or chat transcripts that might contain credentials.',
  },
];

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export const SEVERITY_LEVELS: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export type FindingType =
  | 'secret'
  | 'sensitive-file'
  | 'connection-string'
  | 'private-key'
  | 'git-history'
  | 'unignored-file'
  | 'ai-agent-leak'
  | 'pii';

export interface Finding {
  id: string; // unique rule identifier
  type: FindingType;
  severity: Severity;
  ruleName: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  maskedValue: string;
  fingerprint: string;
  commitHash?: string; // for git-history
  commitAuthor?: string;
  commitDate?: string;
  isHistorical?: boolean;
  remediation?: string;
}

export interface GitIgnoreAnalysis {
  file: string;
  isIgnored: boolean;
  severity: Severity;
  recommendation: string;
}

export interface AgentLeakConfig {
  failOn?: Severity;
  ignore?: string[];
  scanHistory?: boolean;
  scanImages?: boolean;
  includePii?: boolean;
  maxFileSizeKb?: number;
  rules?: {
    disabled?: string[];
  };
}

export interface ScanResult {
  targetPath: string;
  findings: Finding[];
  totalFilesScanned: number;
  scanDurationMs: number;
  gitIgnoreAnalysis?: GitIgnoreAnalysis[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  hasExceededThreshold: boolean;
}

export interface ScanOptions {
  failOn?: Severity;
  json?: boolean;
  sarif?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  ignore?: string[];
  includePii?: boolean;
  configPath?: string;
  stagedOnly?: boolean;
  maxHistoryCommits?: number;
}

import { Severity } from '../types/index.js';
import { isPlaceholder, maskConnectionString, maskPrivateKey, maskSecret } from '../utils/masking.js';
import { isHighEntropy } from '../utils/entropy.js';

export interface SecretRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  pattern: RegExp;
  maskHandler?: (match: string) => string;
  validator?: (match: string, fullLine: string) => boolean;
  remediation?: string;
}

function extractPasswordFromConnString(url: string): string | null {
  const m = url.match(/:\/\/[^:]+:([^@]+)@/);
  return m ? m[1] : null;
}

export const SECRET_RULES: SecretRule[] = [
  // --- Private Keys ---
  {
    id: 'sec-private-key',
    name: 'Private Key',
    description: 'Cryptographic private key detected in source',
    severity: 'CRITICAL',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
    maskHandler: (match) => maskPrivateKey(match),
    remediation: 'Never commit private keys. Remove immediately and rotate the keypair.',
  },

  // --- Database Connection Strings ---
  {
    id: 'sec-conn-postgres',
    name: 'PostgreSQL Connection String',
    description: 'PostgreSQL connection URI with embedded password',
    severity: 'CRITICAL',
    pattern: /postgres(?:ql)?:\/\/[^\s:'"@]+:[^\s@'"]+@[^\s/:'"@]+(?::\d+)?\/[^\s?'"]+/gi,
    maskHandler: (match) => maskConnectionString(match),
    validator: (match) => {
      const pass = extractPasswordFromConnString(match);
      return Boolean(pass && !isPlaceholder(pass));
    },
    remediation: 'Move database connection URI to environment variables and do not commit passwords.',
  },
  {
    id: 'sec-conn-mysql',
    name: 'MySQL Connection String',
    description: 'MySQL connection URI with embedded password',
    severity: 'CRITICAL',
    pattern: /mysql:\/\/[^\s:'"@]+:[^\s@'"]+@[^\s/:'"@]+(?::\d+)?\/[^\s?'"]+/gi,
    maskHandler: (match) => maskConnectionString(match),
    validator: (match) => {
      const pass = extractPasswordFromConnString(match);
      return Boolean(pass && !isPlaceholder(pass));
    },
    remediation: 'Move database connection URI to environment variables and do not commit passwords.',
  },
  {
    id: 'sec-conn-mongodb',
    name: 'MongoDB Connection String',
    description: 'MongoDB connection string with credentials',
    severity: 'CRITICAL',
    pattern: /mongodb(?:\+srv)?:\/\/[^\s:'"@]+:[^\s@'"]+@[^\s/:'"@]+(?::\d+)?\/[^\s?'"]+/gi,
    maskHandler: (match) => maskConnectionString(match),
    validator: (match) => {
      const pass = extractPasswordFromConnString(match);
      return Boolean(pass && !isPlaceholder(pass));
    },
    remediation: 'Use MongoDB secret management or environment variables without hardcoded credentials.',
  },
  {
    id: 'sec-conn-redis',
    name: 'Redis Connection String',
    description: 'Redis connection string with password',
    severity: 'CRITICAL',
    pattern: /redis:\/\/[^\s:'"@]*:[^\s@'"]+@[^\s/:'"@]+(?::\d+)?/gi,
    maskHandler: (match) => maskConnectionString(match),
    validator: (match) => {
      const pass = extractPasswordFromConnString(match);
      return Boolean(pass && !isPlaceholder(pass));
    },
    remediation: 'Store Redis authentication credentials in environment variables.',
  },

  // --- OpenAI / AI Providers ---
  {
    id: 'sec-openai-key',
    name: 'OpenAI API Key',
    description: 'OpenAI API key detected',
    severity: 'CRITICAL',
    pattern: /\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{20,})\b/g,
    maskHandler: (match) => maskSecret(match, 7, 4),
    validator: (match) => !isPlaceholder(match) && match.length >= 24,
    remediation: 'Rotate this OpenAI key in the platform dashboard and load it from environment variables.',
  },
  {
    id: 'sec-anthropic-key',
    name: 'Anthropic API Key',
    description: 'Anthropic Claude API key detected',
    severity: 'CRITICAL',
    pattern: /\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/g,
    maskHandler: (match) => maskSecret(match, 7, 4),
    validator: (match) => !isPlaceholder(match) && match.length >= 25,
    remediation: 'Rotate this Anthropic API key in Anthropic Console.',
  },

  // --- GitHub Tokens ---
  {
    id: 'sec-github-pat',
    name: 'GitHub Personal Access Token',
    description: 'GitHub personal access token (classic or fine-grained)',
    severity: 'CRITICAL',
    pattern: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,}|gho_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36})\b/g,
    maskHandler: (match) => maskSecret(match, 4, 4),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Revoke this GitHub token under GitHub Settings -> Developer settings -> Personal access tokens.',
  },

  // --- GitLab Tokens ---
  {
    id: 'sec-gitlab-token',
    name: 'GitLab Personal Access Token',
    description: 'GitLab Personal Access Token detected',
    severity: 'CRITICAL',
    pattern: /\b(glpat-[a-zA-Z0-9_-]{20,})\b/g,
    maskHandler: (match) => maskSecret(match, 6, 3),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Revoke and regenerate this GitLab token in GitLab User Settings -> Access Tokens.',
  },

  // --- AWS Keys ---
  {
    id: 'sec-aws-access-key',
    name: 'AWS Access Key ID',
    description: 'Amazon Web Services Access Key ID detected',
    severity: 'CRITICAL',
    pattern: /\b((?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16})\b/g,
    maskHandler: (match) => maskSecret(match, 4, 3),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Deactivate and delete this IAM access key in AWS IAM Console.',
  },
  {
    id: 'sec-aws-secret-key',
    name: 'AWS Secret Access Key',
    description: 'Likely AWS Secret Access Key assignment',
    severity: 'CRITICAL',
    pattern: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*["']([A-Za-z0-9/+=]{40})["']/gi,
    maskHandler: (match) => maskSecret(match, 4, 3),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Rotate this secret key in AWS IAM immediately.',
  },

  // --- Google / Cloud ---
  {
    id: 'sec-google-api-key',
    name: 'Google API Key',
    description: 'Google Cloud / Maps API Key detected',
    severity: 'CRITICAL',
    pattern: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
    maskHandler: (match) => maskSecret(match, 4, 3),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Restrict or regenerate this key in Google Cloud Console -> APIs & Services -> Credentials.',
  },

  // --- Stripe ---
  {
    id: 'sec-stripe-secret',
    name: 'Stripe Secret Key',
    description: 'Live or restricted Stripe secret key',
    severity: 'CRITICAL',
    pattern: /\b((?:sk_live_|rk_live_)[0-9a-zA-Z]{24,})\b/g,
    maskHandler: (match) => maskSecret(match, 8, 4),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Roll this Stripe API key in the Stripe Dashboard immediately.',
  },

  // --- Slack & Discord ---
  {
    id: 'sec-slack-token',
    name: 'Slack Token',
    description: 'Slack bot or user token detected',
    severity: 'CRITICAL',
    pattern: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32})\b/g,
    maskHandler: (match) => maskSecret(match, 6, 4),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Revoke this token in Slack API Developer Portal.',
  },
  {
    id: 'sec-discord-token',
    name: 'Discord Bot Token',
    description: 'Discord bot token detected',
    severity: 'CRITICAL',
    pattern: /\b([MN][A-Za-z0-9]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,39})\b/g,
    maskHandler: (match) => maskSecret(match, 4, 4),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Regenerate this bot token in Discord Developer Portal.',
  },

  // --- JWT ---
  {
    id: 'sec-jwt',
    name: 'JSON Web Token (JWT)',
    description: 'Raw JSON Web Token detected with signature',
    severity: 'HIGH',
    pattern: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    maskHandler: (match) => maskSecret(match, 6, 4),
    validator: (match) => !isPlaceholder(match) && match.split('.').length === 3,
    remediation: 'Ensure tokens are passed dynamically via auth flows, not hardcoded.',
  },

  // --- Generic Bearer Token ---
  {
    id: 'sec-bearer-token',
    name: 'Bearer Token',
    description: 'Authorization Bearer token header or string detected',
    severity: 'HIGH',
    pattern: /Bearer\s+([a-zA-Z0-9_\-\.]{25,})/gi,
    maskHandler: (match) => maskSecret(match, 4, 4),
    validator: (match) => !isPlaceholder(match),
    remediation: 'Avoid hardcoding Authorization bearer headers.',
  },

  // --- Generic High Entropy Key / Password Assignment ---
  {
    id: 'sec-generic-secret',
    name: 'Generic API Key / Secret',
    description: 'High-entropy credential assigned to secret-like variable name',
    severity: 'HIGH',
    pattern: /(?:api_?key|access_?token|auth_?token|secret_?key|client_?secret|private_?token|app_?secret)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi,
    maskHandler: (match) => maskSecret(match, 4, 3),
    validator: (match, fullLine) => {
      // Extract value inside quotes
      const sub = match.match(/["']([A-Za-z0-9_\-]{20,})["']/);
      const val = sub ? sub[1] : match;
      if (isPlaceholder(val)) return false;
      return isHighEntropy(val, 3.6);
    },
    remediation: 'Move sensitive secrets to environment variables or secret store.',
  },
];

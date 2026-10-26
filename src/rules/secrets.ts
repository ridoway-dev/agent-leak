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
  whyItMatters?: string;
  fixGuide?: string;
  agentInstruction?: string;
  rotationUrl?: string;
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
    whyItMatters: 'Anyone with repository read access can decrypt encrypted traffic or impersonate servers.',
    fixGuide: 'Store private keys outside the repository (e.g. in secret managers or mounted volumes). Add file extension to .gitignore.',
    agentInstruction: 'Do not embed private key strings into code. Refactor code to load the key path from process.env.KEY_PATH.',
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
    whyItMatters: 'Embedded database credentials grant full database read/write access to anyone who views this code.',
    fixGuide: 'Use process.env.DATABASE_URL. Provide an uncredentialed placeholder in .env.example.',
    agentInstruction: 'Replace connection string literal with process.env.DATABASE_URL and append placeholder to .env.example.',
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
    whyItMatters: 'Embedded database credentials expose production data and database servers to unauthorized queries.',
    fixGuide: 'Extract URI to process.env.MYSQL_URL or process.env.DATABASE_URL.',
    agentInstruction: 'Replace hardcoded MySQL URL with process.env.DATABASE_URL.',
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
    whyItMatters: 'Database credentials allow malicious actors to dump collections or tamper with data.',
    fixGuide: 'Set MONGODB_URI in your environment or secrets manager.',
    agentInstruction: 'Replace MongoDB string with process.env.MONGODB_URI.',
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
    whyItMatters: 'Unprotected Redis instances can be flushed or used for remote code execution.',
    fixGuide: 'Move Redis URI to REDIS_URL in environment.',
    agentInstruction: 'Load Redis connection string from process.env.REDIS_URL.',
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
    whyItMatters: 'Exposed OpenAI keys are rapidly scraped by bots and cause massive unexpected billing spikes.',
    fixGuide: '1. Revoke the key in platform.openai.com/api-keys. 2. Set OPENAI_API_KEY in .env (add .env to .gitignore). 3. Use process.env.OPENAI_API_KEY in code.',
    agentInstruction: 'Delete the key literal immediately. Use process.env.OPENAI_API_KEY instead. Never echo the key.',
    rotationUrl: 'https://platform.openai.com/api-keys',
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
    whyItMatters: 'Anthropic API keys grant access to Claude models and will be charged directly to your organization.',
    fixGuide: 'Revoke key in console.anthropic.com. Pass ANTHROPIC_API_KEY via environment variables.',
    agentInstruction: 'Replace key literal with process.env.ANTHROPIC_API_KEY.',
    rotationUrl: 'https://console.anthropic.com/settings/keys',
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
    whyItMatters: 'GitHub tokens allow unauthorized access to private repositories, organization settings, and GitHub Actions workflows.',
    fixGuide: '1. Delete the token on GitHub. 2. Create a fine-grained token with minimum permissions. 3. Pass via GITHUB_TOKEN environment variable.',
    agentInstruction: 'Remove GitHub token literal immediately. Use process.env.GITHUB_TOKEN.',
    rotationUrl: 'https://github.com/settings/tokens',
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
    whyItMatters: 'GitLab access tokens allow repository cloning, CI triggering, and project manipulation.',
    fixGuide: 'Revoke in GitLab User Settings -> Access Tokens. Pass via GITLAB_TOKEN in environment.',
    agentInstruction: 'Replace token with process.env.GITLAB_TOKEN.',
    rotationUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
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
    whyItMatters: 'Leaked AWS keys are immediately exploited by automated scrapers to spin up costly compute resources.',
    fixGuide: 'Use AWS IAM roles, AWS SSO, or pass credentials via ~/.aws/credentials instead of hardcoded strings.',
    agentInstruction: 'Remove AWS key literal. Rely on AWS SDK default credential provider chain.',
    rotationUrl: 'https://console.aws.amazon.com/iam/',
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
    whyItMatters: 'Paired with an access key, this grants programmatic API access to AWS infrastructure.',
    fixGuide: 'Remove secret key assignment. Use standard environment variables (AWS_SECRET_ACCESS_KEY).',
    agentInstruction: 'Delete secret key from file and use standard AWS SDK environment variable resolution.',
    rotationUrl: 'https://console.aws.amazon.com/iam/',
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
    whyItMatters: 'Unrestricted Google API keys can incur large charges or consume your API quotas.',
    fixGuide: 'Restrict key by HTTP referrers or IP addresses in Google Cloud Console, and store in environment.',
    agentInstruction: 'Move key to process.env.GOOGLE_API_KEY.',
    rotationUrl: 'https://console.cloud.google.com/apis/credentials',
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
    whyItMatters: 'Stripe live secret keys allow attackers to create charges, initiate refunds, or drain customer balances.',
    fixGuide: 'Roll key in dashboard.stripe.com/apikeys. Use STRIPE_SECRET_KEY in .env.',
    agentInstruction: 'Replace secret key with process.env.STRIPE_SECRET_KEY.',
    rotationUrl: 'https://dashboard.stripe.com/apikeys',
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
    whyItMatters: 'Slack tokens allow reading internal company chats, channels, and posting malicious messages.',
    fixGuide: 'Revoke in api.slack.com/apps. Load SLACK_BOT_TOKEN from environment.',
    agentInstruction: 'Replace token with process.env.SLACK_BOT_TOKEN.',
    rotationUrl: 'https://api.slack.com/apps',
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
    whyItMatters: 'Compromised Discord bot tokens can lead to server bans, unauthorized administration, or phishing.',
    fixGuide: 'Regenerate token in discord.com/developers/applications. Store in DISCORD_TOKEN.',
    agentInstruction: 'Replace token with process.env.DISCORD_TOKEN.',
    rotationUrl: 'https://discord.com/developers/applications',
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
    whyItMatters: 'Hardcoded JWTs may allow impersonation of users or elevated privileges until expiration.',
    fixGuide: 'Generate JWTs dynamically or receive them through authentication handshakes.',
    agentInstruction: 'Remove static JWT literal.',
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
    whyItMatters: 'Bearer tokens allow any client possessing them to access protected API endpoints.',
    fixGuide: 'Pass tokens dynamically via request headers from environment variables.',
    agentInstruction: 'Replace hardcoded bearer token with headers: { Authorization: `Bearer ${token}` }.',
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
    whyItMatters: 'Hardcoded secrets get saved in Git commits and can be extracted from public source code.',
    fixGuide: 'Move secret to environment variables or .env file, and reference via process.env.',
    agentInstruction: 'Replace hardcoded credential with process.env reference.',
  },
];

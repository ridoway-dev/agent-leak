/**
 * Masking and redaction utilities.
 *
 * CRITICAL RULE: Agent Leak must never display or log raw secret values.
 * All finding objects and reporter outputs only see masked values.
 */

const PLACEHOLDER_PATTERNS = [
  /^(your[_-]|my[_-]|example[_-]|test[_-]|dummy[_-]|fake[_-]|sample[_-])/i,
  /(your_api_key|api_key_here|insert_token|placeholder|changeme|todo|replace_me|secret_here|my_token)/i,
  /\b(password|your_password|db_password|secret_password|pass|admin|root|example)\b/i,
  /<[^>]+>/, // e.g. <YOUR_TOKEN> or <API_KEY>
  /\{[A-Z0-9_]+\}/, // e.g. {API_KEY}
  /^test[0-9_-]*$/i,
  /^sk-test-example/i,
  /^sk_test_placeholder/i,
  /^00000000000000000000000000000000$/,
  /^1234567890$/,
  /^abcdef123456/i,
  /^xxxx+$/i,
  /^\*+$/,
];

/**
 * Checks if a matched string is an obvious placeholder or documentation example.
 */
export function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((pat) => pat.test(trimmed));
}

/**
 * Masks a general secret token.
 * E.g. "sk-proj-918237198273918273" -> "sk-p*****************273"
 */
export function maskSecret(secret: string, prefixLen = 4, suffixLen = 3): string {
  if (!secret) return '********';
  const len = secret.length;
  if (len <= 8) {
    return '********';
  }
  const effectivePrefix = Math.min(prefixLen, Math.floor(len / 4));
  const effectiveSuffix = Math.min(suffixLen, Math.floor(len / 4));
  const prefix = secret.slice(0, effectivePrefix);
  const suffix = secret.slice(len - effectiveSuffix);
  const maskedCount = len - effectivePrefix - effectiveSuffix;
  return `${prefix}${'*'.repeat(Math.max(maskedCount, 6))}${suffix}`;
}

/**
 * Masks the password or credentials in database / service URLs.
 * e.g. "postgres://user:password@localhost:5432/mydb"
 *   -> "postgres://user:********@localhost:5432/mydb"
 */
export function maskConnectionString(urlStr: string): string {
  if (!urlStr) return '********';

  // Match protocol://user:pass@host...
  const userPassRegex = /^([a-zA-Z0-9+.-]+:\/\/)([^:@\s]+):([^@\s]+)@(.*)$/;
  const match = urlStr.match(userPassRegex);
  if (match) {
    const [, protocol, user, pass, rest] = match;
    const maskedPass = '*'.repeat(Math.min(Math.max(pass.length, 8), 16));
    return `${protocol}${user}:${maskedPass}@${rest}`;
  }

  // Fallback for simple user:pass or token@host
  return urlStr.replace(/:([^@/\s]{3,})@/, ':********@');
}

/**
 * Masks private key blocks, only revealing the header and footer.
 */
export function maskPrivateKey(keyBlock: string): string {
  const headerMatch = keyBlock.match(/-----BEGIN [A-Z0-9\s_-]+-----/);
  const footerMatch = keyBlock.match(/-----END [A-Z0-9\s_-]+-----/);

  // agent-leak-ignore
  const header = headerMatch ? headerMatch[0] : '-----BEGIN PRIVATE KEY-----';
  const footer = footerMatch ? footerMatch[0] : '-----END PRIVATE KEY-----';

  return `${header}\n  [PRIVATE KEY CONTENT REDACTED BY AGENT-LEAK]\n${footer}`;
}

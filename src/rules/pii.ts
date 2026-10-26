import { Severity } from '../types/index.js';
import { isPlaceholder } from '../utils/masking.js';

export interface PiiRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  pattern: RegExp;
  maskHandler: (match: string) => string;
  validator?: (match: string) => boolean;
  remediation: string;
}

export const PII_RULES: PiiRule[] = [
  {
    id: 'pii-private-ip',
    name: 'Internal / Private IP Address',
    description: 'Internal private network IP address (RFC 1918) detected',
    severity: 'LOW',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    maskHandler: (match) => {
      const parts = match.split('.');
      return `${parts[0]}.${parts[1]}.*.*`;
    },
    validator: (match) => match !== '127.0.0.1' && match !== '0.0.0.0',
    remediation: 'Verify whether internal network topology should be publicly exposed.',
  },
  {
    id: 'pii-email',
    name: 'Personal Email Address',
    description: 'Email address detected in source code or documentation',
    severity: 'INFO',
    pattern: /\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b/g,
    maskHandler: (email) => {
      const [user, domain] = email.split('@');
      const maskedUser = user.length <= 2 ? '*' : `${user[0]}***${user[user.length - 1]}`;
      return `${maskedUser}@${domain}`;
    },
    validator: (match) => {
      const lower = match.toLowerCase();
      if (lower.endsWith('@example.com') || lower.endsWith('@test.com') || lower.endsWith('@localhost')) {
        return false;
      }
      return !isPlaceholder(match);
    },
    remediation: 'Consider using a generic team contact or environment variable if this is a personal email.',
  },
];

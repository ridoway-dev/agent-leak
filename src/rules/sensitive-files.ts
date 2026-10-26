import { Severity } from '../types/index.js';
import { basename } from 'node:path';

export interface SensitiveFileRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  pattern: RegExp;
  remediation: string;
}

export const SENSITIVE_FILE_RULES: SensitiveFileRule[] = [
  // --- Critical ---
  {
    id: 'file-env-production',
    name: 'Production Environment File',
    description: 'Production or local environment file containing live configuration',
    severity: 'CRITICAL',
    pattern: /^\.env(\.production|\.prod|\.local|\.staging)$/i,
    remediation: 'Ensure environment files are added to .gitignore and deleted from version control.',
  },
  {
    id: 'file-env',
    name: 'Environment File',
    description: 'Root environment variable file (.env)',
    severity: 'CRITICAL',
    pattern: /^\.env$/i,
    remediation: 'Add .env to your .gitignore. Use .env.example with placeholder values for sharing templates.',
  },
  {
    id: 'file-private-key-file',
    name: 'Private Key File',
    description: 'SSH or SSL cryptographic private key file',
    severity: 'CRITICAL',
    pattern: /^(id_rsa|id_ed25519|id_dsa|id_ecdsa|.*\.pem|.*\.key|.*\.p12|.*\.pfx)$/i,
    remediation: 'Never store private key files in source repositories. Remove and regenerate them.',
  },
  {
    id: 'file-cloud-credentials',
    name: 'Cloud Credentials File',
    description: 'Cloud provider service account or credential file',
    severity: 'CRITICAL',
    pattern: /^(service-?account.*\.json|credentials\.json|client_secrets?\.json)$/i,
    remediation: 'Remove credential JSON files from repository and manage permissions via IAM / OIDC.',
  },

  // --- High ---
  {
    id: 'file-secrets-config',
    name: 'Secrets Configuration File',
    description: 'Explicit secrets manifest or configuration file',
    severity: 'HIGH',
    pattern: /^(secrets?\.(json|ya?ml)|vault\.(json|ya?ml))$/i,
    remediation: 'Verify whether this file contains unencrypted secrets. Add to .gitignore if so.',
  },
  {
    id: 'file-terraform-vars',
    name: 'Terraform Variable Values',
    description: 'Terraform variable definition file which frequently contains credentials',
    severity: 'HIGH',
    pattern: /.*\.tfvars$/i,
    remediation: 'Ensure terraform .tfvars containing secrets are gitignored.',
  },
  {
    id: 'file-docker-override',
    name: 'Docker Compose Override',
    description: 'Local docker-compose override file often holding environment credentials',
    severity: 'HIGH',
    pattern: /^docker-compose\.override\.(ya?ml)$/i,
    remediation: 'Keep docker-compose.override.yml out of git commits.',
  },

  // --- Medium ---
  {
    id: 'file-database-dump',
    name: 'Database Backup / Dump',
    description: 'Database SQL dump file which may leak user records and password hashes',
    severity: 'MEDIUM',
    pattern: /.*(backup|dump)\.(sql|dump|tar)$/i,
    remediation: 'Database dumps should never be kept in source code repos.',
  },
];

export function checkSensitiveFileName(filePath: string): SensitiveFileRule | null {
  const fileName = basename(filePath);
  // Avoid matching sample files like .env.example as critical
  if (fileName.toLowerCase().includes('.example') || fileName.toLowerCase().includes('.sample') || fileName.toLowerCase().includes('.template')) {
    return null;
  }

  for (const rule of SENSITIVE_FILE_RULES) {
    if (rule.pattern.test(fileName)) {
      return rule;
    }
  }

  return null;
}

import { ScanResult, Severity } from '../types/index.js';

function sarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
    case 'INFO':
    default:
      return 'note';
  }
}

export function renderSarifReport(result: ScanResult): string {
  const rulesMap = new Map<string, any>();

  for (const f of result.findings) {
    if (!rulesMap.has(f.id)) {
      rulesMap.set(f.id, {
        id: f.id,
        name: f.ruleName,
        shortDescription: { text: f.description },
        help: { text: f.remediation || f.description },
        properties: {
          problem: {
            severity: sarifLevel(f.severity),
          },
        },
      });
    }
  }

  const sarifResults = result.findings.map((f) => ({
    ruleId: f.id,
    level: sarifLevel(f.severity),
    message: {
      text: `${f.ruleName}: detected ${f.maskedValue}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: f.file.replace(/\\/g, '/'),
          },
          region: {
            startLine: f.line || 1,
            startColumn: f.column || 1,
          },
        },
      },
    ],
  }));

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'agent-leak',
            version: '0.1.0',
            informationUri: 'https://github.com/ridoway-dev/agent-leak',
            rules: Array.from(rulesMap.values()),
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

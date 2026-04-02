#!/usr/bin/env node
/**
 * XMLNotFound Validator - CLI / EXE Entry Point
 *
 * Usage:
 *   xml-validator <file.xml>              Validate a file
 *   xml-validator --server                Start the REST API
 *   xml-validator --server --port 8080    Start API on custom port
 *   xml-validator --help                  Show help
 */

const fs   = require('fs');
const path = require('path');
const { validateXML } = require('./validator');

const args = process.argv.slice(2);

// ── Help ──────────────────────────────────────────────────────────────────────
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
XMLNotFound Validator v2.0.0
=============================
Validates XML/HTML files. Reports line number and column offset for every issue.

USAGE:
  xml-validator <file>                 Validate an XML/HTML file
  xml-validator --server               Start REST API (default port 3000)
  xml-validator --server --port <n>    Start REST API on custom port
  xml-validator --help                 Show this help

SCENARIOS CHECKED:
  1. Duplicate href values in .cite elements
  2. Double-hyphen "--" inside XML comments   (<!-- text -- more --> is invalid)
  3. Table with only <th> and no <td>         (missing data rows)
  4. Malformed/unknown named entities         (&ndf..553;  &hdfkhsdfb;)

OUTPUT FIELDS PER ISSUE:
  Line   = line number in the file (1-based)
  Offset = column number within that line (1-based)

EXIT CODES:
  0  No issues found
  1  One or more issues found
  2  Error (file not found, unreadable, etc.)
`);
  process.exit(0);
}

// ── Server Mode ───────────────────────────────────────────────────────────────
if (args.includes('--server')) {
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    process.env.PORT = args[portIdx + 1];
  }
  require('./XMLnotfound');
  // server keeps the process alive — no process.exit() here
  return;
}

// ── File Validation Mode ──────────────────────────────────────────────────────
const filePath = args.find(a => !a.startsWith('--'));
if (!filePath) {
  console.error('Error: No file specified. Run with --help for usage.');
  process.exit(2);
}

const resolved = path.resolve(filePath);
if (!fs.existsSync(resolved)) {
  console.error(`Error: File not found: ${resolved}`);
  process.exit(2);
}

let content;
try {
  content = fs.readFileSync(resolved, 'utf8');
} catch (err) {
  console.error(`Error reading file: ${err.message}`);
  process.exit(2);
}

const result = validateXML(content);

if (result.error) {
  console.error(`Validation error: ${result.error}`);
  process.exit(2);
}

// ── Pretty Print ──────────────────────────────────────────────────────────────
const W = 52;
const line = (c = '-') => console.log(c.repeat(W));

console.log('');
line('=');
console.log('  XMLNotFound Validator — Results');
line('=');
console.log(`  File  : ${path.basename(resolved)}`);
console.log(`  Path  : ${resolved}`);
console.log(`  Issues: ${result.totalIssues}`);
line();

if (result.totalIssues === 0) {
  console.log('  OK  No issues detected — XML is valid');
  line('=');
  console.log('');
  process.exit(0);
}

const LABELS = {
  duplicate_cite_href:            'Duplicate .cite href values',
  comment_inside_comment:         'Double-hyphen inside comment',
  table_header_only:              'Table with <th> only (no <td>)',
  invalid_named_entity_malformed: 'Malformed named entity',
  invalid_named_entity_unknown:   'Unknown named entity',
  empty_xmlns_attribute:          'Empty xmlns attribute value',
  malformed_comment_delimiter:    'Malformed comment delimiter (single hyphen)',
  nested_table:                   'Nested <table> inside <table>',
};

let issueNum = 0;

Object.entries(result.scenarios).forEach(([key, issues]) => {
  if (!issues.length) return;

  console.log('');
  console.log(`  [ ${LABELS[key] || key} ]  (${issues.length} issue${issues.length > 1 ? 's' : ''})`);
  line();

  issues.forEach((issue) => {
    issueNum++;
    console.log(`  #${issueNum}  ${issue.message}`);

    // Always print location
    const loc = `Line ${issue.line}, Offset ${issue.offset}`;
    console.log(`       Location : ${loc}`);

    if (issue.entity) {
      console.log(`       Entity   : ${issue.entity}`);
    }
    if (issue.attribute) {
      console.log(`       Attribute: ${issue.attribute}`);
    }
    if (issue.duplicates && issue.duplicates.length) {
      console.log(`       Dupes    : ${issue.duplicates.join(', ')}`);
    }
    if (issue.href) {
      console.log(`       href     : ${issue.href.substring(0, 60)}`);
    }
    if (issue.snippet) {
      const snip = issue.snippet.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`       Snippet  : ${snip.substring(0, 70)}${snip.length > 70 ? '...' : ''}`);
    }
    console.log('');
  });
});

line('=');
console.log(`  Total issues: ${result.totalIssues}`);
line('=');
console.log('');

process.exit(result.totalIssues > 0 ? 1 : 0);

/**
 * XMLNotFound Validator - REST API Server
 * Renamed from server.js → XMLNotFound.js
 *
 * Start:  node XMLNotFound.js
 * Port:   process.env.PORT or 3000
 */

const express = require('express');
const { validateXML } = require('./validator');

const app = express();

// Parse JSON and raw XML/HTML bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['application/xml', 'text/xml', 'text/html'], limit: '10mb' }));

// Allow CORS so the standalone UI HTML file can call this API from the browser
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── GET / — service info ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'XMLNotFound Validator API',
    version: '2.0.0',
    endpoints: {
      'POST /validate': 'Validate XML/HTML — returns issues with line + offset',
      'GET  /health':   'Health check',
    },
    scenarios: [
      '1. Duplicate href values in .cite elements',
      '2. Double-hyphen "--" inside XML comments',
      '3. Table with only <th> and no <td>',
      '4. Invalid/malformed named entities (e.g. &ndf..553;)',
    ],
  });
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── POST /validate ────────────────────────────────────────────────────────────
/**
 * Body options:
 *   JSON:     { "content": "<xml>...</xml>" }
 *   Raw text: send with Content-Type application/xml or text/html
 *
 * Response:
 *   {
 *     totalIssues: number,
 *     scenarios:   { ... },
 *     allIssues:   [{ scenario, message, line, offset, ... }]
 *   }
 */
app.post('/validate', (req, res) => {
  let content = '';

  if (typeof req.body === 'string') {
    content = req.body;
  } else if (req.body && typeof req.body.content === 'string') {
    content = req.body.content;
  } else {
    return res.status(400).json({
      error: 'Missing content. Send { "content": "<xml>..." } or raw XML/HTML body.',
    });
  }

  if (!content.trim()) {
    return res.status(400).json({ error: 'Content is empty.' });
  }

  const result = validateXML(content);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[XMLNotFound] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  XMLNotFound Validator API');
    console.log('  ─────────────────────────────────────');
    console.log(`  Running at : http://localhost:${PORT}`);
    console.log(`  Health     : http://localhost:${PORT}/health`);
    console.log(`  Validate   : POST http://localhost:${PORT}/validate`);
    console.log('  ─────────────────────────────────────');
    console.log('  Press Ctrl+C to stop');
    console.log('');
  });
}

module.exports = app;

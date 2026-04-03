# XMLNotFound Validator

REST API + CLI tool that validates XML/HTML content and reports issues with **line number** and **column offset**.

---

## Scenarios Checked (7)

| # | Scenario | Example |
|---|----------|---------|
| 1 | Duplicate `href` in `.cite` elements | `href="ref1 ref2 ref1"` |
| 2 | Double-hyphen `--` inside XML comments | `<!-- text -- more -->` |
| 3 | Table with `<th>` only, no `<td>` | Missing data rows |
| 4 | Malformed/unknown named entities | `&ndf..553;` `&hdfkhsdfb;` |
| 5 | Empty `xmlns` attribute | `xmlns_=""` `xmlns:foo=""` |
| 6 | Single-hyphen comment delimiter | `<!- text ->` |
| 7 | Nested `<table>` inside `<table>` | Inner table found in outer |

---

## File Structure

```
xmlnotfound-validator/
├── validator.js        ← Core logic — all 7 scenarios
├── XMLnotfound.js      ← REST API server (Express)
├── cli.js              ← CLI / EXE entry point
├── package.json
├── .gitignore
├── run-validator.bat   ← Windows launcher with menu
└── test-sample.xml     ← Sample file with all bad patterns
```

---

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Start REST API on port 3000
npm start

# Validate a file via CLI
node cli.js myfile.xml

# Start API on custom port
node cli.js --server --port 8080
```

---

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/validate` | Validate XML/HTML content |

### POST /validate — Request

**JSON body:**
```json
{ "content": "<root><!-- bad -- comment --></root>" }
```

**Raw XML body:**
```
Content-Type: application/xml
<root>...</root>
```

### POST /validate — Response

```json
{
  "totalIssues": 2,
  "scenarios": {
    "duplicate_cite_href": [],
    "comment_inside_comment": [
      {
        "scenario": "comment_inside_comment",
        "message": "Double hyphen \"--\" inside XML comment",
        "line": 5,
        "offset": 24,
        "snippet": "<!-- bad -- comment -->"
      }
    ],
    "table_header_only": [],
    "invalid_named_entity_malformed": [],
    "invalid_named_entity_unknown": [],
    "empty_xmlns_attribute": [],
    "malformed_comment_delimiter": [],
    "nested_table": []
  },
  "allIssues": [...]
}
```

---

## cURL Examples

```bash
# JSON body
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{"content": "<root><!-- bad -- comment -->&ndf..553;</root>"}'

# Raw XML file
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/xml" \
  --data-binary @myfile.xml

# Health check
curl http://localhost:3000/health
```

---

## Build as EXE (Windows/Linux/Mac)

```bash
npm install
npm run build:win     # → dist/xml-validator-win.exe
npm run build:linux   # → dist/xml-validator-linux
npm run build:mac     # → dist/xml-validator-mac
npm run build:all     # → all three platforms
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port for the REST API server |

---

## Exit Codes (CLI)

| Code | Meaning |
|------|---------|
| `0` | No issues found |
| `1` | Issues detected |
| `2` | Error (file not found, bad args) |

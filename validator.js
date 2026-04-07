/**
 * XMLNotFound Validator - Core Logic v4
 * Scenarios:
 *  1. Duplicate href values in .cite elements
 *  2. Double-hyphen "--" inside XML comment
 *  3. Table with <th> but no <td>
 *  4. Invalid / malformed named entities
 *  5. Empty xmlns attribute  e.g. xmlns_=""  or  xmlns=""
 *  6. Comment starting or ending with single hyphen  <!- ...  or  ... ->
 *  7. Nested <table> inside <table>
 *  8. Citation structure collapsed — malformed <sup> inside .cite element
 *  9. Empty <table> tag — table with no rows or content
 *
 * Every issue includes: line (1-based) and offset/column (1-based)
 */

const VALID_NAMED_ENTITIES = new Set([
  'amp','lt','gt','quot','apos','nbsp','copy','reg','trade',
  'mdash','ndash','laquo','raquo','hellip','euro','pound','yen','cent',
  'times','divide','plusmn','frac12','frac14','frac34','deg','micro',
  'para','middot','bull','prime','Prime','lsquo','rsquo','ldquo','rdquo',
  'sbquo','bdquo','dagger','Dagger','permil','lsaquo','rsaquo','fnof',
  'Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota',
  'Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma','Tau',
  'Upsilon','Phi','Chi','Psi','Omega','alpha','beta','gamma','delta',
  'epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi',
  'omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega',
  'thetasym','upsih','piv','ensp','emsp','thinsp','zwnj','zwj','lrm','rlm',
  'iexcl','curren','brvbar','sect','uml','ordf','sup1','sup2','sup3',
  'acute','macr','cedil','ordm','Agrave','Aacute','Acirc','Atilde','Auml',
  'Aring','AElig','Ccedil','Egrave','Eacute','Ecirc','Euml','Igrave',
  'Iacute','Icirc','Iuml','ETH','Ntilde','Ograve','Oacute','Ocirc','Otilde',
  'Ouml','Oslash','Ugrave','Uacute','Ucirc','Uuml','Yacute','THORN','szlig',
  'agrave','aacute','acirc','atilde','auml','aring','aelig','ccedil','egrave',
  'eacute','ecirc','euml','igrave','iacute','icirc','iuml','eth','ntilde',
  'ograve','oacute','ocirc','otilde','ouml','oslash','ugrave','uacute','ucirc',
  'uuml','yacute','thorn','yuml','OElig','oelig','Scaron','scaron','Yuml',
  'circ','tilde','spades','clubs','hearts','diams','crarr','lArr','uArr',
  'rArr','dArr','hArr','forall','part','exist','empty','nabla','isin',
  'notin','ni','prod','sum','minus','lowast','radic','prop','infin','ang',
  'and','or','cap','cup','int','there4','sim','cong','asymp','ne','equiv',
  'le','ge','sub','sup','nsub','sube','supe','oplus','otimes','perp','sdot',
  'lceil','rceil','lfloor','rfloor','lang','rang','loz',
]);

/**
 * Converts a character index into { line, offset } (both 1-based).
 */
function getLocation(content, index) {
  const before = content.substring(0, index);
  const lines  = before.split('\n');
  return {
    line:   lines.length,
    offset: lines[lines.length - 1].length + 1,
  };
}

// ─── Scenario 1 ──────────────────────────────────────────────────────────────
/** Duplicate href values in .cite elements (any attribute order, multiline). */
function checkDuplicateCiteHrefs(xmlContent) {
  const issues = [];
  const tagRx = /<[a-zA-Z][^>]*?>/gs;
  let m;
  while ((m = tagRx.exec(xmlContent)) !== null) {
    const tag = m[0];
    const classMatch = tag.match(/\bclass=["']([^"']*)["']/i);
    if (!classMatch || !/\bcite\b/i.test(classMatch[1])) continue;
    const hrefMatch = tag.match(/\bhref=["']([^"']*)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].trim();
    if (!href) continue;
    const seen = new Set(), dupes = new Set();
    href.split(/\s+/).filter(Boolean).forEach(v => seen.has(v) ? dupes.add(v) : seen.add(v));
    if (dupes.size > 0) {
      const loc = getLocation(xmlContent, m.index);
      issues.push({
        scenario:   'duplicate_cite_href',
        message:    'Duplicate href value(s) found in .cite element',
        line:       loc.line,
        offset:     loc.offset,
        duplicates: Array.from(dupes),
        href,
        element:    tag.substring(0, 120),
      });
    }
  }
  return issues;
}

// ─── Scenario 2 ──────────────────────────────────────────────────────────────
/** Double-hyphen "--" inside a valid XML/HTML comment body. */
function checkNestedComments(xmlContent) {
  const issues = [];
  const rx = /<!--([\s\S]*?)-->/g;
  let m;
  while ((m = rx.exec(xmlContent)) !== null) {
    const body = m[1];
    if (/--/.test(body)) {
      const innerIdx = body.indexOf('--');
      const exactIdx = m.index + 4 + innerIdx;
      const loc = getLocation(xmlContent, exactIdx);
      issues.push({
        scenario: 'comment_inside_comment',
        message:  'Double hyphen "--" inside XML comment — illegal in XML spec',
        line:     loc.line,
        offset:   loc.offset,
        snippet:  m[0].substring(0, 120),
      });
    }
  }
  return issues;
}

// ─── Scenario 3 ──────────────────────────────────────────────────────────────
/** Table that contains <th> elements but zero <td> elements. */
function checkTableHeaderOnly(xmlContent) {
  const issues = [];
  const rx = /<table[\s\S]*?<\/table>/gi;
  let m;
  while ((m = rx.exec(xmlContent)) !== null) {
    const t = m[0];
    if (/<th[\s>]/i.test(t) && !/<td[\s>]/i.test(t)) {
      const loc = getLocation(xmlContent, m.index);
      issues.push({
        scenario: 'table_header_only',
        message:  'Table has <th> but no <td> elements — missing data cells',
        line:     loc.line,
        offset:   loc.offset,
        snippet:  t.substring(0, 200),
      });
    }
  }
  return issues;
}

// ─── Scenario 4 ──────────────────────────────────────────────────────────────
/** Invalid or malformed named entities e.g. &ndf..553; &hdfkhsdfb; */
function checkInvalidNamedEntities(xmlContent) {
  const issues = [];
  const rx = /&([^;#\s]{1,50}?);/g;
  let m;
  while ((m = rx.exec(xmlContent)) !== null) {
    const name = m[1];
    if (/^#/.test(name)) continue;
    if (VALID_NAMED_ENTITIES.has(name)) continue;
    const isMalformed =
      /\./.test(name)            ||
      /[^a-zA-Z0-9]/.test(name)  ||
      name.length > 20            ||
      /^\d/.test(name);
    const loc = getLocation(xmlContent, m.index);
    issues.push({
      scenario: isMalformed ? 'invalid_named_entity_malformed' : 'invalid_named_entity_unknown',
      message:  isMalformed
        ? `Malformed named entity: &${name};`
        : `Unknown named entity: &${name};`,
      entity:   `&${name};`,
      line:     loc.line,
      offset:   loc.offset,
    });
  }
  return issues;
}

// ─── Scenario 5 ──────────────────────────────────────────────────────────────
/**
 * Empty xmlns attribute — catches both:
 *   xmlns=""          (standard namespace declaration with empty value)
 *   xmlns_=""         (underscore variant sometimes used in editors)
 *   xmlns:prefix=""   (prefixed namespace with empty URI)
 *
 * An empty namespace URI is illegal in XML Namespaces 1.0 §6.
 */
function checkEmptyXmlns(xmlContent) {
  const issues = [];
  // Match xmlns, xmlns_, or xmlns:xxx with an empty quoted value
  const rx = /\b(xmlns(?:_|:[a-zA-Z_][\w.-]*)?\s*=\s*["'])\s*["']/g;
  let m;
  while ((m = rx.exec(xmlContent)) !== null) {
    // Extract the actual attribute name for reporting
    const attrName = m[1].replace(/\s*=\s*["']$/, '').trim();
    const loc = getLocation(xmlContent, m.index);
    issues.push({
      scenario: 'empty_xmlns_attribute',
      message:  `Empty xmlns attribute value: ${attrName}="" — illegal in XML Namespaces spec`,
      attribute: attrName,
      line:     loc.line,
      offset:   loc.offset,
      snippet:  xmlContent.substring(m.index, m.index + 60).replace(/\n/g, ' '),
    });
  }
  return issues;
}

// ─── Scenario 6 ──────────────────────────────────────────────────────────────
/**
 * Malformed comment delimiters — single hyphen instead of double:
 *   <!-  text -->    (opening: only one hyphen after <!)
 *   <!-- text ->     (closing: only one hyphen before >)
 *
 * Valid XML comments must use exactly <!-- ... -->
 */
function checkMalformedCommentDelimiters(xmlContent) {
  const issues = [];

  // Opening: <! followed by exactly ONE hyphen (not two) then non-hyphen content
  // i.e.  <!-  but NOT  <!--
  const openRx = /<!-(?!-)/g;
  let m;
  while ((m = openRx.exec(xmlContent)) !== null) {
    const loc = getLocation(xmlContent, m.index);
    // Grab a snippet to show context
    const snippet = xmlContent.substring(m.index, m.index + 60).replace(/\n/g, ' ');
    issues.push({
      scenario: 'malformed_comment_delimiter',
      message:  'Malformed comment opening: "<!-" — should be "<!--"',
      line:     loc.line,
      offset:   loc.offset,
      snippet,
    });
  }

  // Closing: a single hyphen followed by > but NOT preceded by another hyphen
  // i.e.  ->  used as comment close, not  -->
  // We look for  -?>  where ? is > and the char before - is not -
  // Use a regex that matches [^-]-> to find single-hyphen closes
  const closeRx = /(?<!-)(?<!\s)->/g;  // single -> not preceded by -
  while ((m = closeRx.exec(xmlContent)) !== null) {
    // Avoid matching things like XML/HTML entities, attributes, or general ->
    // Only flag if we can find a preceding <!- (malformed open) or if it looks
    // like it's meant to close a comment (preceded by whitespace/text not code)
    const before = xmlContent.substring(Math.max(0, m.index - 200), m.index);
    if (/<!-(?!-)/.test(before)) {
      const loc = getLocation(xmlContent, m.index);
      const snippet = xmlContent.substring(Math.max(0, m.index - 20), m.index + 20).replace(/\n/g, ' ');
      issues.push({
        scenario: 'malformed_comment_delimiter',
        message:  'Malformed comment closing: "->" — should be "-->"',
        line:     loc.line,
        offset:   loc.offset,
        snippet,
      });
    }
  }

  return issues;
}

// ─── Scenario 7 ──────────────────────────────────────────────────────────────
/**
 * Nested <table> inside <table> — invalid in HTML4/XHTML strict;
 * causes rendering issues in many parsers.
 * Detects a <table> tag that appears inside the content of another <table>.
 */
function checkNestedTables(xmlContent) {
  const issues = [];

  // Find all <table ...> opening positions
  const openRx = /<table[\s>]/gi;
  const openPositions = [];
  let m;
  while ((m = openRx.exec(xmlContent)) !== null) {
    openPositions.push(m.index);
  }

  if (openPositions.length < 2) return issues; // need at least 2 tables

  // For each <table>, find its matching </table> then check if any other
  // <table> starts inside that range
  for (let i = 0; i < openPositions.length; i++) {
    const start = openPositions[i];

    // Find the matching closing </table> by counting open/close tags
    let depth = 0;
    let pos   = start;
    let endPos = -1;
    const scanRx = /<\/?table[\s>]/gi;
    scanRx.lastIndex = start;
    let sm;
    while ((sm = scanRx.exec(xmlContent)) !== null) {
      if (/^<table/i.test(sm[0])) {
        depth++;
      } else {
        depth--;
        if (depth === 0) { endPos = sm.index; break; }
      }
    }
    if (endPos === -1) continue;

    // Check if any OTHER <table> opens between start+1 and endPos
    for (let j = i + 1; j < openPositions.length; j++) {
      const inner = openPositions[j];
      if (inner > start && inner < endPos) {
        const loc = getLocation(xmlContent, inner);
        const outerLoc = getLocation(xmlContent, start);
        issues.push({
          scenario: 'nested_table',
          message:  `Nested <table> found inside another <table> (outer table starts at Line ${outerLoc.line})`,
          line:     loc.line,
          offset:   loc.offset,
          snippet:  xmlContent.substring(inner, inner + 80).replace(/\n/g, ' '),
        });
      }
    }
  }

  return issues;
}


// ─── Scenario 8 ──────────────────────────────────────────────────────────────
/**
 * Citation structure collapsed — malformed <sup> tag inside a .cite element.
 *
 * A structural collapse occurs when an XML/HTML generator corrupts the inner
 * <sup> tag of a citation, leaking the bib-ref number into the tag name itself.
 *
 * Examples of collapsed patterns detected:
 *   <sup129<          — number fused into tag name, unclosed
 *   </sup129>         — number fused into closing tag name
 *   <sup129>          — digit suffix on opening tag name
 *   <sup NNN< span=""> — broken fragment: number + stray attribute
 *
 * Detection strategy:
 *   1. Find every element with class containing "cite".
 *   2. Grab the inner block up to its matching closing tag.
 *   3. Inside that block, scan for malformed <sup…> patterns.
 */
function checkCollapsedCitationStructure(xmlContent) {
  const issues = [];

  // Step 1: find all opening tags that carry class="...cite..."
  const tagRx = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)\s*>/gs;
  let m;

  while ((m = tagRx.exec(xmlContent)) !== null) {
    const tagName  = m[1];
    const attrStr  = m[2];
    const fullOpen = m[0];

    const classM = attrStr.match(/\bclass=["']([^"']*)["']/i);
    if (!classM || !/\bcite\b/i.test(classM[1])) continue;

    const openEnd = m.index + fullOpen.length;

    // Step 2: find matching closing tag depth-aware
    const bothRx = new RegExp(`<\\/?${tagName}[\\s>]`, 'gi');
    bothRx.lastIndex = openEnd;
    let depth = 1, closeIdx = -1, sm;
    while ((sm = bothRx.exec(xmlContent)) !== null) {
      if (/^<\//.test(sm[0])) { depth--; if (depth === 0) { closeIdx = sm.index; break; } }
      else depth++;
    }
    const blockEnd   = closeIdx !== -1 ? closeIdx + `</${tagName}>`.length : Math.min(openEnd + 500, xmlContent.length);
    const innerBlock = xmlContent.substring(openEnd, blockEnd);

    // Step 3: scan for malformed <sup…> patterns

    // Pattern A: <supNNN< or <supNNN> — digit fused into tag name
    const supFusedRx = /<sup(\d+[\w]*)\s*[<>]/gi;
    let sm2;
    while ((sm2 = supFusedRx.exec(innerBlock)) !== null) {
      const absIdx = openEnd + sm2.index;
      const loc = getLocation(xmlContent, absIdx);
      issues.push({
        scenario: 'collapsed_citation_structure',
        message:  `Collapsed citation: malformed <sup> — "${sm2[0].trim()}" (bib ref number leaked into tag name)`,
        line:     loc.line,
        offset:   loc.offset,
        snippet:  xmlContent.substring(absIdx, absIdx + 80).replace(/\n/g, ' '),
        element:  fullOpen.substring(0, 120),
      });
    }

    // Pattern B: </supNNN> — number fused into closing tag
    const supCloseRx = /<\/sup\d+[\w]*\s*>/gi;
    while ((sm2 = supCloseRx.exec(innerBlock)) !== null) {
      const absIdx = openEnd + sm2.index;
      const loc = getLocation(xmlContent, absIdx);
      issues.push({
        scenario: 'collapsed_citation_structure',
        message:  `Collapsed citation: malformed </sup> closing tag — "${sm2[0].trim()}" (should be </sup>)`,
        line:     loc.line,
        offset:   loc.offset,
        snippet:  xmlContent.substring(absIdx, absIdx + 80).replace(/\n/g, ' '),
        element:  fullOpen.substring(0, 120),
      });
    }

    // Pattern C: stray bare number fragment between < and next tag-like token
    // e.g.  <sup129< span="">  — the "< span" signals a broken tag boundary
    const strayFragRx = /<(\d+)\s*</g;
    while ((sm2 = strayFragRx.exec(innerBlock)) !== null) {
      const absIdx = openEnd + sm2.index;
      const loc = getLocation(xmlContent, absIdx);
      issues.push({
        scenario: 'collapsed_citation_structure',
        message:  `Collapsed citation: stray numeric fragment "<${sm2[1]}<" — tag boundary is broken`,
        line:     loc.line,
        offset:   loc.offset,
        snippet:  xmlContent.substring(absIdx, absIdx + 80).replace(/\n/g, ' '),
        element:  fullOpen.substring(0, 120),
      });
    }
  }

  return issues;
}

// ─── Scenario 9 ──────────────────────────────────────────────────────────────
/**
 * Empty <table> tag — a <table> element that contains no meaningful content:
 * no rows (<tr>), no cells (<th>/<td>), no <thead>/<tbody>/<tfoot>/<caption>.
 *
 * Whitespace-only content and comment-only content both count as empty.
 *
 * Examples flagged:
 *   <table></table>
 *   <table>   </table>
 *   <table><!-- placeholder --></table>
 */
function checkEmptyTable(xmlContent) {
  const issues = [];
  const rx = /<table(\s[^>]*)?>[\s\S]*?<\/table>/gi;
  let m;
  while ((m = rx.exec(xmlContent)) !== null) {
    const block    = m[0];
    const stripped = block.replace(/<!--[\s\S]*?-->/g, ''); // strip comments
    const hasMeaningfulContent =
      /<tr[\s>]/i.test(stripped)     ||
      /<th[\s>]/i.test(stripped)     ||
      /<td[\s>]/i.test(stripped)     ||
      /<thead[\s>]/i.test(stripped)  ||
      /<tbody[\s>]/i.test(stripped)  ||
      /<tfoot[\s>]/i.test(stripped)  ||
      /<caption[\s>]/i.test(stripped);
    if (!hasMeaningfulContent) {
      const loc = getLocation(xmlContent, m.index);
      issues.push({
        scenario: 'empty_table',
        message:  'Empty <table> element — contains no rows, cells, or structural content',
        line:     loc.line,
        offset:   loc.offset,
        snippet:  block.replace(/\s+/g, ' ').substring(0, 120),
      });
    }
  }
  return issues;
}

// ─── Main entry point ────────────────────────────────────────────────────────
function validateXML(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return { error: 'Invalid input: expected a non-empty XML/HTML string' };
  }

  const results = {
    totalIssues: 0,
    scenarios: {
      duplicate_cite_href:              [],
      comment_inside_comment:           [],
      table_header_only:                [],
      invalid_named_entity_malformed:   [],
      invalid_named_entity_unknown:     [],
      empty_xmlns_attribute:            [],
      malformed_comment_delimiter:      [],
      nested_table:                     [],
      collapsed_citation_structure:     [],
      empty_table:                      [],
    },
    allIssues: [],
  };

  [
    checkDuplicateCiteHrefs(xmlContent),
    checkNestedComments(xmlContent),
    checkTableHeaderOnly(xmlContent),
    checkInvalidNamedEntities(xmlContent),
    checkEmptyXmlns(xmlContent),
    checkMalformedCommentDelimiters(xmlContent),
    checkNestedTables(xmlContent),
    checkCollapsedCitationStructure(xmlContent),
    checkEmptyTable(xmlContent),
  ].forEach(checks => {
    checks.forEach(issue => {
      results.allIssues.push(issue);
      if (results.scenarios[issue.scenario]) {
        results.scenarios[issue.scenario].push(issue);
      }
    });
  });

  results.totalIssues = results.allIssues.length;
  return results;
}

module.exports = { validateXML };

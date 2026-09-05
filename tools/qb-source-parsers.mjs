function findActionBody(source, signature, label = signature) {
  const text = String(source || '');
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`${label}: missing ${signature}`);
  const open = text.indexOf('{', start + signature.length);
  if (open < 0) throw new Error(`${label}: missing opening brace for ${signature}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1] || '';
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error(`${label}: unterminated ${signature}`);
}

const KEY_LITERAL_SOURCE = String.raw`(?:(?:u)?["']([^"']+)["'](?:_qs|_s)?|QStringLiteral\(\s*["']([^"']+)["']\s*\)|QLatin1String\(\s*["']([^"']+)["']\s*\))`;
const KEY_LITERAL_RE = new RegExp(`^\\s*${KEY_LITERAL_SOURCE}\\s*$`);
const DATA_KEY_RE = new RegExp(String.raw`data\s*\[\s*${KEY_LITERAL_SOURCE}\s*\]`, 'g');
const SETTER_GUARD_RE = new RegExp(String.raw`(?:m\.contains|hasKey)\s*\(\s*(${KEY_LITERAL_SOURCE})\s*\)`, 'g');

function capturedKey(match, offset = 1) {
  for (let i = offset; i < match.length; i++) {
    if (typeof match[i] === 'string' && match[i]) return match[i];
  }
  return '';
}

function parseKeyLiteral(raw) {
  const match = KEY_LITERAL_RE.exec(String(raw || ''));
  return match ? capturedKey(match, 1) : '';
}

function setterType(segment) {
  const conversions = [...String(segment || '').matchAll(/\.to(Bool|Int|UInt|LongLong|ULongLong|Double|Float|String|ByteArray|Array|List|Map|Hash|Object)\s*\(/g)];
  if (!conversions.length) return null;
  const kind = conversions[0][1];
  if (kind === 'Bool') return 'boolean';
  if (['Int','UInt','LongLong','ULongLong','Double','Float'].includes(kind)) return 'number';
  if (['String','ByteArray'].includes(kind)) return 'string';
  if (['Array','List'].includes(kind)) return 'array';
  if (['Map','Hash','Object'].includes(kind)) return 'object';
  return null;
}

export function isolatePreferencesAction(source, label = 'source') {
  return findActionBody(source, 'void AppController::preferencesAction()', label);
}

export function isolateSetPreferencesAction(source, label = 'source') {
  return findActionBody(source, 'void AppController::setPreferencesAction()', label);
}

export function extractPreferenceKeys(source, label = 'source') {
  const body = isolatePreferencesAction(source, label);
  const keys = new Set();
  DATA_KEY_RE.lastIndex = 0;
  for (const match of body.matchAll(DATA_KEY_RE)) {
    const key = capturedKey(match, 1);
    if (key) keys.add(key);
  }
  const out = [...keys].sort();
  if (!out.length) throw new Error(`${label}: extracted zero Preferences from preferencesAction`);
  return out;
}

export function extractPreferenceSetterHints(source, label = 'source') {
  const body = isolateSetPreferencesAction(source, label);
  const guards = [];
  SETTER_GUARD_RE.lastIndex = 0;
  for (const match of body.matchAll(SETTER_GUARD_RE)) {
    const key = parseKeyLiteral(match[1]);
    if (key) guards.push({ key, index: match.index, end: match.index + match[0].length });
  }
  const hints = new Map();
  for (let i = 0; i < guards.length; i++) {
    const current = guards[i];
    const end = guards[i + 1]?.index ?? body.length;
    const segment = body.slice(current.end, end);
    const type = setterType(segment);
    const previous = hints.get(current.key);
    if (!previous || (!previous.type && type)) {
      hints.set(current.key, {
        key: current.key,
        setterPresent: true,
        type,
        writable: !!type,
        source: 'UPSTREAM_SETTER',
        sourceConfidence: type ? 'HIGH' : 'UNRESOLVED'
      });
    }
  }
  return hints;
}

export function extractPreferenceDescriptors(source, label = 'source') {
  const keys = extractPreferenceKeys(source, label);
  const setters = extractPreferenceSetterHints(source, label);
  return keys.map((key) => {
    const hint = setters.get(key);
    if (hint) return { ...hint };
    return {
      key,
      setterPresent: false,
      type: null,
      writable: false,
      source: 'UPSTREAM_SURFACE',
      sourceConfidence: 'READ_ONLY_OR_UNRESOLVED'
    };
  });
}

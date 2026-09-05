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

function compactExpression(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readAssignmentExpression(body, start) {
  let index = start;
  while (/\s/.test(body[index] || '')) index++;
  if (body[index] !== '=') return null;
  index++;
  const begin = index;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (; index < body.length; index++) {
    const ch = body[index];
    const next = body[index + 1] || '';
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; index++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; index++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; index++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);
    else if (ch === ';' && paren === 0 && bracket === 0 && brace === 0) {
      return compactExpression(body.slice(begin, index));
    }
  }
  return null;
}

function getterType(expression) {
  const value = compactExpression(expression);
  if (!value) return null;
  if (/^(?:true|false)$/.test(value)) return 'boolean';
  if (/^(?:[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|0x[0-9a-fA-F]+)$/.test(value)) return 'number';
  if (/\bstatic_cast\s*<\s*(?:u?int\d*_t|q?u?int\d*|unsigned(?:\s+long(?:\s+long)?)?|signed(?:\s+long(?:\s+long)?)?|int|long(?:\s+long)?|float|double|qsizetype|size_t)\s*>/.test(value)) return 'number';
  if (/\bUtils::String::fromEnum\s*\(/.test(value)) return 'string';
  if (/\.toString\s*\(|\.join\s*\(|\bQStringLiteral\s*\(|\bQLatin1String\s*\(/.test(value)) return 'string';
  if (/^(?:u)?["']/.test(value) || /["'](?:_qs|_s)$/.test(value)) return 'string';
  if (/\bQJsonArray\b|\bQVariantList\b/.test(value)) return 'array';
  if (/\bQJsonObject\b|\bQVariantMap\b|\bQVariantHash\b/.test(value)) return 'object';
  return null;
}

function getterKind(expression, type) {
  const value = compactExpression(expression);
  if (/\bUtils::String::fromEnum\s*\(/.test(value)) return 'ENUM_STRING';
  if (type === 'boolean') return 'BOOLEAN';
  if (type === 'number') return 'NUMBER';
  if (type === 'string') return 'STRING';
  if (type === 'array') return 'ARRAY';
  if (type === 'object') return 'OBJECT';
  return 'UNKNOWN';
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

function setterKind(segment, type) {
  const value = String(segment || '');
  if (/\bUtils::String::toEnum\s*\(/.test(value)) return 'ENUM_STRING';
  if (type === 'boolean') return 'BOOLEAN';
  if (type === 'number') return 'NUMBER';
  if (type === 'string') return 'STRING';
  if (type === 'array') return 'ARRAY';
  if (type === 'object') return 'OBJECT';
  return 'UNKNOWN';
}

function enumFallback(segment) {
  const match = String(segment || '').match(/\bUtils::String::toEnum\s*\(\s*[^,]+,\s*([A-Za-z_][A-Za-z0-9_:]*)\s*\)/);
  if (!match) return { expression: null, value: null, confidence: null };
  const expression = match[1];
  const value = expression.split('::').filter(Boolean).at(-1) || null;
  return { expression, value, confidence: value ? 'MEDIUM' : null };
}

function typeAgreement(readType, writeType, getterPresent, setterPresent) {
  if (readType && writeType) return readType === writeType ? 'EXACT' : 'MISMATCH';
  if (getterPresent && !setterPresent) return 'READ_ONLY';
  if (readType && setterPresent && !writeType) return 'WRITE_UNRESOLVED';
  if (!readType && writeType) return 'READ_UNRESOLVED';
  if (!getterPresent && setterPresent) return 'WRITE_ONLY';
  return 'UNRESOLVED';
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

export function extractPreferenceGetterHints(source, label = 'source') {
  const body = isolatePreferencesAction(source, label);
  const hints = new Map();
  DATA_KEY_RE.lastIndex = 0;
  for (const match of body.matchAll(DATA_KEY_RE)) {
    const key = capturedKey(match, 1);
    if (!key) continue;
    const expression = readAssignmentExpression(body, match.index + match[0].length);
    const type = getterType(expression);
    const previous = hints.get(key);
    if (!previous || (!previous.readType && type)) {
      hints.set(key, {
        key,
        getterPresent: true,
        readType: type,
        getterKind: getterKind(expression, type),
        getterSource: 'UPSTREAM_GETTER',
        getterConfidence: type ? 'HIGH' : 'UNRESOLVED'
      });
    }
  }
  return hints;
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
    const fallback = enumFallback(segment);
    const previous = hints.get(current.key);
    if (!previous || (!previous.writeType && type)) {
      hints.set(current.key, {
        key: current.key,
        setterPresent: true,
        writeType: type,
        setterKind: setterKind(segment, type),
        setterSource: 'UPSTREAM_SETTER',
        setterConfidence: type ? 'HIGH' : 'UNRESOLVED',
        upstreamFallbackExpression: fallback.expression,
        upstreamFallbackValue: fallback.value,
        upstreamFallbackConfidence: fallback.confidence
      });
    }
  }
  return hints;
}

export function extractPreferenceDescriptors(source, label = 'source') {
  const keys = extractPreferenceKeys(source, label);
  const getters = extractPreferenceGetterHints(source, label);
  const setters = extractPreferenceSetterHints(source, label);
  return keys.map((key) => {
    const getter = getters.get(key) || {
      key,
      getterPresent: true,
      readType: null,
      getterKind: 'UNKNOWN',
      getterSource: 'UPSTREAM_GETTER',
      getterConfidence: 'UNRESOLVED'
    };
    const setter = setters.get(key) || {
      key,
      setterPresent: false,
      writeType: null,
      setterKind: 'NONE',
      setterSource: null,
      setterConfidence: 'ABSENT',
      upstreamFallbackExpression: null,
      upstreamFallbackValue: null,
      upstreamFallbackConfidence: null
    };
    const agreement = typeAgreement(getter.readType, setter.writeType, getter.getterPresent, setter.setterPresent);
    const type = getter.readType || (agreement === 'MISMATCH' ? null : setter.writeType) || null;
    const writable = setter.setterPresent === true && !!setter.writeType && agreement !== 'MISMATCH';
    const source = getter.readType && setter.writeType
      ? 'UPSTREAM_GETTER_SETTER'
      : (getter.readType ? 'UPSTREAM_GETTER' : (setter.writeType ? 'UPSTREAM_SETTER' : 'UPSTREAM_SURFACE'));
    const sourceConfidence = type && agreement !== 'MISMATCH' ? 'HIGH' : (agreement === 'MISMATCH' ? 'CONFLICT' : 'UNRESOLVED');
    return {
      key,
      type,
      readType: getter.readType,
      writeType: setter.writeType,
      getterPresent: getter.getterPresent,
      setterPresent: setter.setterPresent,
      getterKind: getter.getterKind,
      setterKind: setter.setterKind,
      getterSource: getter.getterSource,
      setterSource: setter.setterSource,
      getterConfidence: getter.getterConfidence,
      setterConfidence: setter.setterConfidence,
      typeAgreement: agreement,
      writable,
      source,
      sourceConfidence,
      upstreamFallbackExpression: setter.upstreamFallbackExpression,
      upstreamFallbackValue: setter.upstreamFallbackValue,
      upstreamFallbackConfidence: setter.upstreamFallbackConfidence
    };
  });
}

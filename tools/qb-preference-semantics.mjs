import {isolatePreferencesAction} from './qb-source-parsers.mjs';

const KEY_LITERAL_SOURCE = String.raw`(?:(?:u)?["']([^"']+)["'](?:_qs|_s)?|QStringLiteral\(\s*["']([^"']+)["']\s*\)|QLatin1String\(\s*["']([^"']+)["']\s*\))`;
const DATA_KEY_RE = new RegExp(String.raw`data\s*\[\s*${KEY_LITERAL_SOURCE}\s*\]`, 'g');

function capturedKey(match, offset = 1) {
  for (let i = offset; i < match.length; i++) {
    if (typeof match[i] === 'string' && match[i]) return match[i];
  }
  return '';
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readExpression(body, start) {
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
    else if (ch === ';' && paren === 0 && bracket === 0 && brace === 0) return compact(body.slice(begin, index));
  }
  return null;
}

function cppType(type) {
  const value = compact(type).replace(/\bconst\b/g, '').replace(/[&*]/g, '').trim();
  if (/^bool$/.test(value)) return 'boolean';
  if (/^(?:QString|QByteArray|QLatin1String|QStringView)$/.test(value)) return 'string';
  if (/^(?:QJsonArray|QVariantList|QStringList|QList<.*>)$/.test(value)) return 'array';
  if (/^(?:QJsonObject|QVariantMap|QVariantHash|QHash<.*>|QMap<.*>)$/.test(value)) return 'object';
  if (/^(?:(?:u?int(?:8|16|32|64)?_t)|q?u?int(?:8|16|32|64)?|int|unsigned|unsigned int|long|unsigned long|long long|unsigned long long|float|double|qsizetype|size_t)$/.test(value)) return 'number';
  return null;
}

function sessionGetterTypes(source) {
  const out = new Map();
  const text = String(source || '');
  const declaration = /^\s*(?:virtual\s+)?(.+?)\s+([A-Za-z_]\w*)\s*\(\s*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:=\s*0\s*)?;\s*$/gm;
  for (const match of text.matchAll(declaration)) {
    const type = cppType(match[1]);
    if (type && !out.has(match[2])) out.set(match[2], type);
  }
  return out;
}

function localTypes(body) {
  const out = new Map();
  const re = /(?:^|[;{}]\s*)\s*(?:const\s+)?((?:QJsonObject|QJsonArray|QVariantMap|QVariantHash|QVariantList|QStringList|QString|QByteArray|QLatin1String|QStringView|bool|q?u?int(?:8|16|32|64)?|u?int(?:8|16|32|64)?_t|int|unsigned(?:\s+int)?|long(?:\s+long)?|unsigned\s+long(?:\s+long)?|float|double|qsizetype|size_t)(?:\s*<[^;={}]+>)?)\s*[&*]?\s*([A-Za-z_]\w*)\b/gm;
  for (const match of body.matchAll(re)) {
    const type = cppType(match[1]);
    if (type) out.set(match[2], type);
  }
  return out;
}

function stripOuterParens(value) {
  let result = compact(value);
  let changed = true;
  while (changed && result.startsWith('(') && result.endsWith(')')) {
    changed = false;
    let depth = 0;
    let quote = '';
    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      if (quote) {
        if (ch === quote && result[i - 1] !== '\\') quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i !== result.length - 1) return result;
      }
    }
    if (depth === 0) {
      result = compact(result.slice(1, -1));
      changed = true;
    }
  }
  return result;
}

function inferGetter(expression, locals, declaredSessionGetters = new Map()) {
  const value = stripOuterParens(expression);
  if (!value) return {type: null, kind: 'UNRESOLVED'};
  if (/^(?:true|false)$/.test(value)) return {type: 'boolean', kind: 'BOOLEAN_LITERAL'};
  if (/^(?:[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|0x[0-9a-fA-F]+)$/.test(value)) return {type: 'number', kind: 'NUMBER_LITERAL'};
  if (/^(?:u)?["'].*["'](?:_qs|_s)?$/.test(value) || /^QStringLiteral\s*\(|^QLatin1String\s*\(/.test(value)) return {type: 'string', kind: 'STRING_LITERAL'};
  if (/^!\s*[^=]/.test(value) || /&&|\|\||==|!=|<=|>=/.test(value)) return {type: 'boolean', kind: 'BOOLEAN_EXPRESSION'};
  if (/\.(?:isEmpty|isNull|isValid|isEnabled|contains|testFlag|testAnyFlags)\s*\(/.test(value)) return {type: 'boolean', kind: 'BOOLEAN_METHOD'};
  if (/\bstatic_cast\s*<\s*bool\s*>/.test(value)) return {type: 'boolean', kind: 'BOOLEAN_CAST'};
  if (/\bstatic_cast\s*<\s*(?:u?int\d*_t|q?u?int\d*|unsigned(?:\s+long(?:\s+long)?)?|signed(?:\s+long(?:\s+long)?)?|int|long(?:\s+long)?|float|double|qsizetype|size_t)\s*>/.test(value)) return {type: 'number', kind: 'NUMBER_CAST'};
  if (/\bUtils::String::fromEnum\s*\(/.test(value)) return {type: 'string', kind: 'ENUM_STRING'};
  if (/\bQString::number\s*\(|\.toString\s*\(|\.join\s*\(|\bQStringLiteral\s*\(|\bQLatin1String\s*\(|\bQString\s*[({]/.test(value)) return {type: 'string', kind: 'STRING_EXPRESSION'};
  if (/\bQJsonArray\b|\bQVariantList\b|\bQStringList\b/.test(value)) return {type: 'array', kind: 'ARRAY_EXPRESSION'};
  if (/\bQJsonObject\b|\bQVariantMap\b|\bQVariantHash\b/.test(value)) return {type: 'object', kind: 'OBJECT_EXPRESSION'};
  if (/\.(?:hour|minute|second|msec|size|count|length|toSecsSinceEpoch|toMSecsSinceEpoch)\s*\(/.test(value)) return {type: 'number', kind: 'NUMBER_METHOD'};
  const identifier = value.match(/^([A-Za-z_]\w*)$/);
  if (identifier && locals.has(identifier[1])) return {type: locals.get(identifier[1]), kind: 'LOCAL_DECLARATION'};
  const sessionCall = value.match(/^session\s*->\s*([A-Za-z_]\w*)\s*\(\s*\)$/);
  if (sessionCall && declaredSessionGetters.has(sessionCall[1])) {
    return {type: declaredSessionGetters.get(sessionCall[1]), kind: 'SESSION_DECLARATION'};
  }
  return {type: null, kind: 'UNRESOLVED'};
}

function typeAgreement(readType, writeType, getterPresent, setterPresent) {
  if (readType && writeType) return readType === writeType ? 'EXACT' : 'MISMATCH';
  if (getterPresent && !setterPresent) return 'READ_ONLY';
  if (readType && setterPresent && !writeType) return 'WRITE_UNRESOLVED';
  if (!readType && writeType) return 'READ_UNRESOLVED';
  if (!getterPresent && setterPresent) return 'WRITE_ONLY';
  return 'UNRESOLVED';
}

export function extractSemanticGetterHints(source, label = 'source', options = {}) {
  const body = isolatePreferencesAction(source, label);
  const locals = localTypes(body);
  const declaredSessionGetters = sessionGetterTypes(options.sessionHeaderSource);
  const out = new Map();
  DATA_KEY_RE.lastIndex = 0;
  for (const match of body.matchAll(DATA_KEY_RE)) {
    const key = capturedKey(match, 1);
    if (!key) continue;
    const expression = readExpression(body, match.index + match[0].length);
    const inferred = inferGetter(expression, locals, declaredSessionGetters);
    out.set(key, {
      key,
      readType: inferred.type,
      getterKind: inferred.kind,
      getterConfidence: inferred.type ? 'HIGH' : 'UNRESOLVED'
    });
  }
  return out;
}

export function enrichPreferenceDescriptorsFromGetter(source, descriptors = [], label = 'source', options = {}) {
  const semantic = extractSemanticGetterHints(source, label, options);
  return (Array.isArray(descriptors) ? descriptors : []).map((descriptor) => {
    const hint = semantic.get(String(descriptor.key));
    if (!hint || descriptor.readType || !hint.readType) return descriptor;
    const readType = hint.readType;
    const writeType = descriptor.writeType || null;
    const agreement = typeAgreement(readType, writeType, descriptor.getterPresent !== false, descriptor.setterPresent === true);
    const writable = descriptor.setterPresent === true && !!writeType && agreement !== 'MISMATCH';
    const type = readType || (agreement === 'MISMATCH' ? null : writeType) || null;
    const sourceName = readType && writeType ? 'UPSTREAM_GETTER_SETTER' : 'UPSTREAM_GETTER';
    return {
      ...descriptor,
      type,
      readType,
      getterKind: hint.getterKind,
      getterConfidence: hint.getterConfidence,
      typeAgreement: agreement,
      writable,
      source: sourceName,
      sourceConfidence: agreement === 'MISMATCH' ? 'CONFLICT' : 'HIGH',
      semanticGetterEnriched: true
    };
  });
}

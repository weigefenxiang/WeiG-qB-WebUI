function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function decodeHtml(value) {
  return decodeXml(String(value || '')).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function textOf(block, tag) {
  const match = String(block || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function baseLanguage(value) {
  return String(value || '').trim().replace('-', '_').split('_')[0].toLowerCase();
}

function translationOf(message, sourceText, sourceFallback) {
  const match = String(message || '').match(/<translation(?:\s+([^>]*))?>([\s\S]*?)<\/translation>|<translation(?:\s+([^>]*))?\s*\/>/i);
  if (!match) return sourceFallback && sourceText ? {value: sourceText, numerus: false} : null;
  const attrs = String(match[1] || match[3] || '');
  const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
  const body = String(match[2] || '');
  const unusable = /^(?:unfinished|vanished|obsolete)$/i.test(type);
  if (unusable) return sourceFallback && sourceText ? {value: sourceText, numerus: false} : null;
  const numerus = [...body.matchAll(/<numerusform(?:\s[^>]*)?>([\s\S]*?)<\/numerusform>/gi)].map((item) => decodeXml(item[1]).trim()).filter(Boolean);
  if (numerus.length) return {value: numerus, numerus: true};
  const value = decodeXml(body).trim();
  if (value) return {value, numerus: false};
  return sourceFallback && sourceText ? {value: sourceText, numerus: false} : null;
}

export function parseQtTsTranslationSource(source, options = {}) {
  const xml = String(source || '');
  const language = (xml.match(/<TS\b[^>]*\blanguage\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
  const includeContexts = Array.isArray(options.contexts) && options.contexts.length ? new Set(options.contexts.map(String)) : null;
  const includeSources = Array.isArray(options.sources) && options.sources.length ? new Set(options.sources.map(String)) : null;
  const sourceFallback = options.sourceFallback === true || (options.sourceFallback === 'english' && baseLanguage(language) === 'en');
  const messages = [];
  for (const contextMatch of xml.matchAll(/<context(?:\s[^>]*)?>([\s\S]*?)<\/context>/gi)) {
    const contextBody = contextMatch[1];
    const context = textOf(contextBody, 'name');
    if (!context || (includeContexts && !includeContexts.has(context))) continue;
    for (const messageMatch of contextBody.matchAll(/<message(?:\s[^>]*)?>([\s\S]*?)<\/message>/gi)) {
      const message = messageMatch[1];
      const sourceText = textOf(message, 'source');
      if (!sourceText || (includeSources && !includeSources.has(sourceText))) continue;
      const translation = translationOf(message, sourceText, sourceFallback);
      if (!translation) continue;
      messages.push({
        context,
        source: sourceText,
        comment: textOf(message, 'comment') || null,
        translation: translation.value,
        numerus: translation.numerus
      });
    }
  }
  return {language, messages};
}

function qbtTr(text) {
  const match = String(text || '').match(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/i);
  if (!match) return null;
  return {source: decodeHtml(match[1]), context: String(match[2] || '').trim()};
}

function labelsByControlId(markup) {
  const out = new Map();
  for (const match of String(markup || '').matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const attrs = match[1] || '';
    const id = (attrs.match(/\bfor\s*=\s*["']([^"']+)["']/i) || [])[1];
    const translated = qbtTr(match[2]);
    if (id && translated && translated.source) out.set(id, translated);
  }
  return out;
}

function directDescriptionsByControlId(markup) {
  const out = new Map();
  for (const match of String(markup || '').matchAll(/<(?:input|select|textarea)\b([^>]*)>/gi)) {
    const attrs = match[1] || '';
    const id = (attrs.match(/\bid\s*=\s*["']([^"']+)["']/i) || [])[1];
    const title = (attrs.match(/\btitle\s*=\s*["']([\s\S]*?)["']/i) || [])[1];
    const translated = qbtTr(title);
    if (id && translated && translated.source) out.set(id, translated);
  }
  return out;
}

function addRelation(relations, key, id, evidence) {
  key = String(key || '').trim();
  id = String(id || '').trim();
  if (!key || !id) return;
  const list = relations.get(key) || [];
  if (!list.some((item) => item.id === id)) list.push({id, evidence});
  relations.set(key, list);
}

function preferenceControlRelations(source) {
  const text = String(source || '');
  const relations = new Map();
  for (const match of text.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)[^;\n]*?=\s*pref\.([A-Za-z0-9_]+)/g)) addRelation(relations, match[2], match[1], 'modern-read');
  for (const match of text.matchAll(/\$\(\s*["']([^"']+)["']\s*\)\.setProperty\([^;\n]*?pref\.([A-Za-z0-9_]+)/g)) addRelation(relations, match[2], match[1], 'legacy-read');
  for (const match of text.matchAll(/settings\.set\(\s*["']([^"']+)["']\s*,[^;\n]*?\$\(\s*["']([^"']+)["']\s*\)/g)) addRelation(relations, match[1], match[2], 'legacy-write');
  for (const match of text.matchAll(/(?:^|[,{;]\s*)([A-Za-z0-9_]+)\s*:\s*document\.getElementById\(\s*["']([^"']+)["']\s*\)/gm)) addRelation(relations, match[1], match[2], 'modern-write');
  for (const match of text.matchAll(/(?:settings|preferences)\.([A-Za-z0-9_]+)\s*=\s*document\.getElementById\(\s*["']([^"']+)["']\s*\)/g)) addRelation(relations, match[1], match[2], 'modern-write');
  const keyVars = new Map();
  for (const match of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*pref\.([A-Za-z0-9_]+)/g)) keyVars.set(match[1], match[2]);
  for (const [name,key] of keyVars) {
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const idRe=new RegExp(`document\\.getElementById\\(\\s*["']([^"']+)["']\\s*\\)[^;\\n]*?\\b${escaped}\\b`,'g');
    for (const match of text.matchAll(idRe)) addRelation(relations,key,match[1],'modern-read-variable');
    const oldRe=new RegExp(`\\$\\(\\s*["']([^"']+)["']\\s*\\)[^;\\n]*?\\b${escaped}\\b`,'g');
    for (const match of text.matchAll(oldRe)) addRelation(relations,key,match[1],'legacy-read-variable');
  }
  if (/updateWebuiLocaleSelect\(\s*pref\.locale\s*\)/.test(text)) addRelation(relations,'locale','locale_select','locale-source-call');
  return relations;
}

export function extractQbPreferenceUiFacts(preferencesSource, preferenceKeys = []) {
  const markup = String(preferencesSource || '');
  const labels = labelsByControlId(markup);
  const descriptions = directDescriptionsByControlId(markup);
  const relations = preferenceControlRelations(markup);
  const wanted = new Set((Array.isArray(preferenceKeys) ? preferenceKeys : []).map(String));
  const keys = wanted.size ? [...wanted] : [...relations.keys()];
  const preferences = {};
  for (const key of keys) {
    const candidates = relations.get(key) || [];
    const selected = candidates.find((item) => labels.has(item.id));
    if (!selected) continue;
    const title = labels.get(selected.id);
    const description = descriptions.get(selected.id) || null;
    preferences[key] = {
      controlId: selected.id,
      evidence: selected.evidence,
      title,
      ...(description ? {description} : {})
    };
  }
  return preferences;
}

export function translationSourcesForPreferenceUi(preferences) {
  const out=[];
  for (const item of Object.values(preferences || {})) {
    for (const ref of [item?.title,item?.description]) {
      if (ref?.source && !out.includes(ref.source)) out.push(ref.source);
    }
  }
  return out;
}

export function extractQbSettingsTranslationFacts({qbVersion, sourceSha, locale, translationSource, contexts = ['OptionsDialog'], sources = null} = {}) {
  if (!qbVersion || !sourceSha) throw new Error('qB Settings translation facts require exact qbVersion + sourceSha identity.');
  const parsed = parseQtTsTranslationSource(translationSource, {contexts, sources, sourceFallback: 'english'});
  const resolvedLocale = String(locale || parsed.language || '').trim();
  if (!resolvedLocale) throw new Error('qB Settings translation facts require a locale.');
  if (parsed.language && locale && baseLanguage(parsed.language) !== baseLanguage(locale)) throw new Error(`qB Settings translation locale mismatch: expected ${locale}, source says ${parsed.language}`);
  return {
    qbVersion: String(qbVersion),
    sourceSha: String(sourceSha),
    locale: resolvedLocale,
    sourceLanguage: parsed.language,
    source: 'qb-upstream-webui-ts',
    contexts: [...new Set(contexts.map(String))],
    messages: parsed.messages
  };
}

export function indexQbSettingsTranslationFacts(facts) {
  const out = new Map();
  for (const item of Array.isArray(facts?.messages) ? facts.messages : []) {
    const key = `${item.context}\u0000${item.source}\u0000${item.comment || ''}`;
    if (!out.has(key)) out.set(key, item.translation);
  }
  return out;
}

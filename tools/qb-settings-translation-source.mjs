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
  const include = Array.isArray(options.contexts) && options.contexts.length ? new Set(options.contexts.map(String)) : null;
  const sourceFallback = options.sourceFallback === true || (options.sourceFallback === 'english' && baseLanguage(language) === 'en');
  const messages = [];
  for (const contextMatch of xml.matchAll(/<context(?:\s[^>]*)?>([\s\S]*?)<\/context>/gi)) {
    const contextBody = contextMatch[1];
    const context = textOf(contextBody, 'name');
    if (!context || (include && !include.has(context))) continue;
    for (const messageMatch of contextBody.matchAll(/<message(?:\s[^>]*)?>([\s\S]*?)<\/message>/gi)) {
      const message = messageMatch[1];
      const sourceText = textOf(message, 'source');
      if (!sourceText) continue;
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

export function extractQbSettingsTranslationFacts({qbVersion, sourceSha, locale, translationSource, contexts = ['OptionsDialog']} = {}) {
  if (!qbVersion || !sourceSha) throw new Error('qB Settings translation facts require exact qbVersion + sourceSha identity.');
  const parsed = parseQtTsTranslationSource(translationSource, {contexts, sourceFallback: 'english'});
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

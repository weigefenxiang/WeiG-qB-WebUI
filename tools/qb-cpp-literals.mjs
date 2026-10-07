export const QT_STRING_SUFFIX_SOURCE='(?:_(?:q)?s)?';
export function extractStringLiterals(text){const re=new RegExp(`(?:u|QLatin1String\\s*\\(|QStringLiteral\\s*\\()?\\s*"([A-Za-z0-9_]+)"${QT_STRING_SUFFIX_SOURCE}\\s*\\)?`,'g');return [...String(text||'').matchAll(re)].map(match=>match[1]);}

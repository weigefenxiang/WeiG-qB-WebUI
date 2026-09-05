const PREFERENCES_START='void AppController::preferencesAction()';
const PREFERENCES_END='void AppController::setPreferencesAction()';

export function extractPreferenceKeys(source,label='qB source'){
  const text=String(source||'');
  const start=text.indexOf(PREFERENCES_START);
  const end=text.indexOf(PREFERENCES_END,start);
  if(start<0||end<=start)throw new Error(`${label}: cannot isolate preferencesAction`);
  const body=text.slice(start,end),keys=new Set();
  const pattern=/data\s*\[\s*(?:(?:u)?["']([^"']+)["'](?:_qs|_s)?|(?:QStringLiteral|QLatin1String)\(\s*["']([^"']+)["']\s*\))\s*\]/g;
  for(const match of body.matchAll(pattern))keys.add(match[1]||match[2]);
  return [...keys].sort();
}

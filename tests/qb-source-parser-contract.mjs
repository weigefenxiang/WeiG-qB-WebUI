import assert from 'node:assert/strict';
import {extractPreferenceKeys} from '../tools/qb-source-parsers.mjs';

const source=`
void AppController::preferencesAction()
{
    QJsonObject data;
    data["legacy_plain"] = 1;
    data[u"qt5_literal"_qs] = true;
    data[u"qt6_literal"_s] = 2;
    data[QStringLiteral("qstring_literal")] = 3;
    data[QLatin1String("latin1_literal")] = 4;
}

void AppController::setPreferencesAction()
{
    data[u"must_not_leak"_s] = 5;
}
`;

assert.deepEqual(
  extractPreferenceKeys(source,'synthetic qB source'),
  ['latin1_literal','legacy_plain','qstring_literal','qt5_literal','qt6_literal'],
  'preference parser must support legacy, Qt 5 _qs and Qt 6 _s key literal generations without leaking setPreferencesAction'
);
assert.throws(
  ()=>extractPreferenceKeys('void AppController::preferencesAction(){}','broken qB source'),
  /cannot isolate preferencesAction/,
  'parser must fail closed when action boundaries cannot be isolated'
);

console.log('qB preference source parser contract passed: legacy, Qt 5 _qs and Qt 6 _s literals are extracted across source generations.');

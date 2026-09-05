import assert from 'node:assert/strict';
import {extractPreferenceDescriptors,extractPreferenceKeys,extractPreferenceSetterHints} from '../tools/qb-source-parsers.mjs';

const source=`
void AppController::preferencesAction()
{
    QJsonObject data;
    data["legacy_bool"] = true;
    data[QStringLiteral("legacy_number")] = 3;
    data[u"qt5_string"_qs] = u"value"_qs;
    data[u"qt6_object"_s] = QJsonObject{};
    data[QLatin1String("read_only_value")] = 4;
}

void AppController::setPreferencesAction()
{
    if (m.contains("legacy_bool"))
        session->setLegacy(m["legacy_bool"].toBool());
    if (m.contains(QStringLiteral("legacy_number")))
        session->setNumber(m["legacy_number"].toInt());
    if (hasKey(u"qt5_string"_qs))
        session->setString(it.value().toString());
    if (hasKey(u"qt6_object"_s)) {
        const QVariantMap map = it.value().toMap();
        session->setObject(map);
    }
    if (hasKey(u"write_only_must_not_leak"_s))
        session->setHidden(it.value().toDouble());
}
`;

assert.deepEqual(
  extractPreferenceKeys(source,'synthetic qB source'),
  ['legacy_bool','legacy_number','qt5_string','qt6_object','read_only_value'],
  'preference parser must support legacy, QStringLiteral, QLatin1String, Qt 5 _qs and Qt 6 _s key literal generations'
);

const hints=extractPreferenceSetterHints(source,'synthetic qB source');
assert.equal(hints.get('legacy_bool').type,'boolean','legacy m.contains/toBool must be recognized');
assert.equal(hints.get('legacy_number').type,'number','legacy m[key].toInt must be recognized');
assert.equal(hints.get('qt5_string').type,'string','modern hasKey/it.value().toString must be recognized');
assert.equal(hints.get('qt6_object').type,'object','structured toMap setter must be typed without making up scalar semantics');
assert.equal(hints.get('write_only_must_not_leak').type,'number','setter parser may see write-only guards internally');

const descriptors=Object.fromEntries(extractPreferenceDescriptors(source,'synthetic qB source').map(item=>[item.key,item]));
assert.equal(descriptors.legacy_bool.writable,true);
assert.equal(descriptors.legacy_bool.sourceConfidence,'HIGH');
assert.equal(descriptors.read_only_value.setterPresent,false,'getter-only Preferences must be represented as fail-closed read-only/unresolved');
assert.equal(descriptors.read_only_value.writable,false);
assert.equal(descriptors.write_only_must_not_leak,undefined,'setter-only keys must never escape the upstream app/preferences surface');
assert.throws(
  ()=>extractPreferenceKeys('void AppController::preferencesAction(){}','broken qB source'),
  /zero Preferences/,
  'parser must fail closed when an action produces no Preferences keys'
);
assert.throws(
  ()=>extractPreferenceDescriptors('void AppController::preferencesAction(){data["x"]=1;}','missing setter source'),
  /setPreferencesAction/,
  'descriptor parser must fail closed when setter provenance cannot be isolated'
);

console.log('qB preference source parser contract passed: qB4/qB5 setter generations produce high-confidence type/writable hints while unresolved and write-only fields fail closed.');

import assert from 'node:assert/strict';
import {
  extractPreferenceDescriptors,
  extractPreferenceGetterHints,
  extractPreferenceKeys,
  extractPreferenceSetterHints
} from '../tools/qb-source-parsers.mjs';

const source=`
void AppController::preferencesAction()
{
    QJsonObject data;
    data["legacy_bool"] = true;
    data[QStringLiteral("legacy_number")] = 3;
    data[u"qt5_string"_qs] = u"value"_qs;
    data[u"qt6_object"_s] = QJsonObject{};
    data[QLatin1String("read_only_value")] = static_cast<int>(4);
    data[u"enum_value"_s] = Utils::String::fromEnum(session->mode());
    data[u"mismatch_value"_s] = 7;
    data[u"unknown_getter"_s] = session->opaqueThing();
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
    if (hasKey(u"enum_value"_s))
        session->setMode(Utils::String::toEnum(it.value().toString(), Session::Mode::Safe));
    if (hasKey(u"mismatch_value"_s))
        session->setMismatch(it.value().toString());
    if (hasKey(u"unknown_getter"_s))
        session->setOpaque(it.value().toUInt());
    if (hasKey(u"write_only_must_not_leak"_s))
        session->setHidden(it.value().toDouble());
}
`;

assert.deepEqual(
  extractPreferenceKeys(source,'synthetic qB source'),
  ['enum_value','legacy_bool','legacy_number','mismatch_value','qt5_string','qt6_object','read_only_value','unknown_getter'],
  'preference parser must support legacy, QStringLiteral, QLatin1String, Qt 5 _qs and Qt 6 _s key literal generations'
);

const getters=extractPreferenceGetterHints(source,'synthetic qB source');
assert.equal(getters.get('legacy_bool').readType,'boolean');
assert.equal(getters.get('legacy_number').readType,'number');
assert.equal(getters.get('qt5_string').readType,'string');
assert.equal(getters.get('qt6_object').readType,'object');
assert.equal(getters.get('read_only_value').readType,'number');
assert.equal(getters.get('enum_value').readType,'string');
assert.equal(getters.get('enum_value').getterKind,'ENUM_STRING');
assert.equal(getters.get('unknown_getter').readType,null,'opaque getter expressions must remain unresolved instead of being guessed');

const setters=extractPreferenceSetterHints(source,'synthetic qB source');
assert.equal(setters.get('legacy_bool').writeType,'boolean','legacy m.contains/toBool must be recognized');
assert.equal(setters.get('legacy_number').writeType,'number','legacy m[key].toInt must be recognized');
assert.equal(setters.get('qt5_string').writeType,'string','modern hasKey/it.value().toString must be recognized');
assert.equal(setters.get('qt6_object').writeType,'object','structured toMap setter must be typed without making up scalar semantics');
assert.equal(setters.get('write_only_must_not_leak').writeType,'number','setter parser may see write-only guards internally');
assert.equal(setters.get('enum_value').setterKind,'ENUM_STRING');
assert.equal(setters.get('enum_value').upstreamFallbackExpression,'Session::Mode::Safe');
assert.equal(setters.get('enum_value').upstreamFallbackValue,'Safe');
assert.equal(setters.get('enum_value').upstreamFallbackConfidence,'MEDIUM','enum fallback tokens are safe fallbacks, not claimed startup defaults');

const descriptors=Object.fromEntries(extractPreferenceDescriptors(source,'synthetic qB source').map(item=>[item.key,item]));
assert.equal(descriptors.legacy_bool.readType,'boolean');
assert.equal(descriptors.legacy_bool.writeType,'boolean');
assert.equal(descriptors.legacy_bool.typeAgreement,'EXACT');
assert.equal(descriptors.legacy_bool.writable,true);
assert.equal(descriptors.legacy_bool.sourceConfidence,'HIGH');
assert.equal(descriptors.read_only_value.setterPresent,false,'getter-only Preferences must be represented as read-only');
assert.equal(descriptors.read_only_value.typeAgreement,'READ_ONLY');
assert.equal(descriptors.read_only_value.writable,false);
assert.equal(descriptors.enum_value.readType,'string');
assert.equal(descriptors.enum_value.writeType,'string');
assert.equal(descriptors.enum_value.upstreamFallbackValue,'Safe');
assert.equal(descriptors.mismatch_value.typeAgreement,'MISMATCH','getter/setter type disagreement must be explicit');
assert.equal(descriptors.mismatch_value.writable,false,'type conflicts must fail closed instead of selecting one side');
assert.equal(descriptors.mismatch_value.sourceConfidence,'CONFLICT');
assert.equal(descriptors.unknown_getter.readType,null);
assert.equal(descriptors.unknown_getter.writeType,'number');
assert.equal(descriptors.unknown_getter.typeAgreement,'READ_UNRESOLVED');
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

console.log('qB preference source parser contract passed: qB4/qB5 getter and setter truth are separated, enum fallbacks stay non-default provenance, conflicts fail closed, and write-only fields never escape app/preferences.');

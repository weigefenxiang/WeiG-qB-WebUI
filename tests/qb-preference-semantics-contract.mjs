import assert from 'node:assert/strict';
import {
  enrichPreferenceDescriptorsFromGetter,
  extractSemanticGetterHints
} from '../tools/qb-preference-semantics.mjs';

const source=`
void AppController::preferencesAction()
{
    QJsonObject nativeDirs;
    QJsonArray recentItems;
    const bool localBool = true;
    const int localNumber = 3;
    const QString localString = u"x"_s;
    data[u"negated"_s] = !session->isAutoTMMDisabledByDefault();
    data[u"comparison"_s] = (session->port() == 0);
    data[u"logical"_s] = session->isFoo() && session->isBar();
    data[u"bool_method"_s] = name.isEmpty();
    data[u"numeric_method"_s] = startTime.hour();
    data[u"object_local"_s] = nativeDirs;
    data[u"array_local"_s] = recentItems;
    data[u"bool_local"_s] = localBool;
    data[u"number_local"_s] = localNumber;
    data[u"string_local"_s] = localString;
    data[u"number_string"_s] = QString::number(session->port());
    data[u"opaque"_s] = session->opaqueThing();
    data[u"already_typed"_s] = static_cast<int>(session->mode());
}

void AppController::setPreferencesAction()
{
    if (hasKey(u"negated"_s)) session->setA(it.value().toBool());
    if (hasKey(u"comparison"_s)) session->setB(it.value().toBool());
    if (hasKey(u"logical"_s)) session->setC(it.value().toBool());
    if (hasKey(u"bool_method"_s)) session->setD(it.value().toBool());
    if (hasKey(u"numeric_method"_s)) session->setE(it.value().toInt());
    if (hasKey(u"object_local"_s)) session->setF(it.value().toMap());
    if (hasKey(u"array_local"_s)) session->setG(it.value().toList());
    if (hasKey(u"bool_local"_s)) session->setH(it.value().toBool());
    if (hasKey(u"number_local"_s)) session->setI(it.value().toInt());
    if (hasKey(u"string_local"_s)) session->setJ(it.value().toString());
    if (hasKey(u"number_string"_s)) session->setK(it.value().toString());
    if (hasKey(u"opaque"_s)) session->setL(it.value().toUInt());
    if (hasKey(u"already_typed"_s)) session->setM(it.value().toInt());
}
`;

const hints=extractSemanticGetterHints(source,'semantic getter fixture');
assert.equal(hints.get('negated').readType,'boolean');
assert.equal(hints.get('comparison').readType,'boolean');
assert.equal(hints.get('logical').readType,'boolean');
assert.equal(hints.get('bool_method').readType,'boolean');
assert.equal(hints.get('numeric_method').readType,'number');
assert.equal(hints.get('object_local').readType,'object');
assert.equal(hints.get('array_local').readType,'array');
assert.equal(hints.get('bool_local').readType,'boolean');
assert.equal(hints.get('number_local').readType,'number');
assert.equal(hints.get('string_local').readType,'string');
assert.equal(hints.get('number_string').readType,'string');
assert.equal(hints.get('opaque').readType,null,'method return types that are not syntactically provable must stay unresolved');

const structural=[
  {key:'negated',type:'boolean',readType:null,writeType:'boolean',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'numeric_method',type:'number',readType:null,writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'opaque',type:'number',readType:null,writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'already_typed',type:'number',readType:'number',writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'EXACT',getterKind:'NUMBER',getterConfidence:'HIGH'}
];
const enriched=Object.fromEntries(enrichPreferenceDescriptorsFromGetter(source,structural,'semantic getter fixture').map(item=>[item.key,item]));
assert.equal(enriched.negated.readType,'boolean');
assert.equal(enriched.negated.typeAgreement,'EXACT');
assert.equal(enriched.negated.getterKind,'BOOLEAN_EXPRESSION');
assert.equal(enriched.negated.semanticGetterEnriched,true);
assert.equal(enriched.numeric_method.readType,'number');
assert.equal(enriched.numeric_method.typeAgreement,'EXACT');
assert.equal(enriched.opaque.readType,null,'semantic enrichment must not convert unresolved getter method names into guesses');
assert.equal(enriched.opaque.typeAgreement,'READ_UNRESOLVED');
assert.equal(enriched.already_typed.semanticGetterEnriched,undefined,'structurally high-confidence getter truth must not be overwritten by enrichment');
assert.equal(enriched.already_typed.getterKind,'NUMBER');

console.log('qB semantic getter contract passed: boolean operators, typed locals, JSON containers, string/number methods are inferred only when C++ syntax proves their JSON type, while opaque getters remain fail-closed.');

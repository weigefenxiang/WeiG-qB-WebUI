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
    Net::ProxyConfiguration proxyConf = proxyManager->proxyConfiguration();
    data[u"member_bool"_s] = proxyConf.authEnabled;
    data[u"member_string"_s] = proxyConf.username;
    data[u"member_number"_s] = proxyConf.port;
    data[u"app_bool"_s] = app()->isFileLoggerEnabled();
    data[u"app_number"_s] = app()->fileLoggerMaxSize();
    data[u"scaled_app_number"_s] = app()->fileLoggerMaxSize() / 1024;
    data[u"locale"_s] = pref->getLocale();
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
    data[u"factory_string"_s] = QString::fromLatin1(rawBytes);
    data[u"max_active_downloads"_s] = session->maxActiveDownloads();
    data[u"opaque"_s] = session->opaqueThing();
    data[u"already_typed"_s] = static_cast<int>(session->mode());
}

void AppController::setPreferencesAction()
{
    if (hasKey(u"member_bool"_s)) proxyConf.authEnabled = it.value().toBool();
    if (hasKey(u"member_string"_s)) proxyConf.username = it.value().toString();
    if (hasKey(u"member_number"_s)) proxyConf.port = it.value().toUInt();
    if (hasKey(u"app_bool"_s)) app()->setFileLoggerEnabled(it.value().toBool());
    if (hasKey(u"app_number"_s)) app()->setFileLoggerMaxSize(it.value().toInt());
    if (hasKey(u"locale"_s)) pref->setLocale(it.value().toString());
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
    if (hasKey(u"max_active_downloads"_s)) session->setMaxActiveDownloads(it.value().toInt());
    if (hasKey(u"opaque"_s)) session->setL(it.value().toUInt());
    if (hasKey(u"already_typed"_s)) session->setM(it.value().toInt());
}
`;

const sessionHeader=`
class Session
{
public:
    virtual int maxActiveDownloads() const = 0;
    virtual OpaqueType opaqueThing() const = 0;
};
`;

const preferencesHeader=`
class Preferences final
{
public:
    QString getLocale() const;
    void setLocale(const QString &locale);
};
`;

const memberHeader=`
namespace Net
{
    struct ProxyConfiguration
    {
        QString username;
        ushort port = 8080;
        bool authEnabled = false;
    };
}
`;

const applicationHeader=`
class IApplication
{
public:
    virtual bool isFileLoggerEnabled() const = 0;
    virtual int fileLoggerMaxSize() const = 0;
    virtual void setFileLoggerEnabled(bool value) = 0;
    virtual void setFileLoggerMaxSize(int value) = 0;
};
`;

const hints=extractSemanticGetterHints(source,'semantic getter fixture');
assert.equal(hints.get('member_bool').readType,null,'member access must not be guessed without a version-matched declaration');
assert.equal(hints.get('app_bool').readType,null,'app() getter names must not be guessed without a version-matched application declaration');
assert.equal(hints.get('app_number').readType,null,'app() numeric getter names must remain unresolved without source declarations');
assert.equal(hints.get('locale').readType,null,'Preferences getter names alone must not be guessed without the version-matched header');
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
assert.equal(hints.get('factory_string').readType,'string','QString::from* factory expressions must preserve string JSON semantics');
assert.equal(hints.get('max_active_downloads').readType,null,'session getter names alone must not be treated as type evidence');
assert.equal(hints.get('opaque').readType,null,'method return types that are not syntactically provable must stay unresolved');

const sourceBackedHints=extractSemanticGetterHints(source,'semantic getter fixture',{sessionHeaderSource:sessionHeader,preferencesHeaderSource:preferencesHeader,applicationHeaderSource:applicationHeader,memberHeaderSources:[memberHeader]});
assert.equal(sourceBackedHints.get('member_bool').readType,'boolean','version-matched member declaration must prove bool member JSON semantics');
assert.equal(sourceBackedHints.get('member_bool').getterKind,'MEMBER_DECLARATION');
assert.equal(sourceBackedHints.get('member_string').readType,'string');
assert.equal(sourceBackedHints.get('member_number').readType,'number');
assert.equal(sourceBackedHints.get('app_bool').readType,'boolean','version-matched Application declaration must prove app()-> boolean getter semantics');
assert.equal(sourceBackedHints.get('app_bool').getterKind,'APPLICATION_DECLARATION');
assert.equal(sourceBackedHints.get('app_number').readType,'number','version-matched Application declaration must prove app()-> numeric getter semantics');
assert.equal(sourceBackedHints.get('app_number').getterKind,'APPLICATION_DECLARATION');
assert.equal(sourceBackedHints.get('scaled_app_number').readType,'number','numeric arithmetic around an exact getter must preserve numeric JSON semantics');
assert.equal(sourceBackedHints.get('scaled_app_number').getterKind,'NUMBER_ARITHMETIC');
assert.equal(sourceBackedHints.get('locale').readType,'string','version-matched Preferences declaration must prove getLocale() JSON string semantics');
assert.equal(sourceBackedHints.get('locale').getterKind,'PREFERENCES_DECLARATION');
assert.equal(sourceBackedHints.get('max_active_downloads').readType,'number','version-matched Session declaration must prove maxActiveDownloads() JSON number semantics');
assert.equal(sourceBackedHints.get('max_active_downloads').getterKind,'SESSION_DECLARATION');
assert.equal(sourceBackedHints.get('opaque').readType,null,'unknown Session declaration return types must remain fail-closed');

const structural=[
  {key:'member_bool',type:'boolean',readType:null,writeType:'boolean',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'app_bool',type:'boolean',readType:null,writeType:'boolean',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'app_number',type:'number',readType:null,writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'locale',type:'string',readType:null,writeType:'string',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'negated',type:'boolean',readType:null,writeType:'boolean',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'numeric_method',type:'number',readType:null,writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'max_active_downloads',type:'number',readType:null,writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'opaque',type:'number',readType:null,writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'READ_UNRESOLVED',getterKind:'UNKNOWN',getterConfidence:'UNRESOLVED'},
  {key:'already_typed',type:'number',readType:'number',writeType:'number',getterPresent:true,setterPresent:true,writable:true,typeAgreement:'EXACT',getterKind:'NUMBER',getterConfidence:'HIGH'}
];
const enriched=Object.fromEntries(enrichPreferenceDescriptorsFromGetter(source,structural,'semantic getter fixture',{sessionHeaderSource:sessionHeader,preferencesHeaderSource:preferencesHeader,applicationHeaderSource:applicationHeader,memberHeaderSources:[memberHeader]}).map(item=>[item.key,item]));
assert.equal(enriched.member_bool.readType,'boolean','source-backed typed member must resolve getter type');
assert.equal(enriched.member_bool.typeAgreement,'EXACT');
assert.equal(enriched.member_bool.writable,true);
assert.equal(enriched.member_bool.getterKind,'MEMBER_DECLARATION');
assert.equal(enriched.app_bool.readType,'boolean');
assert.equal(enriched.app_bool.typeAgreement,'EXACT');
assert.equal(enriched.app_bool.writable,true);
assert.equal(enriched.app_bool.getterKind,'APPLICATION_DECLARATION');
assert.equal(enriched.app_number.readType,'number');
assert.equal(enriched.app_number.typeAgreement,'EXACT');
assert.equal(enriched.app_number.getterKind,'APPLICATION_DECLARATION');
assert.equal(enriched.locale.readType,'string','source-backed Preferences getter type must resolve Locale');
assert.equal(enriched.locale.typeAgreement,'EXACT');
assert.equal(enriched.locale.writable,true,'source-backed exact Locale getter/setter agreement must keep Locale writable');
assert.equal(enriched.locale.getterKind,'PREFERENCES_DECLARATION');
assert.equal(enriched.negated.readType,'boolean');
assert.equal(enriched.negated.typeAgreement,'EXACT');
assert.equal(enriched.negated.getterKind,'BOOLEAN_EXPRESSION');
assert.equal(enriched.negated.semanticGetterEnriched,true);
assert.equal(enriched.numeric_method.readType,'number');
assert.equal(enriched.numeric_method.typeAgreement,'EXACT');
assert.equal(enriched.max_active_downloads.readType,'number','source-backed Session getter type must resolve the live queueing preference');
assert.equal(enriched.max_active_downloads.typeAgreement,'EXACT');
assert.equal(enriched.max_active_downloads.writable,true,'source-backed exact getter/setter agreement must keep max_active_downloads writable');
assert.equal(enriched.max_active_downloads.getterKind,'SESSION_DECLARATION');
assert.equal(enriched.opaque.readType,null,'semantic enrichment must not convert unresolved getter method names into guesses');
assert.equal(enriched.opaque.typeAgreement,'READ_UNRESOLVED');
assert.equal(enriched.already_typed.semanticGetterEnriched,undefined,'structurally high-confidence getter truth must not be overwritten by enrichment');
assert.equal(enriched.already_typed.getterKind,'NUMBER');

const singletonSource=`
void AppController::preferencesAction()
{
    data[u"rss_auto_downloading_enabled"_s] = RSS::AutoDownloader::instance()->isProcessingEnabled();
}
void AppController::setPreferencesAction()
{
    if (hasKey(u"rss_auto_downloading_enabled"_s)) RSS::AutoDownloader::instance()->setProcessingEnabled(it.value().toBool());
}
`;
const singletonDescriptor={key:'rss_auto_downloading_enabled',getterPresent:true,setterPresent:true,readType:null,writeType:'boolean',typeAgreement:'READ_UNRESOLVED',writable:true};
const singletonHeader=`
namespace RSS {
class AutoDownloader final
{
public:
    bool isProcessingEnabled() const;
    void setProcessingEnabled(bool enabled);
};
}
`;
const [singleton]=enrichPreferenceDescriptorsFromGetter(singletonSource,[singletonDescriptor],'rss singleton',{memberHeaderSources:[singletonHeader]});
assert.equal(singleton.readType,'boolean','exact singleton component getter declaration must type RSS auto-downloading state');
assert.equal(singleton.typeAgreement,'EXACT','singleton getter and setter types must agree exactly');
assert.equal(singleton.writable,true,'source-proven singleton getter/setter pair must remain writable');
assert.equal(singleton.getterKind,'SINGLETON_DECLARATION','singleton provenance must stay explicit instead of name-based guessing');

const enumSource=`
void AppController::preferencesAction()
{
    data[u"enum_value"_s] = session->mode();
}
void AppController::setPreferencesAction()
{
    if (hasKey(u"enum_value"_s)) session->setMode(static_cast<Mode>(it.value().toInt()));
}
`;
const enumHeader=`
enum class Mode
{
    First = 0,
    Second = 1
};
class Session
{
public:
    virtual Mode mode() const = 0;
    virtual void setMode(Mode mode) = 0;
};
`;
const enumDescriptor={key:'enum_value',getterPresent:true,setterPresent:true,readType:null,writeType:'number',typeAgreement:'READ_UNRESOLVED',writable:true};
const [enumEnriched]=enrichPreferenceDescriptorsFromGetter(enumSource,[enumDescriptor],'enum getter',{sessionHeaderSource:enumHeader});
assert.equal(enumEnriched.readType,'number','source-declared enum getter must serialize as a numeric JSON preference');
assert.equal(enumEnriched.typeAgreement,'EXACT','enum getter plus numeric setter must prove exact read/write type agreement');
assert.equal(enumEnriched.writable,true,'source-declared enum getter must not leave an otherwise writable preference read-only');
assert.equal(enumEnriched.getterKind,'SESSION_DECLARATION');

const wrappedSource=`
void AppController::preferencesAction()
{
    auto proxyManager = Net::ProxyConfigurationManager::instance();
    data[u"native_path"_s] = Utils::Fs::toNativePath(session->defaultSavePath());
    data[u"singleton_string"_s] = BitTorrent::Session::instance()->networkInterfaceAddress();
    data[u"alias_bool"_s] = proxyManager->isProxyOnlyForTorrents();
}
void AppController::setPreferencesAction()
{
    if (hasKey(u"native_path"_s)) session->setDefaultSavePath(it.value().toString());
    if (hasKey(u"singleton_string"_s)) session->setNetworkInterfaceAddress(it.value().toString());
    if (hasKey(u"alias_bool"_s)) proxyManager->setProxyOnlyForTorrents(it.value().toBool());
}
`;
const wrappedSessionHeader=`
class Session
{
public:
    virtual QString defaultSavePath() const = 0;
    virtual QString networkInterfaceAddress() const = 0;
};
`;
const wrappedProxyHeader=`
class ProxyConfigurationManager
{
public:
    bool isProxyOnlyForTorrents() const;
};
`;
const wrappedHints=extractSemanticGetterHints(wrappedSource,'wrapped getters',{sessionHeaderSource:wrappedSessionHeader,memberHeaderSources:[wrappedProxyHeader]});
assert.equal(wrappedHints.get('native_path').readType,'string','native-path conversion wrapper must prove JSON string semantics without a preference-key exception');
assert.equal(wrappedHints.get('native_path').getterKind,'NATIVE_PATH_STRING');
assert.equal(wrappedHints.get('singleton_string').readType,'string','Session::instance() getter must reuse the exact Session class declaration');
assert.equal(wrappedHints.get('singleton_string').getterKind,'SINGLETON_DECLARATION');
assert.equal(wrappedHints.get('alias_bool').readType,'boolean','a local alias of an exact singleton class must retain getter type provenance');
assert.equal(wrappedHints.get('alias_bool').getterKind,'SINGLETON_ALIAS_DECLARATION');

console.log('qB semantic getter contract passed: operators, typed locals, version-matched struct members, Session/Preferences/Application declarations prove getter types while opaque methods remain fail-closed.');

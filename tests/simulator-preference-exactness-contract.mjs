import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPreferenceDescriptors} from '../simulator/preferences/descriptors.js';
import {inferPreferenceDefault} from '../simulator/preferences/defaults.js';
import {createPreferenceService} from '../simulator/preferences/api.js';
import {createPreferenceSchema,resolvePreferenceFallback} from '../simulator/preferences/schema.js';
import {createPreferenceBindingRegistry} from '../simulator/preferences/bindings.js';
import {registerDefaultPreferenceBindings} from '../simulator/preferences/default-bindings.js';
import {normalizePreferenceType,PreferenceCoverage,PreferenceProvenance} from '../simulator/preferences/types.js';

const descriptors=buildPreferenceDescriptors({opaque:'runtime-value'},['opaque','curated','enum_safe'],{
  profileDescriptors:[
    {key:'opaque',readType:null,writeType:'number',typeAgreement:'READ_UNRESOLVED',getterPresent:true,setterPresent:true,writable:true},
    {key:'curated',readType:'number',writeType:'number',typeAgreement:'EXACT',getterPresent:true,setterPresent:true,writable:true},
    {key:'enum_safe',readType:'string',writeType:'string',typeAgreement:'EXACT',getterPresent:true,setterPresent:true,writable:true,upstreamFallbackValue:'Safe'}
  ],
  profileDefaults:{curated:7}
});
const byKey=new Map(descriptors.map(item=>[item.key,item]));
assert.equal(byKey.get('opaque').coverage,PreferenceCoverage.UNKNOWN,'unresolved source GET type must remain UNKNOWN even when runtime has a scalar value');
assert.equal(byKey.get('opaque').writable,false,'runtime scalar shape and setter truth must not authorize an unresolved GET field');
assert.equal(byKey.get('opaque').type,null,'source descriptor type must not be filled from runtime transport shape');
assert.equal(byKey.get('opaque').transportType,'string','transport shape may be recorded separately without becoming schema truth');
assert.equal(byKey.get('opaque').provenance,PreferenceProvenance.WORLD);

assert.equal(byKey.get('curated').provenance,PreferenceProvenance.PROFILE_SOURCE_DEFAULT);
assert.equal(byKey.get('curated').exactValue,true,'a profile-provided source default may be exact');
assert.equal(byKey.get('enum_safe').provenance,PreferenceProvenance.UPSTREAM_FALLBACK);
assert.equal(byKey.get('enum_safe').exactValue,false,'toEnum fallback tokens are safe parser fallback, never startup-default proof');

const curated=buildPreferenceDescriptors({},['disk_cache'],{
  profileDescriptors:[{key:'disk_cache',readType:'number',writeType:'number',typeAgreement:'EXACT',getterPresent:true,setterPresent:true,writable:true}]
})[0];
assert.equal(curated.provenance,PreferenceProvenance.CURATED_DEFAULT);
assert.equal(curated.exactValue,false,'curated simulator defaults must never be reported as exact upstream startup defaults');

assert.equal(inferPreferenceDefault('invented_enabled'),undefined,'unknown boolean-looking keys must not get fabricated false defaults');
assert.equal(inferPreferenceDefault('invented_port'),undefined,'unknown numeric-looking keys must not get fabricated zero defaults');
assert.equal(inferPreferenceDefault('invented_name'),undefined,'unknown string-looking keys must not get fabricated empty-string defaults');
assert.equal(normalizePreferenceType('not-a-source-type'),null,'unknown schema types must not silently normalize to string');
assert.deepEqual(createPreferenceSchema([{key:'unknown'}]),[{key:'unknown',section:'Unknown',type:null,writable:false}],'schema entries without proven type/writability must fail closed');
for(const value of [true,4,'x',[1],{a:1}])assert.equal(resolvePreferenceFallback(value).writable,false,'runtime value shape alone must never authorize an unknown preference write');
const fallbackService=createPreferenceService({future:3},{allowedKeys:['future']});
assert.deepEqual(fallbackService.write({future:4}),{},'descriptor-less runtime fallback must reject writes even for scalar values');
assert.equal(fallbackService.read().future,3);

const registry=createPreferenceBindingRegistry();
registerDefaultPreferenceBindings(registry);
assert.ok(registry.modeledKeys().includes('queueing_enabled'));
assert.ok(registry.modeledKeys().includes('max_ratio'));
assert.ok(!registry.modeledKeys().includes('scheduler_enabled'),'normalization is not behavior modeling');
assert.ok(!registry.modeledKeys().includes('pex'),'state persistence is not behavior modeling');
assert.equal(registry.metadata('queueing_enabled').effect,'scheduler-capacity');
assert.equal(registry.metadata('scheduler_enabled').effect,null);

const defaultsSource=fs.readFileSync(new URL('../simulator/preferences/defaults.js',import.meta.url),'utf8');
assert.doesNotMatch(defaultsSource,/BOOLEAN_PREFIX|BOOLEAN_SUFFIX|NUMBER_PATTERN|NUMBER_SPECIAL/,'key-name default guessing must stay retired');

console.log('Virtual qB preference exactness guard passed: unresolved GET schemas fail closed, provenance distinguishes exact/profile/curated/fallback/unknown values, key-name defaults stay retired, and MODELED means a real simulator side effect.');

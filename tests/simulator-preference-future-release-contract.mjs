import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {createPreferenceRuntime} from '../simulator/preferences/runtime.js';
import {PreferenceCoverage,PreferenceProvenance} from '../simulator/preferences/types.js';

const profile={
  qbVersion:'5.99.0',webApiVersion:'2.99.0',tag:'release-5.99.0',protocolGeneration:'qb5',stable:true,
  preferenceKeys:['future_enum','future_scalar','future_read_only','future_conflict','future_opaque'],
  preferenceDescriptors:[
    {
      key:'future_enum',type:'string',readType:'string',writeType:'string',typeAgreement:'EXACT',
      getterPresent:true,setterPresent:true,getterConfidence:'HIGH',setterConfidence:'HIGH',writable:true,
      upstreamFallbackExpression:'FutureMode::None',upstreamFallbackValue:'None',upstreamFallbackConfidence:'MEDIUM'
    },
    {
      key:'future_scalar',type:'number',readType:'number',writeType:'number',typeAgreement:'EXACT',
      getterPresent:true,setterPresent:true,getterConfidence:'HIGH',setterConfidence:'HIGH',writable:true
    },
    {
      key:'future_read_only',type:'boolean',readType:'boolean',writeType:null,typeAgreement:'READ_ONLY',
      getterPresent:true,setterPresent:false,getterConfidence:'HIGH',setterConfidence:'ABSENT',writable:false
    },
    {
      key:'future_conflict',type:null,readType:'number',writeType:'string',typeAgreement:'MISMATCH',
      getterPresent:true,setterPresent:true,getterConfidence:'HIGH',setterConfidence:'HIGH',writable:false
    },
    {
      key:'future_opaque',type:'number',readType:null,writeType:'number',typeAgreement:'READ_UNRESOLVED',
      getterPresent:true,setterPresent:true,getterConfidence:'UNRESOLVED',setterConfidence:'HIGH',writable:true
    }
  ],apiActions:[]
};

const world=createWorld({profile,count:1,seed:'future-preference-schema',now:1700000000000});
Object.assign(world.preferences,{
  future_read_only:true,
  future_conflict:8,
  future_opaque:'opaque-getter-value'
});
const runtime=createPreferenceRuntime(world);
const descriptors=new Map(runtime.descriptors().map(item=>[item.key,item]));
const surface=runtime.read();
const initialReport=runtime.coverage();

assert.equal(surface.future_enum,'None','a future enum with a source-backed setter fallback should get a non-fabricated provisional value');
assert.equal(descriptors.get('future_enum').provenance,PreferenceProvenance.UPSTREAM_FALLBACK);
assert.equal(descriptors.get('future_enum').exactValue,false,'setter fallback must never be promoted to an exact startup default');
assert.equal(descriptors.get('future_enum').coverage,PreferenceCoverage.STATEFUL);
assert.equal(descriptors.get('future_enum').writable,true);
assert.ok(initialReport.upstreamFallbackCount>=1,'initial coverage must record source-backed provisional enum fallback usage');

assert.equal(surface.future_scalar,0,'typed future scalar without source value must remain a typed placeholder');
assert.equal(descriptors.get('future_scalar').provenance,PreferenceProvenance.SAFE_PLACEHOLDER);
assert.equal(descriptors.get('future_scalar').coverage,PreferenceCoverage.UNKNOWN);
assert.equal(descriptors.get('future_scalar').writable,false,'typed placeholder alone is insufficient evidence to enable future writes');

assert.equal(surface.future_read_only,true);
assert.equal(descriptors.get('future_read_only').coverage,PreferenceCoverage.READ_ONLY);
assert.equal(descriptors.get('future_read_only').writable,false);

assert.equal(surface.future_conflict,8,'getter truth must preserve a valid read representation even when setter type conflicts');
assert.equal(descriptors.get('future_conflict').coverage,PreferenceCoverage.UNKNOWN);
assert.equal(descriptors.get('future_conflict').writable,false,'read/write conflicts must fail closed');

assert.equal(surface.future_opaque,'opaque-getter-value','unresolved future getter representation must survive even when writeType is known');
assert.equal(descriptors.get('future_opaque').readType,null);
assert.equal(descriptors.get('future_opaque').writeType,'number');
const accepted=runtime.write({future_enum:'None',future_scalar:5,future_read_only:false,future_conflict:'9',future_opaque:'12'},1700000001000);
assert.equal(accepted.future_enum,'None');
assert.ok(!Object.prototype.hasOwnProperty.call(accepted,'future_scalar'),'placeholder-only future scalar must remain fail-closed');
assert.ok(!Object.prototype.hasOwnProperty.call(accepted,'future_read_only'));
assert.ok(!Object.prototype.hasOwnProperty.call(accepted,'future_conflict'));
assert.equal(accepted.future_opaque,12,'known future setter type may normalize POST independently of unresolved getter type');

const postWriteDescriptors=new Map(runtime.descriptors().map(item=>[item.key,item]));
const report=runtime.coverage();
assert.equal(postWriteDescriptors.get('future_enum').provenance,PreferenceProvenance.WORLD,'after an accepted write the enum becomes current world state instead of remaining fallback provenance');
assert.equal(report.upstreamFallbackCount,0,'accepted explicit writes must retire fallback provenance from the current runtime surface');
assert.ok(report.typeConflictCount>=1);
assert.ok(report.highConfidenceReadCount>=3);
assert.ok(report.highConfidenceWriteCount>=3);
assert.ok(report.byAgreement.EXACT>=2);
assert.ok(report.byAgreement.MISMATCH>=1);

console.log('Virtual qB future preference contract passed: future getter/setter schemas remain source-driven, fallbacks stay provisional until explicitly written, conflicts and placeholders fail closed, and unresolved GET types are never rewritten from POST truth.');

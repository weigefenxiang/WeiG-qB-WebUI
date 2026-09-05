import assert from 'node:assert/strict';
import {summarizeCatalogQuality,validateCatalogQuality} from '../tools/qb-catalog-quality.mjs';
import {annotateCatalogEvolution,validateCatalogEvolution} from '../tools/qb-catalog-evolution.mjs';

function descriptor(key,{readType='number',writeType='number',writable=true,semantic=false,getterKind='NUMBER',setterKind='NUMBER'}={}){
  return{
    key,type:readType||writeType||null,readType,writeType,
    getterPresent:true,setterPresent:writeType!==null,writable,
    typeAgreement:readType&&writeType?(readType===writeType?'EXACT':'MISMATCH'):(readType?'READ_ONLY':'READ_UNRESOLVED'),
    getterKind,setterKind,
    getterConfidence:readType?'HIGH':'UNRESOLVED',setterConfidence:writeType?'HIGH':'UNRESOLVED',
    semanticGetterEnriched:semantic||undefined,
    upstreamFallbackValue:null
  };
}
function stats(items){
  return{
    total:items.length,
    getterPresent:items.filter(x=>x.getterPresent===true).length,
    setterPresent:items.filter(x=>x.setterPresent===true).length,
    readTyped:items.filter(x=>x.readType).length,
    writeTyped:items.filter(x=>x.writeType).length,
    exactAgreement:items.filter(x=>x.typeAgreement==='EXACT').length,
    mismatched:items.filter(x=>x.typeAgreement==='MISMATCH').length,
    safeFallback:items.filter(x=>x.upstreamFallbackValue!==null&&x.upstreamFallbackValue!==undefined).length,
    semanticGetterEnriched:items.filter(x=>x.semanticGetterEnriched===true).length,
    unresolvedRead:items.filter(x=>!x.readType).length,
    unresolvedWrite:items.filter(x=>!x.writeType).length,
    structuredRead:items.filter(x=>x.readType==='array'||x.readType==='object').length,
    structuredWrite:items.filter(x=>x.writeType==='array'||x.writeType==='object').length,
    typed:items.filter(x=>x.writeType).length,
    highConfidence:items.filter(x=>x.writeType).length,
    unresolved:items.filter(x=>!x.writeType).length,
    structured:items.filter(x=>x.writeType==='array'||x.writeType==='object').length
  };
}

const first=[descriptor('alpha'),descriptor('semantic_bool',{readType:'boolean',writeType:'boolean',semantic:true,getterKind:'BOOLEAN_EXPRESSION',setterKind:'BOOLEAN'})];
const second=[descriptor('alpha',{readType:'string',writeType:'string',getterKind:'STRING_EXPRESSION',setterKind:'STRING'}),...first.slice(1),descriptor('read_only',{readType:'object',writeType:null,writable:false,getterKind:'OBJECT_EXPRESSION',setterKind:null})];
const catalog=[
  {qbVersion:'4.6.7',preferenceKeys:first.map(x=>x.key),preferenceDescriptors:first,preferenceDescriptorStats:stats(first),apiActions:['app:a']},
  {qbVersion:'5.2.3',preferenceKeys:second.map(x=>x.key),preferenceDescriptors:second,preferenceDescriptorStats:stats(second),apiActions:['app:a','app:b']}
];

annotateCatalogEvolution(catalog);
assert.equal(validateCatalogEvolution(catalog),true);
assert.equal(validateCatalogQuality(catalog),true);
const summary=summarizeCatalogQuality(catalog);
assert.equal(summary.profiles,2);
assert.equal(summary.semanticGetterEnriched,2,'semantic getter quality totals must include every profile occurrence');
assert.equal(catalog[1].preferenceChanges.readTypeChanged.length,1);
assert.equal(catalog[1].preferenceChanges.writeTypeChanged.length,1);
assert.equal(catalog[1].preferenceChanges.getterKindChanged.length,1,'getter parser evolution must be machine visible');
assert.equal(catalog[1].preferenceChanges.setterKindChanged.length,1,'setter parser evolution must be machine visible');
assert.equal(catalog[1].preferenceDescriptors.find(x=>x.key==='read_only').firstReadTypedInLabCatalog,'5.2.3');
assert.equal(catalog[1].preferenceDescriptors.find(x=>x.key==='read_only').firstWriteTypedInLabCatalog,null);

{
  const broken=structuredClone(catalog);
  broken[1].preferenceDescriptorStats.readTyped=0;
  assert.throws(()=>validateCatalogQuality(broken),/stale preferenceDescriptorStats\.readTyped/,'stale generated coverage counters must fail closed');
}
{
  const broken=structuredClone(catalog);
  const item=broken[1].preferenceDescriptors.find(x=>x.key==='alpha');
  item.writeType=null;item.writable=true;
  broken[1].preferenceDescriptorStats=stats(broken[1].preferenceDescriptors);
  assert.throws(()=>validateCatalogQuality(broken),/writable preference lacks writeType/,'catalog must never publish writable preference without upstream write schema');
}
{
  const broken=structuredClone(catalog);
  const item=broken[1].preferenceDescriptors.find(x=>x.key==='alpha');
  item.readType='number';item.writeType='string';item.typeAgreement='MISMATCH';item.writable=true;
  broken[1].preferenceDescriptorStats=stats(broken[1].preferenceDescriptors);
  assert.throws(()=>validateCatalogQuality(broken),/getter\/setter conflict cannot be writable/,'type disagreement must remain fail-closed');
}

console.log('qB catalog quality contract passed: descriptor statistics are recomputed, semantic getter provenance and schema evolution are tracked, and writable/type conflicts fail closed.');

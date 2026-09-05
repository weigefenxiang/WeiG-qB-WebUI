import assert from 'node:assert/strict';
import {annotateCatalogEvolution, validateCatalogEvolution} from '../tools/qb-catalog-evolution.mjs';

const catalog=[
  {
    qbVersion:'4.1.0',preferenceKeys:['a','b'],apiActions:['app/a'],
    preferenceDescriptors:[
      {key:'a',type:'boolean',readType:'boolean',writeType:'boolean',typeAgreement:'EXACT',writable:true},
      {key:'b',type:'number',readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}
    ]
  },
  {
    qbVersion:'4.2.0',preferenceKeys:['a','b','c'],apiActions:['app/a','app/c'],
    preferenceDescriptors:[
      {key:'a',type:'boolean',readType:'boolean',writeType:'boolean',typeAgreement:'EXACT',writable:true},
      {key:'b',type:'string',readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true,upstreamFallbackValue:'None'},
      {key:'c',type:'number',readType:'number',writeType:null,typeAgreement:'READ_ONLY',writable:false}
    ]
  },
  {
    qbVersion:'5.0.0',preferenceKeys:['a','c'],apiActions:['app/c'],
    preferenceDescriptors:[
      {key:'a',type:'boolean',readType:'boolean',writeType:null,typeAgreement:'READ_ONLY',writable:false},
      {key:'c',type:'string',readType:'string',writeType:null,typeAgreement:'READ_ONLY',writable:false}
    ]
  }
];
annotateCatalogEvolution(catalog);
assert.equal(validateCatalogEvolution(catalog),true);
assert.deepEqual(catalog[0].preferenceChanges.added,['a','b']);
assert.deepEqual(catalog[1].preferenceChanges.added,['c']);
assert.deepEqual(catalog[2].preferenceChanges.removed,['b']);
assert.deepEqual(catalog[1].preferenceChanges.typeChanged,[{key:'b',from:'number',to:'string'}]);
assert.deepEqual(catalog[1].preferenceChanges.readTypeChanged,[{key:'b',from:'number',to:'string'}]);
assert.deepEqual(catalog[1].preferenceChanges.writeTypeChanged,[{key:'b',from:'number',to:'string'}]);
assert.deepEqual(catalog[2].preferenceChanges.writeTypeChanged,[{key:'a',from:'boolean',to:null}]);
assert.deepEqual(catalog[2].preferenceChanges.writableChanged,[{key:'a',from:true,to:false}]);
assert.deepEqual(catalog[2].preferenceChanges.agreementChanged,[{key:'a',from:'EXACT',to:'READ_ONLY'}]);
assert.deepEqual(catalog[1].preferenceChanges.fallbackChanged,[{key:'b',from:null,to:'None'}]);
assert.deepEqual(catalog[1].apiActionChanges.added,['app/c']);
assert.deepEqual(catalog[2].apiActionChanges.removed,['app/a']);
const c=catalog[2].preferenceDescriptors.find(item=>item.key==='c');
assert.equal(c.firstSeenInLabCatalog,'4.2.0');
assert.equal(c.schemaLastChangedInLabCatalog,'5.0.0');
assert.equal(c.readTypeLastChangedInLabCatalog,'5.0.0');
assert.equal(c.firstWritableInLabCatalog,null);
const a=catalog[2].preferenceDescriptors.find(item=>item.key==='a');
assert.equal(a.firstWritableInLabCatalog,'4.1.0');
assert.equal(a.writeTypeLastChangedInLabCatalog,'5.0.0');
assert.equal(a.schemaLastChangedInLabCatalog,'5.0.0');
console.log('qB catalog evolution contract passed: per-release read/write type, fallback, writable, agreement and API surface changes are machine-readable and version-provenanced.');

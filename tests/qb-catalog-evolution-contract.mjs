import assert from 'node:assert/strict';
import {annotateCatalogEvolution, validateCatalogEvolution} from '../tools/qb-catalog-evolution.mjs';

const catalog=[
  {
    qbVersion:'4.1.0',preferenceKeys:['a','b'],apiActions:['app/a'],
    preferenceDescriptors:[
      {key:'a',type:'boolean',writable:true},
      {key:'b',type:'number',writable:true}
    ]
  },
  {
    qbVersion:'4.2.0',preferenceKeys:['a','b','c'],apiActions:['app/a','app/c'],
    preferenceDescriptors:[
      {key:'a',type:'boolean',writable:true},
      {key:'b',type:'string',writable:true},
      {key:'c',type:'number',writable:false}
    ]
  },
  {
    qbVersion:'5.0.0',preferenceKeys:['a','c'],apiActions:['app/c'],
    preferenceDescriptors:[
      {key:'a',type:'boolean',writable:false},
      {key:'c',type:'number',writable:false}
    ]
  }
];
annotateCatalogEvolution(catalog);
assert.equal(validateCatalogEvolution(catalog),true);
assert.deepEqual(catalog[0].preferenceChanges.added,['a','b']);
assert.deepEqual(catalog[1].preferenceChanges.added,['c']);
assert.deepEqual(catalog[2].preferenceChanges.removed,['b']);
assert.deepEqual(catalog[1].preferenceChanges.typeChanged,[{key:'b',from:'number',to:'string'}]);
assert.deepEqual(catalog[2].preferenceChanges.writableChanged,[{key:'a',from:true,to:false}]);
assert.deepEqual(catalog[1].apiActionChanges.added,['app/c']);
assert.deepEqual(catalog[2].apiActionChanges.removed,['app/a']);
const c=catalog[2].preferenceDescriptors.find(item=>item.key==='c');
assert.equal(c.firstSeenInLabCatalog,'4.2.0');
assert.equal(c.schemaLastChangedInLabCatalog,'4.2.0');
const a=catalog[2].preferenceDescriptors.find(item=>item.key==='a');
assert.equal(a.schemaLastChangedInLabCatalog,'5.0.0');
console.log('qB catalog evolution contract passed: per-release preference/API additions, removals and schema changes are machine-readable and version-provenanced.');

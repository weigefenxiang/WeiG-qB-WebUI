import {fileURLToPath} from 'node:url';

const files=[
  './runtime-asset-plan-contract.mjs',
  './route-module-loading-contract.mjs',
  './runtime-asset-budget-contract.mjs',
  './qb-weig-locale-sharding-contract.mjs',
  './qb-copy-semantic-fingerprint-contract.mjs',
  './qb-qm-first-routing-contract.mjs',
  './bootstrap-inventory-contract.mjs',
  './bootstrap-topology-contract.mjs',
  './private-bootstrap-contract.mjs',
];
for(const file of files)await import(new URL(file,import.meta.url));
console.log(`Runtime asset grouped contracts passed: ${files.length} focused owners.`);

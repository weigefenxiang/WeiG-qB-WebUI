const files=[
  './runtime-asset-plan-contract.mjs',
  './private-bootstrap-contract.mjs',
];
for(const file of files)await import(new URL(file,import.meta.url));
console.log(`Runtime asset grouped contracts passed: ${files.length} focused owners.`);

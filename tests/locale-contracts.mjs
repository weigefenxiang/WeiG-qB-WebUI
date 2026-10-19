// Locale family contracts share one bounded Core CI owner.
const files=[
  './locale-handoff-contract.mjs',
  './language-coverage-report-contract.mjs',
  './translation-review-worklist-contract.mjs',
];
for(const file of files)await import(new URL(file,import.meta.url));
console.log(`Locale grouped contracts passed: ${files.length} focused owners.`);

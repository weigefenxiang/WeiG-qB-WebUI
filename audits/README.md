# Compatibility and Specialty Audits

This directory contains non-routine validation preserved by A61.

- Compatibility/Frozen/source contracts run through `npm run test:compat` or the manual Compatibility Audit workflows.
- Fine-grained Virtual qB regression/stress contracts run through `npm run test:audit:simulator`.
- These audits do not block every ordinary dev push and are not Promotion prerequisites.
- Candidate Deployment remains the release-critical real qB + Chrome behavior owner.

Files are kept here when their assertions remain useful but their old routine/milestone placement no longer matches the current risk-tiered validation architecture.

- Browser/UI/Pages specialty regressions that no longer block every Candidate/Pages run stay runnable through `test:audit:browser`, `test:audit:ui`, and `test:audit:pages`.
- Historical release compatibility checks that no longer define Promotion policy stay under `test:audit:release`; obsolete workflow-layout assertions are deleted instead of preserved as false authority.
- Source/provenance specialty contracts that are not routine Core owners stay under `test:audit:source`.

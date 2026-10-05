# Compatibility and Specialty Audits

This directory contains non-routine validation preserved by A61.

- Compatibility/Frozen/source contracts run through `npm run test:compat` or the manual Compatibility Audit workflows.
- Fine-grained Virtual qB regression/stress contracts run through `npm run test:audit:simulator`.
- These audits do not block every ordinary dev push and are not Promotion prerequisites.
- Candidate Deployment remains the release-critical real qB + Chrome behavior owner.

Files are kept here when their assertions remain useful but their old routine/milestone placement no longer matches the current risk-tiered validation architecture.

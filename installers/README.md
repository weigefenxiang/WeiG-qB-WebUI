# Installer payload publishing

The dev installers consume the checksum-verified WebUI payload published under `downloads/dev` by Virtual qB Pages.

A newer `dev` commit may safely reuse an older materialized payload only when every intervening change is outside the public Pages payload inputs. The canonical payload inputs are:

- `webui/**`
- `simulator/**`
- `installers/**`
- `VERSION`
- `tools/data/qb-stable-lkg.json`
- `tools/data/qb-locale-lkg.json`
- `tests/fixtures/qb-release-catalog.lkg.json`

Workflow, test, documentation, and other repository-only changes do not by themselves require rebuilding the materialized WebUI payload. Unknown/empty compare state remains fail-closed.

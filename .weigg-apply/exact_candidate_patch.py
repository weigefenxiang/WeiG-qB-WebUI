from pathlib import Path


def once(path, old, new):
    p = Path(path)
    data = p.read_text(encoding='utf-8')
    count = data.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    p.write_text(data.replace(old, new, 1), encoding='utf-8')


once('.github/workflows/ci.yml', '''          test -s release/WeiG-qB-WebUI/private/data/qb-releases.json
          cd release
          zip -r WeiG-qB-WebUI.zip WeiG-qB-WebUI
          sha256sum WeiG-qB-WebUI.zip > SHA256SUMS
          printf '%s\\n' "${GITHUB_SHA}" > CANDIDATE_SHA
''', '''          test -s release/WeiG-qB-WebUI/private/data/qb-releases.json
          install -m 0755 installers/install.sh release/weigg-install.sh
          cp installers/install.ps1 release/weigg-install.ps1
          cd release
          zip -r WeiG-qB-WebUI.zip WeiG-qB-WebUI
          sha256sum WeiG-qB-WebUI.zip weigg-install.sh weigg-install.ps1 > SHA256SUMS
          printf '%s\\n' "${GITHUB_SHA}" > CANDIDATE_SHA
''')

once('.github/workflows/ci.yml', '''            release/CANDIDATE_SHA
          if-no-files-found: error
''', '''            release/CANDIDATE_SHA
            release/weigg-install.sh
            release/weigg-install.ps1
          if-no-files-found: error
''')

once('.github/workflows/ci.yml', '''          bash -n tests/candidate-deployment.sh
          node --check tests/installer-lifecycle-browser.mjs
''', '''          bash -n tests/candidate-deployment.sh
          bash -n candidate-artifact/weigg-install.sh
          node --check tests/installer-lifecycle-browser.mjs
''')

once('tests/candidate-deployment.sh', '''PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"
''', '''PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"
LINUX_INSTALLER="$CANDIDATE_DIR/weigg-install.sh"
WINDOWS_INSTALLER="$CANDIDATE_DIR/weigg-install.ps1"
''')

once('tests/candidate-deployment.sh', '''command -v unzip >/dev/null || { echo 'unzip is required' >&2; exit 2; }
command -v google-chrome >/dev/null || { echo 'Google Chrome Stable is required' >&2; exit 2; }
[[ -s "$PACKAGE" && -s "$SUMS" && -s "$CANDIDATE_SHA_FILE" ]] || { echo 'Candidate artifact is incomplete.' >&2; exit 2; }
''', '''command -v unzip >/dev/null || { echo 'unzip is required' >&2; exit 2; }
command -v sha256sum >/dev/null || { echo 'sha256sum is required' >&2; exit 2; }
command -v cmp >/dev/null || { echo 'cmp is required' >&2; exit 2; }
command -v google-chrome >/dev/null || { echo 'Google Chrome Stable is required' >&2; exit 2; }
[[ -s "$PACKAGE" && -s "$SUMS" && -s "$CANDIDATE_SHA_FILE" && -s "$LINUX_INSTALLER" && -s "$WINDOWS_INSTALLER" ]] || { echo 'Candidate artifact is incomplete.' >&2; exit 2; }
''')

once('tests/candidate-deployment.sh', '''[[ "$CANDIDATE_SHA" == "$EXPECTED_SHA" ]] || { echo 'Candidate artifact SHA does not match workflow SHA.' >&2; exit 1; }

VERSION=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/VERSION 2>/dev/null | tr -d '\\r\\n')
''', '''[[ "$CANDIDATE_SHA" == "$EXPECTED_SHA" ]] || { echo 'Candidate artifact SHA does not match workflow SHA.' >&2; exit 1; }
(cd "$CANDIDATE_DIR" && sha256sum -c SHA256SUMS)
cmp -s "$LINUX_INSTALLER" "$ROOT/installers/install.sh" || { echo 'Candidate Linux installer is not byte-identical to the exact-SHA source.' >&2; exit 1; }
cmp -s "$WINDOWS_INSTALLER" "$ROOT/installers/install.ps1" || { echo 'Candidate Windows installer is not byte-identical to the exact-SHA source.' >&2; exit 1; }
bash -n "$LINUX_INSTALLER"

VERSION=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/VERSION 2>/dev/null | tr -d '\\r\\n')
''')

once('tests/candidate-deployment.sh', '''bash "$ROOT/installers/install.sh" --version "$VERSION" --configure --config-root "$CONFIG_ROOT"
''', '''bash "$LINUX_INSTALLER" --version "$VERSION" --configure --config-root "$CONFIG_ROOT"
''')

once('tests/candidate-deployment.sh', '''    installerReleasePath:true,
    officialDockerConfig:true,
''', '''    installerReleasePath:true,
    exactCandidateInstallers:true,
    officialDockerConfig:true,
''')

once('tests/candidate-deployment.sh', '''if [[ "$RUN_REHEARSAL" == 1 ]]; then
  bash -n "$ROOT/tests/promotion-release-rehearsal.sh"
  bash "$ROOT/tests/promotion-release-rehearsal.sh" "$CANDIDATE_DIR" "$EVIDENCE_PATH"
fi
''', '''if [[ "$RUN_REHEARSAL" == 1 ]]; then
  bash -n "$ROOT/tests/promotion-release-rehearsal.sh"
  bash "$ROOT/tests/promotion-release-rehearsal.sh" "$CANDIDATE_DIR" "$EVIDENCE_PATH"
  node "$ROOT/tests/release-candidate-evidence.mjs" \\
    --mode=release \\
    --evidence="$EVIDENCE_PATH" \\
    --package="$PACKAGE" \\
    --sha="$EXPECTED_SHA" \\
    --version="$VERSION" \\
    --tag="v$VERSION"
fi
''')

once('tests/promotion-release-rehearsal.sh', '''PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"
''', '''PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"
LINUX_INSTALLER="$CANDIDATE_DIR/weigg-install.sh"
WINDOWS_INSTALLER="$CANDIDATE_DIR/weigg-install.ps1"
''')

once('tests/promotion-release-rehearsal.sh', '''[[ -s "$PACKAGE" && -s "$SUMS" && -s "$CANDIDATE_SHA_FILE" && -s "$EVIDENCE_FILE" ]] || { echo 'Promotion rehearsal inputs are incomplete.' >&2; exit 2; }
''', '''[[ -s "$PACKAGE" && -s "$SUMS" && -s "$CANDIDATE_SHA_FILE" && -s "$LINUX_INSTALLER" && -s "$WINDOWS_INSTALLER" && -s "$EVIDENCE_FILE" ]] || { echo 'Promotion rehearsal inputs are incomplete.' >&2; exit 2; }
''')

once('tests/promotion-release-rehearsal.sh', '''[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ && "$EXPECTED_SHA" == "$CANDIDATE_SHA" ]] || { echo 'Promotion rehearsal exact SHA mismatch.' >&2; exit 1; }

VERSION=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/VERSION 2>/dev/null | tr -d '\\r\\n')
''', '''[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ && "$EXPECTED_SHA" == "$CANDIDATE_SHA" ]] || { echo 'Promotion rehearsal exact SHA mismatch.' >&2; exit 1; }
(cd "$CANDIDATE_DIR" && sha256sum -c SHA256SUMS)
cmp -s "$LINUX_INSTALLER" "$ROOT/installers/install.sh" || { echo 'Promotion rehearsal Linux installer does not match exact candidate source.' >&2; exit 1; }
cmp -s "$WINDOWS_INSTALLER" "$ROOT/installers/install.ps1" || { echo 'Promotion rehearsal Windows installer does not match exact candidate source.' >&2; exit 1; }

VERSION=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/VERSION 2>/dev/null | tr -d '\\r\\n')
''')

once('tests/promotion-release-rehearsal.sh', "if(!evidence.checks?.browserLogin||!evidence.checks?.canonicalSettings||!evidence.checks?.alternativeWebuiPath)throw new Error('deployment evidence browser acceptance is incomplete');\n", "if(!evidence.checks?.browserLogin||!evidence.checks?.canonicalSettings||!evidence.checks?.alternativeWebuiPath||!evidence.checks?.exactCandidateInstallers)throw new Error('deployment evidence browser/installer acceptance is incomplete');\n")

once('tests/promotion-release-rehearsal.sh', '''cp "$CANDIDATE_SHA_FILE" "$PUBLISHED/CANDIDATE_SHA"
cmp -s "$PACKAGE" "$PUBLISHED/WeiG-qB-WebUI.zip"
cmp -s "$SUMS" "$PUBLISHED/SHA256SUMS"
cmp -s "$CANDIDATE_SHA_FILE" "$PUBLISHED/CANDIDATE_SHA"
''', '''cp "$CANDIDATE_SHA_FILE" "$PUBLISHED/CANDIDATE_SHA"
cp "$LINUX_INSTALLER" "$PUBLISHED/weigg-install.sh"
cp "$WINDOWS_INSTALLER" "$PUBLISHED/weigg-install.ps1"
cmp -s "$PACKAGE" "$PUBLISHED/WeiG-qB-WebUI.zip"
cmp -s "$SUMS" "$PUBLISHED/SHA256SUMS"
cmp -s "$CANDIDATE_SHA_FILE" "$PUBLISHED/CANDIDATE_SHA"
cmp -s "$LINUX_INSTALLER" "$PUBLISHED/weigg-install.sh"
cmp -s "$WINDOWS_INSTALLER" "$PUBLISHED/weigg-install.ps1"
''')

once('tests/promotion-release-rehearsal.sh', '''    releaseArtifactByteIdentity:true,
    simulatedRollbackRestoresMain:true,
''', '''    releaseArtifactByteIdentity:true,
    releaseInstallerByteIdentity:true,
    simulatedRollbackRestoresMain:true,
''')

once('tests/release-candidate-evidence.mjs', "assert(evidence.schemaVersion===1,'candidate deployment evidence schemaVersion must be 1');", "assert(evidence.schemaVersion===2,'candidate deployment evidence schemaVersion must be 2');")

once('tests/release-candidate-evidence.mjs', '''const deploymentChecks=[
  'candidateSha','packageGitSha','packageSha256','installerReleasePath','officialDockerConfig',
  'packedCatalog','installMetadata','qbConfigWrite','realWebuiServe','exactBuildSha',
  'browserLogin','canonicalSettings','alternativeWebuiPath'
];
''', '''const deploymentChecks=[
  'candidateSha','packageGitSha','packageSha256','installerReleasePath','exactCandidateInstallers','officialDockerConfig',
  'smallReleaseIndex','exactProfileShard','sourceProvenPreferences','installMetadata','qbConfigWrite','realWebuiServe','exactBuildSha',
  'browserLogin','canonicalSettings','localeRoundTrip','alternativeWebuiPath'
];
''')

once('tests/release-candidate-evidence.mjs', '''  'simulatedPromotionExactSha','simulatedReleaseTagExactSha','releaseArtifactByteIdentity',
  'simulatedRollbackRestoresMain','remoteRefsUntouched'
''', '''  'simulatedPromotionExactSha','simulatedReleaseTagExactSha','releaseArtifactByteIdentity','releaseInstallerByteIdentity',
  'simulatedRollbackRestoresMain','remoteRefsUntouched'
''')

once('.github/workflows/promote.yml', '''          test -f candidate/CANDIDATE_SHA
          test -f evidence/candidate.json
          test "$(tr -d '\\r\\n' < candidate/CANDIDATE_SHA)" = "$CANDIDATE_SHA"
          (cd candidate && sha256sum -c SHA256SUMS)
''', '''          test -f candidate/CANDIDATE_SHA
          test -f candidate/weigg-install.sh
          test -f candidate/weigg-install.ps1
          test -f evidence/candidate.json
          test "$(tr -d '\\r\\n' < candidate/CANDIDATE_SHA)" = "$CANDIDATE_SHA"
          (cd candidate && sha256sum -c SHA256SUMS)
          cmp -s candidate/weigg-install.sh installers/install.sh
          cmp -s candidate/weigg-install.ps1 installers/install.ps1
          bash -n candidate/weigg-install.sh
''')

once('.github/workflows/release.yml', '''          test -f release/CANDIDATE_SHA
          test -f evidence/candidate.json
          test "$(tr -d '\\r\\n' < release/CANDIDATE_SHA)" = "$GITHUB_SHA"
          (cd release && sha256sum -c SHA256SUMS)
''', '''          test -f release/CANDIDATE_SHA
          test -f release/weigg-install.sh
          test -f release/weigg-install.ps1
          test -f evidence/candidate.json
          test "$(tr -d '\\r\\n' < release/CANDIDATE_SHA)" = "$GITHUB_SHA"
          (cd release && sha256sum -c SHA256SUMS)
          cmp -s release/weigg-install.sh installers/install.sh
          cmp -s release/weigg-install.ps1 installers/install.ps1
          bash -n release/weigg-install.sh
''')

once('.github/workflows/release.yml', '''            release/WeiG-qB-WebUI.zip \\
            release/SHA256SUMS \\
            --verify-tag \\
''', '''            release/WeiG-qB-WebUI.zip \\
            release/weigg-install.sh \\
            release/weigg-install.ps1 \\
            release/SHA256SUMS \\
            --verify-tag \\
''')

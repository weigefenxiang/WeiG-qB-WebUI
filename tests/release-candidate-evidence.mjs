import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const fail=message=>{throw new Error(message);};
const assert=(ok,message)=>{if(!ok)fail(message);};
const args={};
for(const raw of process.argv.slice(2)){
  const match=/^--([^=]+)=(.*)$/.exec(raw);
  if(!match)fail(`Invalid argument: ${raw}`);
  args[match[1]]=match[2];
}

const mode=args.mode;
const evidenceFile=args.evidence;
const packageFile=args.package;
const sha=String(args.sha||'').trim().toLowerCase();
const version=String(args.version||'').trim();
const expectedTag=String(args.tag||`v${version}`).trim();
const expectedMainBefore=String(args['main-before']||'').trim().toLowerCase();

assert(mode==='promotion'||mode==='release','--mode must be promotion or release');
assert(evidenceFile&&fs.existsSync(evidenceFile),'candidate deployment evidence is missing');
assert(packageFile&&fs.existsSync(packageFile),'candidate package is missing');
assert(/^[0-9a-f]{40}$/.test(sha),'exact candidate SHA is invalid');
assert(/^\d+\.\d+\.\d+$/.test(version),'candidate VERSION is invalid');
assert(expectedTag===`v${version}`,`stable tag identity mismatch: ${expectedTag} != v${version}`);
if(mode==='promotion')assert(/^[0-9a-f]{40}$/.test(expectedMainBefore),'promotion main-before SHA is invalid');

const unzip=entry=>{
  const result=spawnSync('unzip',['-p',packageFile,entry],{encoding:'utf8'});
  if(result.status!==0)fail(`Unable to read ${entry} from candidate package: ${result.stderr||result.stdout}`);
  return result.stdout.replace(/[\r\n]+$/g,'');
};
const packageSha256=crypto.createHash('sha256').update(fs.readFileSync(packageFile)).digest('hex');
const packageGitSha=unzip('WeiG-qB-WebUI/GIT_SHA').toLowerCase();
const packageVersion=unzip('WeiG-qB-WebUI/VERSION');
assert(packageGitSha===sha,'candidate package GIT_SHA does not match exact SHA');
assert(packageVersion===version,'candidate package VERSION does not match repository VERSION');

const evidence=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
assert(evidence.schemaVersion===2,'candidate deployment evidence schemaVersion must be 2');
assert(evidence.kind==='release-candidate-deployment-acceptance','candidate deployment evidence kind mismatch');
assert(String(evidence.gitSha||'').toLowerCase()===sha,'candidate deployment evidence Git SHA mismatch');
assert(evidence.candidate?.version===version,'candidate deployment evidence VERSION mismatch');
assert(String(evidence.candidate?.packageSha256||'').toLowerCase()===packageSha256,'candidate deployment evidence package SHA256 mismatch');

const deploymentChecks=[
  'candidateSha','packageGitSha','packageSha256','installerReleasePath','exactCandidateInstallers','officialDockerConfig',
  'smallReleaseIndex','exactProfileShard','sourceProvenPreferences','installMetadata','qbConfigWrite','realWebuiServe','exactBuildSha',
  'browserLogin','canonicalSettings','localeRoundTrip','alternativeWebuiPath'
];
for(const key of deploymentChecks)assert(evidence.checks?.[key]===true,`candidate deployment check is not true: ${key}`);
assert(evidence.browser?.externalRequestsBlocked===true,'candidate browser acceptance must block external requests');

const rehearsal=evidence.promotionReleaseRehearsal;
assert(rehearsal&&typeof rehearsal==='object','promotion/release rehearsal evidence is missing');
assert(rehearsal.isolated===true,'promotion/release rehearsal must be isolated');
assert(rehearsal.remoteWrites===0,'promotion/release rehearsal must have zero remote writes');
assert(String(rehearsal.candidateSha||'').toLowerCase()===sha,'rehearsal candidate SHA mismatch');
assert(rehearsal.version===version,'rehearsal VERSION mismatch');
assert(String(rehearsal.packageSha256||'').toLowerCase()===packageSha256,'rehearsal package SHA256 mismatch');
assert(String(rehearsal.devBefore||'').toLowerCase()===sha,'rehearsal dev-before SHA mismatch');
assert(String(rehearsal.simulatedMainAfterPromotion||'').toLowerCase()===sha,'simulated promotion did not land on exact candidate SHA');
assert(rehearsal.simulatedTag===expectedTag,'simulated stable tag name mismatch');
assert(String(rehearsal.simulatedTagSha||'').toLowerCase()===sha,'simulated stable tag SHA mismatch');
assert(String(rehearsal.remoteDevAfter||'').toLowerCase()===sha,'remote dev identity drifted during rehearsal');

const rehearsalMainBefore=String(rehearsal.mainBefore||'').toLowerCase();
assert(/^[0-9a-f]{40}$/.test(rehearsalMainBefore),'rehearsal main-before SHA is invalid');
assert(String(rehearsal.simulatedMainAfterRollback||'').toLowerCase()===rehearsalMainBefore,'simulated rollback did not restore rehearsal main baseline');
assert(String(rehearsal.remoteMainAfter||'').toLowerCase()===rehearsalMainBefore,'remote main identity drifted during rehearsal');
if(mode==='promotion')assert(rehearsalMainBefore===expectedMainBefore,'promotion rehearsal main baseline is stale; rerun candidate acceptance against current main');

const rehearsalChecks=[
  'currentDevExactCandidate','mainFastForwardable','stableTagInitiallyAbsent','deploymentEvidenceIdentity',
  'simulatedPromotionExactSha','simulatedReleaseTagExactSha','releaseArtifactByteIdentity','releaseInstallerByteIdentity',
  'simulatedRollbackRestoresMain','remoteRefsUntouched'
];
for(const key of rehearsalChecks)assert(rehearsal.checks?.[key]===true,`promotion/release rehearsal check is not true: ${key}`);

console.log(JSON.stringify({
  candidateEvidence:'PASS',
  mode,
  version,
  sha,
  packageSha256,
  rehearsalMainBefore,
  simulatedTag:rehearsal.simulatedTag,
  remoteWrites:rehearsal.remoteWrites
}));

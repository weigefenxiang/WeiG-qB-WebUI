import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plan=JSON.parse(fs.readFileSync(path.join(root,'webui/private/bootstrap-plan.json'),'utf8'));
const scripts=plan.phases.flatMap(phase=>phase.scripts),widths=plan.phases.map(phase=>phase.scripts.length);
assert.equal(plan.schemaVersion,1);assert.equal(scripts.length,40);assert.equal(new Set(scripts).size,40);
assert.ok(plan.styleConcurrency>=2&&plan.styleConcurrency<=8,'style concurrency must remain bounded');
assert.ok(plan.phases.length<=16,'startup dependency graph regressed into too many network barriers');
assert.ok(Math.max(...widths)>=4,'bootstrap plan no longer exposes meaningful independent concurrency');
assert.ok(Math.max(...widths)<=8,'one dependency phase became an unbounded connection burst');
assert.deepEqual(plan.phases.at(-1),{name:'application',scripts:['scripts/app.js']},'App must remain the final single-script dependency barrier');

const legacy={seedBarriers:0,manifestBarriers:0,styleConcurrency:2,styles:18,scriptBarriers:41};
legacy.rttUnits=legacy.seedBarriers+legacy.manifestBarriers+Math.ceil(legacy.styles/legacy.styleConcurrency)+legacy.scriptBarriers;
const current={seedBarriers:1,manifestBarriers:1,styleConcurrency:plan.styleConcurrency,styles:plan.styles.length,scriptBarriers:plan.phases.length};
current.rttUnits=current.seedBarriers+current.manifestBarriers+Math.ceil(current.styles/current.styleConcurrency)+current.scriptBarriers;
assert.ok(current.rttUnits<=Math.floor(legacy.rttUnits*0.5),`controlled-RTT topology regressed: ${current.rttUnits} exposed RTT units > 50% of legacy ${legacy.rttUnits}`);
const controlledRttMs=80,legacyExposureMs=legacy.rttUnits*controlledRttMs,currentExposureMs=current.rttUnits*controlledRttMs;
assert.equal(legacy.rttUnits,50);assert.equal(current.rttUnits,21,'topology budget must count the RuntimeAssets seed and bootstrap-plan manifest barriers');
console.log(JSON.stringify({kind:'A63_BOOTSTRAP_TOPOLOGY',controlledRttMs,legacy:{...legacy,exposureMs:legacyExposureMs},current:{...current,exposureMs:currentExposureMs},reductionPct:Number(((legacyExposureMs-currentExposureMs)*100/legacyExposureMs).toFixed(1)),phaseWidths:widths},null,2));

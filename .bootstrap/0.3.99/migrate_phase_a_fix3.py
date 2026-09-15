from pathlib import Path

p=Path('tests/release-compat.mjs')
s=p.read_text(encoding='utf-8')
anchor="""  resolveTorrentActionDescriptor(kind){const endpoint=this.resolveTorrentAction(kind);return endpoint?{sourceAction:`fixture:${endpoint}`,endpoint,parameters:['hashes'],required:['hashes'],optional:[]}:null;},
  isCertified(){return !!activeFixture?.realRelease;}"""
replacement="""  resolveTorrentActionDescriptor(kind){const endpoint=this.resolveTorrentAction(kind);return endpoint?{sourceAction:`fixture:${endpoint}`,endpoint,parameters:['hashes'],required:['hashes'],optional:[]}:null;},
  sourceActionDescriptor(action){
    if(action!=='torrentscontroller.h:editTrackerAction'||!activeFixture?.realRelease)return null;
    const modern=versionAtLeast(activeFixture.webApiVersion.replace('-synthetic',''),'2.13.0');
    const parameters=modern?['hash','url','newUrl']:['hash','origUrl','newUrl'];
    return{sourceAction:action,endpoint:'editTracker',parameters,required:parameters.slice(),optional:[]};
  },
  isCertified(){return !!activeFixture?.realRelease;}"""
if anchor not in s:
    raise SystemExit('release-compat descriptor fixture anchor missing')
s=s.replace(anchor,replacement,1)
# The transport contract, not client.capabilities, is now the oracle for editTracker parameters.
s=s.replace("c.capabilities.trackerEditUrl=versionAtLeast(fixture.webApiVersion.replace('-synthetic',''),'2.13.0');const editCalls=capture(c);await c.editTracker('hash','https://old.invalid/announce','https://new.invalid/announce');const form=editCalls[0].options.form;if(c.capabilities.trackerEditUrl){",
            "const trackerEditUrl=versionAtLeast(fixture.webApiVersion.replace('-synthetic',''),'2.13.0');const editCalls=capture(c);await c.editTracker('hash','https://old.invalid/announce','https://new.invalid/announce');const form=editCalls[0].options.form;if(trackerEditUrl){",1)
if 'c.capabilities.trackerEditUrl=' in s:
    raise SystemExit('release-compat still mutates QBClient capability cache for editTracker')
if 'releaseProfile' in s or 'ReleaseProfile' in s:
    raise SystemExit('release-compat still contains retired ReleaseProfile owner references')
p.write_text(s,encoding='utf-8')
print('Release-compat editTracker now uses source-proven Registry action descriptors.')

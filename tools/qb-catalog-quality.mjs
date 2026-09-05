function count(items,predicate){let total=0;for(const item of items)if(predicate(item))total++;return total;}
function keys(values){return Array.isArray(values)?values.map(String):[];}

function assert(condition,message){if(!condition)throw new Error(message);}

export function summarizeCatalogQuality(catalog=[]){
  const profiles=Array.isArray(catalog)?catalog:[];
  const totals={profiles:profiles.length,preferences:0,readTyped:0,writeTyped:0,exactAgreement:0,mismatched:0,semanticGetterEnriched:0,structuredRead:0,structuredWrite:0,writable:0};
  const versions=new Set();
  for(const profile of profiles){
    const version=String(profile?.qbVersion||'');
    assert(version,`catalog profile missing qbVersion`);
    assert(!versions.has(version),`${version}: duplicate qB profile`);
    versions.add(version);
    const surface=keys(profile.preferenceKeys),descriptors=Array.isArray(profile.preferenceDescriptors)?profile.preferenceDescriptors:[];
    const surfaceSet=new Set(surface),descriptorSet=new Set(descriptors.map(item=>String(item?.key||'')));
    assert(surfaceSet.size===surface.length,`${version}: duplicate preferenceKeys`);
    assert(descriptorSet.size===descriptors.length,`${version}: duplicate preferenceDescriptors`);
    assert(descriptors.length===surface.length,`${version}: descriptor count ${descriptors.length} does not match preference surface ${surface.length}`);
    for(const descriptor of descriptors){
      const key=String(descriptor?.key||'');
      assert(surfaceSet.has(key),`${version}/${key}: descriptor escaped app/preferences surface`);
      assert(descriptor.getterPresent===true,`${version}/${key}: preference lacks upstream getter provenance`);
      if(descriptor.writable===true){
        assert(!!descriptor.writeType,`${version}/${key}: writable preference lacks writeType`);
        assert(descriptor.setterPresent===true,`${version}/${key}: writable preference lacks upstream setter provenance`);
        assert(descriptor.typeAgreement!=='MISMATCH',`${version}/${key}: getter/setter conflict cannot be writable`);
      }
      if(descriptor.semanticGetterEnriched===true){
        assert(!!descriptor.readType,`${version}/${key}: semantic getter enrichment lacks readType`);
        assert(descriptor.getterConfidence==='HIGH',`${version}/${key}: semantic getter enrichment must be high-confidence syntax truth`);
      }
      if(descriptor.typeAgreement==='EXACT'){
        assert(!!descriptor.readType&&descriptor.readType===descriptor.writeType,`${version}/${key}: EXACT agreement must have identical read/write types`);
      }
    }
    const expected={
      total:descriptors.length,
      getterPresent:count(descriptors,item=>item.getterPresent===true),
      setterPresent:count(descriptors,item=>item.setterPresent===true),
      readTyped:count(descriptors,item=>!!item.readType),
      writeTyped:count(descriptors,item=>!!item.writeType),
      exactAgreement:count(descriptors,item=>item.typeAgreement==='EXACT'),
      mismatched:count(descriptors,item=>item.typeAgreement==='MISMATCH'),
      safeFallback:count(descriptors,item=>item.upstreamFallbackValue!==null&&item.upstreamFallbackValue!==undefined),
      semanticGetterEnriched:count(descriptors,item=>item.semanticGetterEnriched===true),
      unresolvedRead:count(descriptors,item=>!item.readType),
      unresolvedWrite:count(descriptors,item=>!item.writeType),
      structuredRead:count(descriptors,item=>item.readType==='array'||item.readType==='object'),
      structuredWrite:count(descriptors,item=>item.writeType==='array'||item.writeType==='object')
    };
    const stats=profile.preferenceDescriptorStats||{};
    for(const [field,value] of Object.entries(expected))assert(Number(stats[field]??0)===value,`${version}: stale preferenceDescriptorStats.${field}: expected ${value}, got ${stats[field]}`);
    totals.preferences+=expected.total;
    totals.readTyped+=expected.readTyped;
    totals.writeTyped+=expected.writeTyped;
    totals.exactAgreement+=expected.exactAgreement;
    totals.mismatched+=expected.mismatched;
    totals.semanticGetterEnriched+=expected.semanticGetterEnriched;
    totals.structuredRead+=expected.structuredRead;
    totals.structuredWrite+=expected.structuredWrite;
    totals.writable+=count(descriptors,item=>item.writable===true);
  }
  return totals;
}

export function validateCatalogQuality(catalog=[]){summarizeCatalogQuality(catalog);return true;}

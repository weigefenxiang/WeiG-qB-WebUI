function actionRefForPath(path){
  const parts=String(path||'').split('/').filter(Boolean);
  if(parts.length!==2)return null;
  const [controller,action]=parts;
  if(!/^[A-Za-z0-9_-]+$/.test(controller)||!/^[A-Za-z0-9_]+$/.test(action))return null;
  return `${controller.toLowerCase()}controller.h:${action}Action`;
}

export function upstreamActionRef(path){return actionRefForPath(path);}

export function upstreamRouteAvailable(profile,path){
  const actions=profile?.apiActions;
  if(!Array.isArray(actions))return true;
  const ref=actionRefForPath(path);
  if(!ref)return true;
  return actions.includes(ref);
}

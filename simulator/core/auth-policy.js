import {authenticate} from './engine.js';

export function tryAuthenticate(world,username,password,now=Date.now()){
  if(world.authenticated)return true;
  const policy=world.authenticationPolicy;
  if(policy?.acceptAny===false){
    const expectedUsername=String(policy.username??'');
    const expectedPassword=String(policy.password??'');
    if(String(username??'')!==expectedUsername||String(password??'')!==expectedPassword)return false;
  }
  authenticate(world,String(username??''),String(password??''),now);
  return true;
}

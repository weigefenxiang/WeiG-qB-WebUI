export function hash32(value){
  const text=String(value??'');
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,0x01000193);
  }
  return h>>>0;
}

export function createRng(seed){
  let a=hash32(seed)||0x6d2b79f5;
  return function(){
    a|=0;
    a=(a+0x6d2b79f5)|0;
    let t=a;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

export function range(rng,min,max){
  return min+(max-min)*rng();
}

export function int(rng,min,max){
  return Math.floor(range(rng,min,max+1));
}

export function pick(rng,items){
  return items[Math.min(items.length-1,Math.floor(rng()*items.length))];
}

export function deterministicUnit(seed,key){
  return hash32(`${seed}:${key}`)/0xffffffff;
}

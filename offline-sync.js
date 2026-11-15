// Three-way merge: unchanged local fields follow remote edits; local edits win
// only when both devices changed the same field. A known base preserves deletes.
export function mergeSync(base, local, remote) {
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(same(local,base))return remote;
  if(same(remote,base)||same(local,remote))return local;
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  if(object(local)&&object(remote)){
    const result={};
    for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){
      const value=mergeSync(base?.[key],local[key],remote[key]);
      if(value!==undefined)result[key]=value;
    }
    return result;
  }
  if(Array.isArray(local)&&Array.isArray(remote)){
    const all=[...(Array.isArray(base)?base:[]),...local,...remote];
    if(all.every(x=>object(x)&&x.id!=null)){
      const index=a=>Object.fromEntries((a||[]).map(x=>[x.id,x]));
      return Object.values(mergeSync(index(base),index(local),index(remote)));
    }
    if(all.every(x=>typeof x==='string'||typeof x==='number')){
      const b=new Set(base||[]),l=new Set(local),r=new Set(remote);
      return [...new Set([...local,...remote])].filter(x=>!b.has(x)||(l.has(x)&&r.has(x)));
    }
  }
  return local;
}

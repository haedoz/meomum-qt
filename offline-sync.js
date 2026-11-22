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

// Reading plans are one user decision, not independently mergeable object fields.
// Legacy clients have no revision: an empty default must not erase an active plan.
export function mergeReadingPlan(base,local,remote,merged) {
  const plan=value=>({readingRange:value?.readingRange??null,readingGoal:Number.isInteger(value?.readingGoal)?value.readingGoal:3});
  const same=(a,b)=>JSON.stringify(plan(a))===JSON.stringify(plan(b));
  const revision=value=>{const time=Date.parse(value?.readingPlanUpdated||'');return Number.isFinite(time)?time:0;};
  const l=revision(local),r=revision(remote);
  let selected;
  if(l||r)selected=r>l?remote:local;
  else if(local?.readingRange&&!remote?.readingRange)selected=local;
  else if(remote?.readingRange&&!local?.readingRange)selected=remote;
  else if(base&&same(local,base)&&!same(remote,base))selected=remote;
  else if(!local?.readingRange&&plan(local).readingGoal===3&&plan(remote).readingGoal!==3)selected=remote;
  else selected=local;
  const result={...merged,...structuredClone(plan(selected))};
  if(revision(selected))result.readingPlanUpdated=selected.readingPlanUpdated;
  else delete result.readingPlanUpdated;
  return result;
}

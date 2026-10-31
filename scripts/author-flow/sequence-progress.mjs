#!/usr/bin/env node
/**
 * Two levels of frontier evidence: exact origin-state verification and
 * replayed *literal* interaction sequences when recorder fingerprints drift.
 * Never equate a changed UI fingerprint with the original state.
 */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces";
const args=process.argv.slice(2);
const option=(flag,otherwise)=>{const index=args.indexOf(flag);return index===-1?otherwise:args[index+1];};
const sourceSuite=option("--source","scroll"), newSuite=option("--suite","frontier");
if(!/^[a-z][a-z0-9-]*$/.test(sourceSuite)||!/^[a-z][a-z0-9-]*$/.test(newSuite))throw Error("Invalid suite");
const stable=value=>JSON.stringify(value);
const data={
  schema_version:1,type:"author-frontier-sequence-replay",
  source_suite:sourceSuite,continuation_suite:newSuite,
  method:"identical complete executed action sequence from the same seeded project, in a newly instrumented real browser",
  limits:"Matching an action sequence does not establish equivalence of source and current DOM states or persistence. Exact source-state verification is separately reported. No unseen transition is inferred.",
  viewports:[]
};
for(const viewport of ["desktop","mobile"]){
  const load=suite=>JSON.parse(fs.readFileSync(path.join(dir,"author-audit-"+viewport+"-"+suite+".json"),"utf8"));
  const source=load(sourceSuite), actual=load(newSuite);
  if(source.provenance?.runtime_executed!==true||actual.provenance?.runtime_executed!==true)throw Error("No browser provenance");
  const oldFixture=source.fixtures[0],newFixture=actual.fixtures[0];
  if(oldFixture.project_sha256!==newFixture.project_sha256||
    oldFixture.viewport.width!==newFixture.viewport.width||
    oldFixture.viewport.height!==newFixture.viewport.height)throw Error("Fixture mismatch for "+viewport);
  const originStates=new Map(source.states.map(s=>[s.id,s]));
  const prefixes=new Map();
  const prefixRank=list=>list.map(stable).join("|");
  const set=(state,actions)=>{
    const prior=prefixes.get(state);
    if(!prior||actions.length<prior.length||
      (actions.length===prior.length&&prefixRank(actions)<prefixRank(prior)))
      prefixes.set(state,actions);
  };
  for(const replay of source.replays??[]){
    if(!replay.completed||!Array.isArray(replay.steps))continue;
    let state=replay.initial_state,actions=[];
    set(state,actions);
    for(const step of replay.steps){
      if(step.from!==state)throw Error("Noncontiguous source replay "+replay.id);
      actions=[...actions,step.action];
      state=step.to;
      set(state,actions);
    }
  }
  const replayed=new Map();
  for(const replay of actual.replays??[]){
    if(!replay.completed||!Array.isArray(replay.steps))continue;
    let state=replay.initial_state;
    for(const step of replay.steps){
      if(step.from!==state)throw Error("Noncontiguous continuation replay "+replay.id);
      state=step.to;
    }
    const k=prefixRank(replay.steps.map(step=>step.action));
    if(!replayed.has(k))replayed.set(k,replay);
  }
  const entries=new Map(),totals={unvisited:0,replayable:0,sequence_replayed:0,exact_source_state:0,origin_state_changed:0,not_replayed:0,source_prefix_unavailable:0};
  for(const entry of source.frontier){
    if(entry.reason!=="unvisited"||!entry.action)continue;
    const key=stable([entry.state,entry.action]);
    if(entries.has(key))continue;
    totals.unvisited++;
    const prefix=prefixes.get(entry.state);
    if(!prefix){
      totals.source_prefix_unavailable++;
      entries.set(key,{source_state:entry.state,action:entry.action,status:"source-prefix-not-certified"});
      continue;
    }
    totals.replayable++;
    const actions=[...prefix,entry.action];
    const replay=replayed.get(prefixRank(actions));
    const end=replay?.steps.at(-1);
    if(!end){totals.not_replayed++;}
    else{
      totals.sequence_replayed++;
      if(end.from===entry.state)totals.exact_source_state++;
      else totals.origin_state_changed++;
    }
    entries.set(key,{
      source_state:entry.state,workspace:originStates.get(entry.state)?.ui?.workspace??null,action:entry.action,
      source_action_count:actions.length,
      status:!end?"not-replayed":end.from===entry.state?"exact-state-action-replayed":"literal-sequence-replayed-with-state-drift",
      ...(end?{new_from_state:end.from,new_to_state:end.to,replay_id:replay.id}: {})
    });
  }
  data.viewports.push({viewport,source_fixture:oldFixture.id,continuation_fixture:newFixture.id,
    source_initial_state:source.provenance.initial_state_id,
    continuation_initial_state:actual.provenance.initial_state_id,
    counts:totals,entries:[...entries.values()].sort((a,b)=>a.source_state.localeCompare(b.source_state)||stable(a.action).localeCompare(stable(b.action)))});
}
const destination="audit/author-flow/sequence-progress.json";
const serialized=JSON.stringify(data,null,2)+String.fromCharCode(10);
if(process.argv.includes("--check")){
  if(!fs.existsSync(destination)||fs.readFileSync(destination,"utf8")!==serialized)throw Error("Sequence ledger stale");
  console.log("Verified literal sequence progress");
}else{
  fs.writeFileSync(destination,serialized);
  console.log("Literal frontier sequence replays:",data.viewports.map(v=>v.viewport+" "+v.counts.sequence_replayed+"/"+v.counts.unvisited).join(", "));
}

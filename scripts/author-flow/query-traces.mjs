#!/usr/bin/env node
/**
 * Pure JSON queries on recorded browser evidence. No goal ontology or inference.
 * Usage:
 *  node scripts/author-flow/query-traces.mjs --fixture desktop --find "CHARACTER"
 *  node scripts/author-flow/query-traces.mjs --fixture desktop --state state:...
 *  node scripts/author-flow/query-traces.mjs --fixture desktop --from state:... --to state:...
 */
import fs from "node:fs";
import path from "node:path";
const args=process.argv.slice(2);
const value=key=>{const index=args.indexOf(key);return index<0?null:args[index+1];};
const requested=value("--fixture")??"desktop";
const filename=requested.startsWith("author-audit-")?requested:"author-audit-"+requested;
if(!/^[a-z][a-z0-9_-]*$/.test(filename))throw Error("Invalid fixture identifier");
const file=path.join("audit/author-flow/traces",filename+".json");
if(!fs.existsSync(file))throw Error("No recorded fixture: "+file);
const trace=JSON.parse(fs.readFileSync(file,"utf8"));
if(trace.type!=="author-observed-transitions"||trace.provenance?.runtime_executed!==true)throw Error("Not an executed trace");
const states=new Map(trace.states.map(s=>[s.id,s]));
const outgoing=new Map(),incoming=new Map();
for(const edge of trace.transitions){
  if(!outgoing.has(edge.from))outgoing.set(edge.from,[]);
  outgoing.get(edge.from).push(edge);
  incoming.set(edge.to,(incoming.get(edge.to)??0)+1);
}
for(const list of outgoing.values())list.sort((a,b)=>a.id.localeCompare(b.id));
const wantedState=value("--state"),find=value("--find"),from=value("--from"),to=value("--to");
const limit=Math.min(300,Math.max(1,Number(value("--limit")??30)));
let result;
if(from||to){
  if(!from||!to)throw Error("Shortest path requires both --from and --to state IDs");
  if(!states.has(from)||!states.has(to))throw Error("Path endpoints must both be observed states");
  if(from===to)result={reachable:true,sequence_verified:true,from,to,action_count:0,observed_pointer_activations:0,path:[]};
  else if(!Array.isArray(trace.replays))result={
    reachable:null,sequence_verified:false,from,to,
    reason:"This older trace records individual edges but not their contiguous browser replay sequences. Do not compose its edges across UI-only state hashes."
  };
  else{
    let best=null;
    for(const replay of trace.replays){
      if(replay.completed!==true||!Array.isArray(replay.steps))continue;
      const positions=[replay.initial_state,...replay.steps.map(step=>step.to)];
      for(let i=0;i<positions.length;i++){
        if(positions[i]!==from)continue;
        for(let j=i+1;j<positions.length;j++){
          if(positions[j]!==to)continue;
          const steps=replay.steps.slice(i,j);
          if(!best||steps.length<best.steps.length||(steps.length===best.steps.length&&replay.id<best.replay_id)){
            best={replay_id:replay.id,steps};
          }
          break;
        }
      }
    }
    result=best ? {
      reachable:true,sequence_verified:true,from,to,replay_id:best.replay_id,
      action_count:best.steps.length,
      observed_pointer_activations:best.steps.reduce((n,step)=>n+(step.action.pointer_activations??0),0),
      path:best.steps.map(step=>({from:step.from,action:step.action,to:step.to})),
    } : {
      reachable:false,sequence_verified:true,from,to,
      reason:"No single recorded browser replay contains this contiguous state-to-state sequence. It may remain unobserved."
    };
  }
}else if(wantedState){
  const state=states.get(wantedState);
  if(!state)throw Error("No such observed state in "+filename+": "+wantedState);
  result={state,outgoing:outgoing.get(wantedState)??[],
    frontier:trace.frontier.filter(item=>item.state===wantedState)};
}else if(find){
  const needle=find.toLocaleLowerCase();
  result={matches:trace.states.flatMap(state=>state.ui.visible_controls
    .filter(c=>JSON.stringify([c.label,c.locator,c.options]).toLocaleLowerCase().includes(needle))
    .map(control=>({state:state.id,workspace:state.ui.workspace,control,
      observed_transitions:(outgoing.get(state.id)??[]).filter(edge=>edge.action.locator===control.locator).map(edge=>({id:edge.id,to:edge.to,action:edge.action}))}))).slice(0,limit)};
}else{
  result={
    fixture:trace.fixtures[0],
    observed_state_count:trace.states.length,
    observed_transition_count:trace.transitions.length,
    unexplored_frontier_count:trace.frontier.length,
    initial_state:trace.provenance?.initial_state_id??null,
    graph_roots:trace.provenance?.initial_state_id?[trace.provenance.initial_state_id]:trace.states.filter(state=>!incoming.has(state.id)).map(state=>state.id),
    contiguous_replays:trace.replays?.length??null,
    caveat:"State equality is UI-only. In-memory draft and Player run internals remain unobserved.",
  };
}
process.stdout.write(JSON.stringify({type:"author-observed-query",evidence_file:file,query:{fixture:filename,find,state:wantedState,from,to,limit},result},null,2)+"\n");

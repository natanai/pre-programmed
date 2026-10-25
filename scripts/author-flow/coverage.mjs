#!/usr/bin/env node
/* Reproducible coverage ledger from declarations and *executed* fixture traces. */
import fs from "node:fs";
import path from "node:path";
const base="audit/author-flow";
const source=JSON.parse(fs.readFileSync(path.join(base,"source-graph.json"),"utf8"));
const folder=path.join(base,"traces");
const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(f=>f.endsWith(".json")).sort():[];
const fixtures=[];const states=[];const transitions=[];const frontier=[];
const fixtureCoverage=[];let replayCount=0;
const actionEvents={};
const byWorkspace=new Map();
const workspaceName=state=>state?.ui?.workspace??(state?.ui?.overlay_open?"unidentified-author-screen":"terminal-or-unidentified");
function workspaceRecord(name){
  if(!byWorkspace.has(name))byWorkspace.set(name,{workspace:name,observed_states:0,observed_transitions_from:0,frontier_by_reason:{},fixture_ids:new Set()});
  return byWorkspace.get(name);
}
for(const file of files){
  const trace=JSON.parse(fs.readFileSync(path.join(folder,file),"utf8"));
  if(trace.type!=="author-observed-transitions"||trace.schema_version!==1||trace.provenance?.runtime_executed!==true)
    throw Error("Invalid executed trace: "+file);
  for(const k of ["fixtures","states","transitions","frontier"])
    if(!Array.isArray(trace[k]))throw Error("Missing "+k+" in "+file);
  const ids=new Set(trace.states.map(s=>s.id));
  for(const edge of trace.transitions) {
    if(edge.observed!==true||!ids.has(edge.from)||!ids.has(edge.to))
      throw Error("Unverifiable executed edge in "+file+": "+edge.id);
  }
  const stateMap=new Map(trace.states.map(s=>[s.id,s]));
  replayCount+=(trace.replays?.length??0);
  fixtureCoverage.push({file,fixture_ids:trace.fixtures.map(f=>f.id),observed_states:trace.states.length,observed_transitions:trace.transitions.length,unexplored_frontier_entries:trace.frontier.length,verified_contiguous_replays:trace.replays?.length??null,source_commit:trace.provenance?.source_commit??null,explorer:trace.provenance?.explorer??null});
  for(const state of trace.states){const w=workspaceRecord(workspaceName(state));w.observed_states++;w.fixture_ids.add(state.fixture);}
  for(const edge of trace.transitions){const w=workspaceRecord(workspaceName(stateMap.get(edge.from)));w.observed_transitions_from++;actionEvents[edge.action.event]=(actionEvents[edge.action.event]??0)+1;}
  for(const item of trace.frontier){const w=workspaceRecord(workspaceName(stateMap.get(item.state)));w.frontier_by_reason[item.reason]=(w.frontier_by_reason[item.reason]??0)+1;}
  fixtures.push(...trace.fixtures.map(f=>({file,id:f.id})));
  states.push(...trace.states.map(s=>({file,id:s.id,fixture:s.fixture})));
  transitions.push(...trace.transitions.map(e=>({file,id:e.id,fixture:e.fixture})));
  frontier.push(...trace.frontier.map(e=>({...e,file})));
}
const ledger={
  schema_version:1,type:"author-graph-coverage",
  method:"derived-from-source-graph-and-executed-trace-files",
  source_graph:{files:source.counts.source_files,declared_controls:source.counts.controls,declared_nesting:source.counts.declared_nesting,api_calls:source.counts.api_calls,branch_sites:source.counts.branch_sites,collection_sites:source.counts.collection_sites},
  executed:{status:files.length?"partial":"not-started",trace_files:files,fixture_count:fixtures.length,state_count:states.length,transition_count:transitions.length,explicit_frontier_count:frontier.length,contiguous_replay_count:replayCount,by_event:Object.fromEntries(Object.entries(actionEvents).sort(([a],[b])=>a.localeCompare(b))),by_fixture:fixtureCoverage,by_workspace:[...byWorkspace.values()].map(w=>({...w,fixture_ids:[...w.fixture_ids].sort()})).sort((a,b)=>a.workspace.localeCompare(b.workspace))},
  completeness:{global:null,reason:"The UI has unbounded input, resource cardinality, state and task depth; completeness is defined only over separately declared finite fixture domains."},
  evidence:{fixtures,states,transitions,frontier},
};
const destination=path.join(base,"coverage.json");
const result=JSON.stringify(ledger,null,2)+"\n";
if(process.argv.includes("--check")) {
  if(!fs.existsSync(destination)||fs.readFileSync(destination,"utf8")!==result) {
    console.error("Coverage ledger is stale: npm run audit:author:coverage"); process.exitCode=1;
  }else console.log("Coverage ledger matches source/trace evidence.");
}else{
  fs.writeFileSync(destination,result);
  console.log("Coverage recorded:",fixtures.length,"fixtures,",transitions.length,"observed transitions.");
}

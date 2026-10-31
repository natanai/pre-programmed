#!/usr/bin/env node
/**
 * Describe verified access costs, not enjoyment or invented author intentions.
 * Never join different replays through coincidentally equal UI fingerprints.
 */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces";
const files=fs.readdirSync(dir).filter(file=>file.endsWith(".json")).sort();
const best=new Map();
const metric=(steps, state, file, replay, fixture)=>{
  const workspace=state?.ui?.workspace;
  if(!workspace)return;
  const result={
    fixture, workspace, trace_file:file, replay_id:replay.id,
    terminal_origin: true,
    pointer_activations:steps.reduce((n,step)=>n+(step.action.pointer_activations??0),0),
    interaction_count:steps.length,
    scroll_events:steps.filter(step=>step.action.event==="scroll").length,
    select_changes:steps.filter(step=>step.action.event==="change").length,
    task_depth:state.ui.task_depth,
    form_control_visible:state.ui.visible_controls.some(c=>c.enabled&&["input","textarea","select"].includes(c.kind)),
    save_control_visible:state.ui.visible_controls.some(c=>c.enabled&&/\bSAVE\b/i.test(c.label)),
    back_control_visible:state.ui.visible_controls.some(c=>c.enabled&&c.label==="[← BACK]"),
    observed_state:state.id
  };
  const key=JSON.stringify([fixture,workspace]);
  const old=best.get(key);
  const rank=x=>[x.pointer_activations,x.interaction_count,x.scroll_events,x.trace_file,x.replay_id].join("|");
  if(!old||result.pointer_activations<old.pointer_activations ||
    (result.pointer_activations===old.pointer_activations&&result.interaction_count<old.interaction_count) ||
    (result.pointer_activations===old.pointer_activations&&result.interaction_count===old.interaction_count&&rank(result)<rank(old)))
    best.set(key,result);
};
let totalReplays=0, qualifiedReplays=0;
for(const file of files){
  const trace=JSON.parse(fs.readFileSync(path.join(dir,file),"utf8"));
  if(!Array.isArray(trace.replays))continue;
  const states=new Map(trace.states.map(s=>[s.id,s]));
  for(const replay of trace.replays){
    totalReplays++;
    if(replay.completed!==true||!Array.isArray(replay.steps))continue;
    const root=states.get(replay.initial_state);
    if(!root||root.ui.overlay_open||root.ui.workspace)continue;
    qualifiedReplays++;
    let position=replay.initial_state, steps=[];
    metric([],root,file,replay,replay.fixture);
    for(const step of replay.steps){
      if(step.from!==position)throw Error("Noncontiguous evidence "+file+" "+replay.id);
      position=step.to;
      steps=[...steps,step];
      metric(steps,states.get(position),file,replay,replay.fixture);
    }
  }
}
const data={
  schema_version:1,type:"author-observed-access-costs",
  method:"minimum complete witnessed prefix per fixture and workspace",
  interpretation:"Counts from an observed terminal state with Author already enabled to a visibly active workspace. A visible form control is not proof a definition was edited or saved. No claim of UI completeness, enjoyment, or hypothetical shortest path.",
  measured_replays:qualifiedReplays,total_replays_with_provenance:totalReplays,
  workspace_entries:[...best.values()].sort((a,b)=>a.fixture.localeCompare(b.fixture)||a.workspace.localeCompare(b.workspace))
};
const destination="audit/author-flow/access-costs.json";
const text=JSON.stringify(data,null,2)+"\n";
if(process.argv.includes("--check")){
 if(!fs.existsSync(destination)||fs.readFileSync(destination,"utf8")!==text)throw Error("Access costs stale: node scripts/author-flow/measure.mjs");
 console.log("Verified observed access-cost ledger");
}else{
 fs.writeFileSync(destination,text);
 console.log("Measured access costs from",qualifiedReplays,"contiguous terminal-origin browser replays, across",best.size,"fixture/workspace pairs");
}

#!/usr/bin/env node
/* Validate evidence relationships, never infer unobserved UI flow. */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces";
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort():[];
let edges=0,controls=0,replays=0;
for (const filename of files) {
  const trace=JSON.parse(fs.readFileSync(path.join(dir,filename),"utf8"));
  if(trace.type!=="author-observed-transitions"||trace.provenance?.runtime_executed!==true)throw Error(filename+": unsupported trace provenance");
  const fixtures=new Map(trace.fixtures.map(f=>[f.id,f]));
  const states=new Map();
  for(const state of trace.states){
    if(!fixtures.has(state.fixture)||states.has(state.id))throw Error(filename+": invalid or duplicate state "+state.id);
    if(!Array.isArray(state.ui?.visible_controls))throw Error(filename+": state lacks observed controls");
    for(const control of state.ui.visible_controls){
      if(typeof control.locator!=="string"||typeof control.kind!=="string"||typeof control.enabled!=="boolean")throw Error(filename+": invalid control");
      controls++;
    }
    states.set(state.id,state);
  }
  const edgeKeys=new Set();
  for(const transition of trace.transitions){
    if(transition.observed!==true||!fixtures.has(transition.fixture))throw Error(filename+": unobserved edge");
    const before=states.get(transition.from),after=states.get(transition.to);
    if(!before||!after||before.fixture!==transition.fixture||after.fixture!==transition.fixture)throw Error(filename+": edge lacks matching fixture states: "+transition.id);
    const action=transition.action;
    if(action.event==="scroll"){
      const matches=(before.ui.scrollable_regions??[]).filter(r=>r.locator===action.locator);
      if(matches.length!==1||!Number.isInteger(action.value)||action.value===0)throw Error(filename+": invalid scroll region or delta "+transition.id);
      const region=matches[0];
      if(action.value>0&&region.top>=region.max_top)throw Error(filename+": scroll past recorded end "+transition.id);
      if(action.value<0&&region.top<=0)throw Error(filename+": scroll past recorded start "+transition.id);
    }else{
      const controlsBefore=before.ui.visible_controls.filter(c=>c.locator===action.locator);
      if(controlsBefore.length!==1||!controlsBefore[0].enabled)throw Error(filename+": unavailable/missing control for "+transition.id);
      const control=controlsBefore[0];
      if(action.event==="change"&&(control.kind!=="select"||!control.options.some(o=>o.value===action.value&&o.enabled)))throw Error(filename+": invalid selection "+transition.id);
      if(action.event==="toggle"&&(control.kind!=="input"||typeof control.value!=="boolean"))throw Error(filename+": invalid toggle "+transition.id);
      if(action.event==="fill"){
        if(!["input","textarea"].includes(control.kind)||typeof action.value!=="string")throw Error(filename+": invalid finite text sample "+transition.id);
        const readback=after.ui.visible_controls.find(c=>c.locator===action.locator);
        if(!readback||readback.value!==action.value)throw Error(filename+": entered text was not observed in the target field "+transition.id);
      }
      if(action.event==="click"&&!["button","summary"].includes(control.kind))throw Error(filename+": invalid pointer click "+transition.id);
      if(!["click","change","toggle","fill"].includes(action.event))throw Error(filename+": unsupported UI input event "+transition.id);
    }
    if(action.pointer_activations!==(["change","scroll","fill"].includes(action.event)?0:1))throw Error(filename+": pointer metric must match observed event mechanism");
    if(transition.persistence){
      const p=transition.persistence;
      if(action.event!=="click"||p.source!=="local-d1-readback"||p.field!=="openings[0].narrationText"||p.restart_verified!==true
        ||p.revision_after<=p.revision_before||p.expected_value!==p.readback_value
        ||p.restart_snapshot_sha256!==p.snapshot_sha256_after
        ||!/^([a-f0-9]{64})$/.test(p.snapshot_sha256_before)
        ||!/^([a-f0-9]{64})$/.test(p.snapshot_sha256_after))
        throw Error(filename+": unverified canonical Save readback "+transition.id);
    }
    if(transition.draft_observation){
      const d=transition.draft_observation;
      const rendered=after.ui.visible_controls.filter(c=>c.kind==="textarea"&&c.label==="NARRATION"&&c.value===d.observed_value);
      if(d.kind!=="resumed-parent"||d.expected_value!==d.observed_value||rendered.length!==1||after.ui.workspace!=="narrative.node")
        throw Error(filename+": unverified resumed parent draft observation "+transition.id);
    }
    if(transition.task_depth_observation){
      const d=transition.task_depth_observation;
      const backShown=after.ui.visible_controls.some(c=>c.kind==="button"&&c.label==="[← BACK]"&&c.enabled);
      if(before.ui.task_depth!==d.before||after.ui.task_depth!==d.after||backShown!==d.back_visible)
        throw Error(filename+": recorded task depth or Back visibility does not match observed before/after UI states");
    }
    if(transition.project_observation){
      const p=transition.project_observation;
      if(p.source!=="local-d1-readback"||p.field!=="openings[0].narrationText"||p.restart_verified!==true
        ||p.expected_value!==p.readback_value||p.snapshot_sha256_after!==p.restart_snapshot_sha256
        ||!/^([a-f0-9]{64})$/.test(p.snapshot_sha256_before)||!/^([a-f0-9]{64})$/.test(p.snapshot_sha256_after))
        throw Error(filename+": invalid local project observation "+transition.id);
      if(p.changed?!(p.revision_after>p.revision_before&&p.snapshot_sha256_before!==p.snapshot_sha256_after)
        :!(p.revision_after===p.revision_before&&p.snapshot_sha256_before===p.snapshot_sha256_after))
        throw Error(filename+": dirty navigation project mutation mismatch "+transition.id);
      if(after.ui.overlay_open)throw Error(filename+": Author mode remained open after final navigation "+transition.id);
    }
    edgeKeys.add(JSON.stringify([transition.from,transition.to,transition.action]));
    edges++;
  }
  if(trace.provenance.initial_state_id && !states.has(trace.provenance.initial_state_id))throw Error(filename+": initial state not observed");
  if(Array.isArray(trace.replays))for(const replay of trace.replays){
    if(replay.completed!==true||!fixtures.has(replay.fixture)||!states.has(replay.initial_state))throw Error(filename+": invalid replay header "+replay.id);
    let current=replay.initial_state;
    for(const step of replay.steps){
      if(step.from!==current||!states.has(step.to))throw Error(filename+": noncontiguous browser replay "+replay.id);
      if(!edgeKeys.has(JSON.stringify([step.from,step.to,step.action])))throw Error(filename+": replay step lacks observed edge "+replay.id);
      current=step.to;
    }
    replays++;
  }
  if(trace.fixtures.some(f=>f.input_domain)){
    if(trace.fixtures.length!==1||!Array.isArray(trace.replays)||trace.replays.length!==1)
      throw Error(filename+": finite write trace must be one independently replayed fixture");
    const domain=trace.fixtures[0].input_domain;
    const fills=trace.transitions.filter(t=>t.action.event==="fill");
    const saves=trace.transitions.filter(t=>Boolean(t.persistence));
    if(fills.length!==1||saves.length!==1||fills[0].action.value!==domain.value||saves[0].persistence.expected_value!==domain.value
      ||saves[0].persistence.snapshot_sha256_before===saves[0].persistence.snapshot_sha256_after)
      throw Error(filename+": finite text sample or persistence readback does not match fixture domain");
  }
  if(trace.fixtures.some(f=>f.navigation_case)){
    if(trace.fixtures.length!==1||!Array.isArray(trace.replays)||trace.replays.length!==1)
      throw Error(filename+": dirty navigation fixture must contain exactly one actual browser replay");
    const fixture=trace.fixtures[0],cases=["close-keep-discard","close-save-all","nested-parent-return","dirty-child-back"];
    if(!cases.includes(fixture.navigation_case))throw Error(filename+": unknown dirty-navigation case");
    const observations=trace.transitions.filter(t=>t.project_observation);
    if(observations.length!==1||observations[0].project_observation.case_id!==fixture.navigation_case)
      throw Error(filename+": missing post-restart project evidence for "+fixture.navigation_case);
    if(observations[0].project_observation.changed!==(fixture.navigation_case==="close-save-all"))
      throw Error(filename+": project changed in wrong navigation case");
    if(!trace.transitions.some(t=>t.action.event==="fill") || !trace.transitions.some(t=>t.action.event==="click"))
      throw Error(filename+": no executed draft action or navigation");
    if(fixture.navigation_case==="dirty-child-back"){
      const taskDepths=trace.transitions.filter(t=>t.task_depth_observation);
      if(taskDepths.length!==1)throw Error(filename+": expected a recorded Structure-to-Node task transition");
      const blocked=!taskDepths[0].task_depth_observation.back_visible;
      if(blocked&&!trace.frontier.some(item=>item.locator==="author-workspace-back"&&item.reason==="unknown"))
        throw Error(filename+": no frontier entry for unobserved nested Back");
      if(blocked&&trace.transitions.some(t=>t.action.event==="click"&&states.get(t.from)?.ui.visible_controls.some(c=>c.locator===t.action.locator&&c.label==="[← BACK]")))
        throw Error(filename+": an unobserved Back action was fabricated after task stack reset");
    }
    if(fixture.navigation_case==="nested-parent-return"&&!trace.transitions.some(t=>t.draft_observation))
      throw Error(filename+": no verified suspended parent draft restoration");
  }
  for(const item of trace.frontier){
    if(!states.has(item.state))throw Error(filename+": unanchored frontier "+JSON.stringify(item));
    if(typeof item.locator!=="string")throw Error(filename+": frontier locator missing");
    if(item.action && item.action.locator!==item.locator)throw Error(filename+": frontier action and locator disagree");
  }
  if(!trace.transitions.length)throw Error(filename+": does not contain any executed transitions");
}
console.log("Validated "+files.length+" executed fixture files, "+edges+" observed edges and "+controls+" observed control instances and "+replays+" contiguous browser replays.");

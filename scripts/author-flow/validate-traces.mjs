#!/usr/bin/env node
/* Validate evidence relationships, never infer unobserved UI flow. */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces";
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort():[];
let edges=0,controls=0;
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
  for(const transition of trace.transitions){
    if(transition.observed!==true||!fixtures.has(transition.fixture))throw Error(filename+": unobserved edge");
    const before=states.get(transition.from),after=states.get(transition.to);
    if(!before||!after||before.fixture!==transition.fixture||after.fixture!==transition.fixture)throw Error(filename+": edge lacks matching fixture states: "+transition.id);
    const action=transition.action;
    const controlsBefore=before.ui.visible_controls.filter(c=>c.locator===action.locator);
    if(controlsBefore.length!==1||!controlsBefore[0].enabled)throw Error(filename+": unavailable/missing control for "+transition.id);
    const control=controlsBefore[0];
    if(action.event==="change"&&(control.kind!=="select"||!control.options.some(o=>o.value===action.value&&o.enabled)))throw Error(filename+": invalid selection "+transition.id);
    if(action.event==="toggle"&&(control.kind!=="input"||typeof control.value!=="boolean"))throw Error(filename+": invalid toggle "+transition.id);
    if(action.event==="click"&&!["button","summary"].includes(control.kind))throw Error(filename+": invalid pointer click "+transition.id);
    if(action.pointer_activations!==1)throw Error(filename+": pointer metric must match actual single pointer action");
    edges++;
  }
  for(const item of trace.frontier){
    if(!states.has(item.state))throw Error(filename+": unanchored frontier "+JSON.stringify(item));
    if(typeof item.locator!=="string")throw Error(filename+": frontier locator missing");
  }
  if(!trace.transitions.length)throw Error(filename+": does not contain any executed transitions");
}
console.log("Validated "+files.length+" executed fixture files, "+edges+" observed edges and "+controls+" observed control instances.");

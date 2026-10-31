#!/usr/bin/env node
/**
 * Purely descriptive finite-choice exposure from observed DOM states.
 * Does not infer attention, hesitation, probabilities or user goals.
 */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces";
const paths=fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort();
const groups=new Map();
const summary=(nums)=>{
 const sorted=[...nums].sort((a,b)=>a-b);
 return {min:sorted[0],median:sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,
   p90:sorted[Math.ceil(sorted.length*.9)-1],max:sorted.at(-1)};
};
for(const file of paths){
 const trace=JSON.parse(fs.readFileSync(path.join(dir,file),"utf8"));
 if(trace.provenance?.runtime_executed!==true)throw Error("Non-executed trace "+file);
 for(const state of trace.states){
  const group=state.ui.workspace??"terminal-or-unidentified";
  const id=JSON.stringify([file,group]);
  const controls=state.ui.visible_controls;
  const direct=controls.filter(c=>c.enabled&&["button","summary"].includes(c.kind)).length;
  const alternatives=controls.filter(c=>c.enabled&&c.kind==="select").reduce((n,c)=>
   n+c.options.filter(o=>o.enabled&&o.value!==c.value).length,0);
  const toggles=controls.filter(c=>c.enabled&&c.kind==="input"&&typeof c.value==="boolean").length;
  const unbounded=controls.filter(c=>c.enabled&&["input","textarea"].includes(c.kind)&&typeof c.value==="string").length;
  const observation={state_id:state.id,direct_pointer_controls:direct,dropdown_alternatives:alternatives,
   boolean_toggles:toggles,unbounded_text_fields:unbounded,
   total_finite_action_alternatives:direct+alternatives+toggles,
   visible_controls:controls.length,scroll_regions:(state.ui.scrollable_regions??[]).length};
  if(!groups.has(id))groups.set(id,{trace_file:file,workspace:group,fixture:state.fixture,observations:[]});
  groups.get(id).observations.push(observation);
 }
}
const table=[...groups.values()].map(g=>{
 const sets={};
 for(const key of ["direct_pointer_controls","dropdown_alternatives","boolean_toggles","unbounded_text_fields","total_finite_action_alternatives","visible_controls","scroll_regions"])
  sets[key]=summary(g.observations.map(o=>o[key]));
 const highest=[...g.observations].sort((a,b)=>b.total_finite_action_alternatives-a.total_finite_action_alternatives||a.state_id.localeCompare(b.state_id))[0];
 return {trace_file:g.trace_file,workspace:g.workspace,fixture:g.fixture,observed_states:g.observations.length,
    distributions:sets,highest_finite_exposure:highest};
}).sort((a,b)=>a.trace_file.localeCompare(b.trace_file)||a.workspace.localeCompare(b.workspace));
const result={
 schema_version:1,type:"author-observed-choice-exposure",
 method:"per-unique-observed-UI-state inventory of enabled control alternatives",
 interpretation:"Direct controls and alternative select values are recorded separately. Alternatives may be inside closed dropdowns; their sum is not a count of simultaneously visible choices. No cognitive-load, enjoyment or information-theoretic probability estimate is asserted.",
 groups:table
};
const file="audit/author-flow/choice-exposure.json",content=JSON.stringify(result,null,2)+String.fromCharCode(10);
if(process.argv.includes("--check")){
 if(!fs.existsSync(file)||fs.readFileSync(file,"utf8")!==content)throw Error("Choice exposure ledger stale");
 console.log("Verified observed choice exposure");
}else{
 fs.writeFileSync(file,content);
 console.log("Recorded choice exposure for",table.length,"trace/workspace groups");
}

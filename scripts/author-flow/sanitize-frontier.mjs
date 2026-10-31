#!/usr/bin/env node
/**
 * Normalize only unanchored frontier bookkeeping from an already executed
 * browser trace. Never invent states or alter executed transitions/replays.
 * The archived original GitHub Actions artifact preserves the unmodified JSON.
 */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces", entries=[];
for(const viewport of ["desktop","mobile"]){
 const file="author-audit-"+viewport+"-frontier.json",target=path.join(dir,file);
 const trace=JSON.parse(fs.readFileSync(target,"utf8"));
 if(trace.type!=="author-observed-transitions"||trace.provenance?.runtime_executed!==true)
   throw Error("Not raw browser evidence: "+file);
 const known=new Set(trace.states.map(s=>s.id));
 for(const edge of trace.transitions)
  if(!known.has(edge.from)||!known.has(edge.to)||edge.observed!==true)
   throw Error("Executed transition invalid; refusing cleanup: "+file+" "+edge.id);
 const removed=trace.frontier.filter(f=>!known.has(f.state));
 trace.frontier=trace.frontier.filter(f=>known.has(f.state));
 entries.push({file,prior_frontier_count:trace.frontier.length+removed.length,
  retained_frontier_count:trace.frontier.length,
  skipped_unanchored:removed.map(f=>({state:f.state,locator:f.locator,reason:f.reason,...(f.action?{action:f.action}:{})}))});
 fs.writeFileSync(target,JSON.stringify(trace,null,2)+String.fromCharCode(10));
}
fs.writeFileSync("audit/author-flow/frontier-filter-report.json",JSON.stringify({
 schema_version:1,type:"author-frontier-bookkeeping-recovery",
 method:"delete unanchored frontier references only; executed states, transitions and completed replays untouched",
 original_artifact_run:"https://github.com/natanai/pre-programmed/actions/runs/41222328493",
 interpretation:"Unobserved source states cannot be asserted in the new trace. Prior source frontier remains recorded in the immutable earlier scroll fixtures.",
 files:entries
},null,2)+String.fromCharCode(10));
console.log("Skipped unanchored legacy frontier references:",entries.map(e=>e.file+" "+e.skipped_unanchored.length).join(", "));

#!/usr/bin/env node
/* Explain precisely which prior frontier edges were executed in a continuation.
 * Old frontier records are never deleted or rewritten; this ledger compares them.
 */
import fs from "node:fs";
import path from "node:path";
const dir="audit/author-flow/traces";
const args=process.argv.slice(2);
const get=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const sourceSuite=get("--source","scroll"), continuationSuite=get("--suite","frontier");
if(!/^[a-z][a-z0-9-]*$/.test(sourceSuite)||!/^[a-z][a-z0-9-]*$/.test(continuationSuite))throw Error("Invalid suite");
const output={schema_version:1,type:"author-frontier-replay-progress",
 method:"exact prior state ID and exact action matched to executed continuation edge",
 source_suite:sourceSuite,continuation_suite:continuationSuite,
 interpretation:"Prior fixture observations are immutable. Resolved means the exact recorded origin state and action were executed again in a real browser; other edges remain unverified, not impossible.",
 viewports:[]};
for(const viewport of ["desktop","mobile"]){
 const name=suite=>path.join(dir,"author-audit-"+viewport+"-"+suite+".json");
 const prior=JSON.parse(fs.readFileSync(name(sourceSuite),"utf8"));
 const later=JSON.parse(fs.readFileSync(name(continuationSuite),"utf8"));
 const priorFixture=prior.fixtures[0],laterFixture=later.fixtures[0];
 if(priorFixture.project_sha256!==laterFixture.project_sha256||
    priorFixture.viewport.width!==laterFixture.viewport.width||
    priorFixture.viewport.height!==laterFixture.viewport.height)
   throw Error("Incompatible fixture for "+viewport);
 const key=(state,action)=>JSON.stringify([state,action]);
 const found=new Map();
 for(const edge of later.transitions){
   if(edge.observed!==true)throw Error("Unverified continuation edge");
   const k=key(edge.from,edge.action);
   if(!found.has(k))found.set(k,edge);
 }
 const originStates=new Map(prior.states.map(s=>[s.id,s]));
 const entries=new Map(),reasons={};
 for(const item of prior.frontier){
   reasons[item.reason]=(reasons[item.reason]??0)+1;
   if(item.reason!=="unvisited"||!item.action)continue;
   const k=key(item.state,item.action);
   if(entries.has(k))continue;
   const matched=found.get(k);
   entries.set(k,{
     from_state:item.state,action:item.action,
     workspace:originStates.get(item.state)?.ui?.workspace??null,
     status:matched?"verified-executed":"not-verified",
     ...(matched?{observed_to_state:matched.to,continuation_edge:matched.id}:{})
   });
 }
 const compared=[...entries.values()].sort((a,b)=>a.from_state.localeCompare(b.from_state)||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
 const verified=compared.filter(e=>e.status==="verified-executed").length;
 output.viewports.push({
  viewport,source_fixture:priorFixture.id,continuation_fixture:laterFixture.id,
  reference_frontier_reasons:reasons,
  eligible_finite_unvisited:compared.length,verified_executed:verified,
  not_verified:compared.length-verified,
  continuation_observed_transitions:later.transitions.length,
  entries:compared
 });
}
const destination="audit/author-flow/frontier-progress.json";
const data=JSON.stringify(output,null,2)+String.fromCharCode(10);
if(process.argv.includes("--check")){
 if(!fs.existsSync(destination)||fs.readFileSync(destination,"utf8")!==data)throw Error("Frontier ledger stale");
 console.log("Verified exact frontier continuation progress");
}else{
 fs.writeFileSync(destination,data);
 console.log("Frontier continuation:",output.viewports.map(v=>v.viewport+" "+v.verified_executed+"/"+v.eligible_finite_unvisited).join(", "));
}

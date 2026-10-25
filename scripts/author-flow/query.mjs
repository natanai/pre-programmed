#!/usr/bin/env node
/* JSON-only graph queries; no author goals or heuristic UI judgments. */
import fs from "node:fs";
const graph=JSON.parse(fs.readFileSync("audit/author-flow/source-graph.json","utf8"));
const args=process.argv.slice(2);
function arg(key){const i=args.indexOf(key);return i>=0?args[i+1]:null;}
function matches(record,q){return JSON.stringify(record).toLocaleLowerCase().includes(q.toLocaleLowerCase());}
const nodeId=arg("--node");
const find=arg("--find");
const call=arg("--api");
const workspace=arg("--workspace");
const branch=arg("--branch");
const collection=arg("--collection");
const limit=Math.min(1000,Math.max(1,Number(arg("--limit")??50)));
let result;
if(nodeId) {
  const node=graph.nodes.find(n=>n.id===nodeId);
  result={node:node??null,declared_children:graph.edges.filter(e=>e.from===nodeId && e.relation==="declared-nesting").map(e=>graph.nodes.find(n=>n.id===e.to)).filter(Boolean),api_calls:graph.navigation_calls.filter(c=>c.owner_control===nodeId)};
}else if(branch){
  result={branch_sites:graph.branch_sites.filter(s=>matches(s,branch)).slice(0,limit)};
}else if(collection){
  result={collection_sites:graph.collection_sites.filter(s=>matches(s,collection)).slice(0,limit)};
}else if(call){
  result={api_calls:graph.navigation_calls.filter(c=>matches(c,call)).slice(0,limit)};
}else if(workspace){
  result={nodes:graph.nodes.filter(n=>n.workspace===workspace).slice(0,limit)};
}else if(find){
  const nodes=graph.nodes.filter(n=>matches({id:n.id,declared_id:n.declared_id,label:n.label,handlers:n.handlers},find)).slice(0,limit);
  result={nodes,api_calls:graph.navigation_calls.filter(c=>matches(c,find)).slice(0,limit),branch_sites:graph.branch_sites.filter(s=>matches(s,find)).slice(0,limit),collection_sites:graph.collection_sites.filter(s=>matches(s,find)).slice(0,limit)};
}else{
  result={counts:graph.counts,sources:graph.sources,limitations:graph.semantics};
}
process.stdout.write(JSON.stringify({query:{nodeId,find,call,branch,collection,workspace,limit},result},null,2)+"\n");

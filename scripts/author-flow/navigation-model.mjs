#!/usr/bin/env node
/**
 * Lightweight, read-only navigation model derived from the existing AST inventory.
 * It does not open a browser, execute Author handlers, run tests, or launch CI.
 * Usage:
 *   npm run audit:author:extract
 *   node scripts/author-flow/navigation-model.mjs
 *   node scripts/author-flow/navigation-model.mjs --from narrative-structure --to narrative.node
 *   node scripts/author-flow/navigation-model.mjs --find character
 */
import fs from "node:fs";
function buildGraph(g){
  const controls=new Map(g.nodes.map(n=>[n.id,n]));
  function routeFrom(expression){
    if(typeof expression!=="string"||!expression.trim().startsWith("{"))return null;
    const type=expression.match(/\btype\s*:\s*["'](feature|workspace|tools)["']\s*(?:as const)?/);
    if(!type)return null;
    if(type[1]==="tools")return {type:"tools",key:"tools"};
    if(type[1]==="workspace"){
      const view=expression.match(/\bview\s*:\s*["'](navigation|history)["']/);
      return view?{type:"workspace",view:view[1],key:"workspace."+view[1]}:null;
    }
    const feature=expression.match(/\bfeature\s*:\s*["']([a-z0-9_-]+)["']/);
    const workspace=expression.match(/\bworkspace\s*:\s*["']([a-z0-9_-]+)["']/);
    return feature&&workspace?{type:"feature",feature:feature[1],workspace:workspace[1],key:feature[1]+"."+workspace[1]}:null;
  }
  const edges=[],unresolved=[],routes=new Map(),workspaces=new Set();
  const normalizedLabel=label=>typeof label==="string"?label:null;
  for(const call of g.navigation_calls){
    if(!/(^|\.)(pushTask|openTask)$/.test(call.api))continue;
    const control=controls.get(call.owner_control);
    if(control?.workspace)workspaces.add(control.workspace);
    const route=routeFrom(call.args?.[0]);
    const item={
      id:call.id,source:call.source,api:call.api,
      origin_workspace:control?.workspace??null,
      origin_control_id:call.owner_control??null,
      control_kind:control?.kind??null,
      control_label:normalizedLabel(control?.label),
      source_guards:[...new Set([...(control?.guards??[]),...(call.guards??[])])],
      route_expression:call.args?.[0]??null
    };
    if(!route){
      unresolved.push({...item,reason:"computed-or-indirect-route",candidate_route:null});
      continue;
    }
    routes.set(route.key,route);
    if(!control?.workspace){
      unresolved.push({...item,reason:"source-workspace-unbound",candidate_route:route.key});
      continue;
    }
    // Invocation count is a source-level property. A real click/tap, disabled state,
    // choice visibility and persistence require further runtime evidence.
    edges.push({
      from:"workspace:"+control.workspace,to:"route:"+route.key,
      action:"invoke-declared-handler",
      handler_invocations:1,
      pointer_actions:null,
      evidence:"source-ast",
      ...item,
    });
  }
  edges.sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)||a.id.localeCompare(b.id));
  unresolved.sort((a,b)=>a.source.file.localeCompare(b.source.file)||a.source.line-b.source.line||a.id.localeCompare(b.id));
  const routeIds=new Set(routes.keys());
  const exactNameOverlaps=[...routeIds].filter(name=>workspaces.has(name)).sort();
  return {
    schema_version:1,
    type:"author-declared-navigation-model",
    provenance:{source:"audit/author-flow/source-graph.json",generator:"scripts/author-flow/navigation-model.mjs",runtime_executed:false},
    semantics:{
      graph_type:"directed multigraph of statically provable task-push declarations",
      one_edge:"One declared pushTask/openTask invocation, not a guaranteed visible click, successful navigation, Save, or round trip.",
      guard:"Unevaluated source conditions; runtime visibility, disabled state, resource counts, and parent drafts are not resolved.",
      path_cost:"Only a count of declared handler invocations along explicitly linked edges; absent paths mean unknown, not unreachable.",
      nested_return:"The runtime's push/pop task contract is known, but specific successful return/save behaviors cannot be inferred from static AST.",
      workspace_route_identity:"Workspace identifiers and feature route keys are not automatically joined by naming convention. Exact string overlaps are reported as candidates only.",
    },
    counts:{declared_transition_edges:edges.length,unresolved_navigation_calls:unresolved.length,route_destinations:routeIds.size,workspace_sources:workspaces.size},
    workspace_sources:[...workspaces].sort(),
    destinations:[...routes.values()].sort((a,b)=>a.key.localeCompare(b.key)),
    matching_workspace_id_candidates:exactNameOverlaps,
    transitions:edges,
    unresolved,
  };
}
const source=JSON.parse(fs.readFileSync("audit/author-flow/source-graph.json","utf8"));
const model=buildGraph(source);
const args=process.argv.slice(2);
const value=k=>{const index=args.indexOf(k);return index===-1?null:args[index+1]};
const from=value("--from"),to=value("--to"),find=value("--find");
if(from||to){
  if(!from||!to)throw Error("Both --from and --to are required");
  const fromId=from.startsWith("workspace:")?from:"workspace:"+from;
  const toId=to.startsWith("route:")?to:"route:"+to;
  const matches=model.transitions.filter(edge=>edge.from===fromId&&edge.to===toId);
  process.stdout.write(JSON.stringify({
    type:"author-declared-path-query",from:fromId,to:toId,
    declared_direct_handlers:matches.length,observed:false,
    required_handler_invocations:matches.length?1:null,
    known_paths:matches,
    note:matches.length?"Declared direct handler. Visibility, guard satisfaction, and effect unverified.":
      "No direct handler is source-certified; this is not evidence of unreachability or of a longer minimum path."
  },null,2)+"\n");
}else if(find){
  const needle=find.toLowerCase();
  process.stdout.write(JSON.stringify({
    type:"author-declared-search",term:find,
    transitions:model.transitions.filter(x=>JSON.stringify(x).toLowerCase().includes(needle)).slice(0,100),
    unresolved:model.unresolved.filter(x=>JSON.stringify(x).toLowerCase().includes(needle)).slice(0,100)
  },null,2)+"\n");
}else{
  const output="audit/author-flow/navigation-model.json";
  const generated=JSON.stringify(model,null,2)+"\n";
  if(args.includes("--check")){
    if(!fs.existsSync(output)||fs.readFileSync(output,"utf8")!==generated)
      throw Error("Navigation model is stale. Run node scripts/author-flow/navigation-model.mjs");
    console.log("Navigation model matches its source declarations");
  }else{
    fs.writeFileSync(output,generated);
    console.log("Navigation model generated:",model.counts);
  }
}

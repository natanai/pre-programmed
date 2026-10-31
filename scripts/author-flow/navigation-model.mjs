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

/** Canonical resource provider declarations. Pure source scanner; never invokes route handlers. */
function parseProviders(files) {
 function end(s,start,open,close) {
   let d=0,q="",escaped=false,line=false,block=false;
   for(let i=start;i<s.length;i++){
     let c=s[i],n=s[i+1];
     if(line){if(c==="\n")line=false;continue}
     if(block){if(c==="*"&&n==="/"){block=false;i++}continue}
     if(q){if(escaped){escaped=false;continue}if(c==="\\"){escaped=true;continue}if(c===q)q="";continue}
     if(c==="/"&&n==="/"){line=true;i++;continue}
     if(c==="/"&&n==="*"){block=true;i++;continue}
     if(c==='"'||c==="'"||c==="`"){q=c;continue}
     if(c===open)d++;else if(c===close&&!--d)return i;
   }
   return -1;
 }
 function route(text,arg) {
   const type=text.match(/\btype\s*:\s*["'](feature|workspace|tools)["']/)?.[1];
   if(!type)return null;
   if(type==="tools")return "tools";
   if(type==="workspace"){const v=text.match(/\bview\s*:\s*["']([\w-]+)["']/)?.[1];return v?"workspace."+v:null}
   const feature=text.match(/\bfeature\s*:\s*["']([\w-]+)["']/)?.[1];
   const literal=text.match(/\bworkspace\s*:\s*["']([\w-]+)["']/)?.[1];
   const dynamic=/\bworkspace\s*,/.test(text)||/\bworkspace\s*:\s*workspace\b/.test(text);
   return feature&&(literal||(dynamic&&arg))?feature+"."+(literal||arg):null;
 }
 function resolve(expression){
   const x=expression.trim();
   if(x.startsWith("({")||x.startsWith("{")){
     const i=x.indexOf("{"),j=end(x,i,"{","}");return j<0?null:route(x.slice(i,j+1));
   }
   const call=x.match(/^([A-Za-z_]\w*)\s*\(\s*["']([^"']+)["']/);
   if(call){
     for(const value of Object.values(files)){
       const m=new RegExp("\\bfunction\\s+"+call[1]+"\\s*\\(").exec(value);
       if(!m)continue;
       const bodyStart=value.indexOf("{",value.indexOf(")",m.index)+1),bodyEnd=end(value,bodyStart,"{","}");
       if(bodyStart>=0&&bodyEnd>=0){const res=route(value.slice(bodyStart,bodyEnd+1),call[2]);if(res)return res}
     }
   }
   const alias=x.match(/^([A-Z][A-Z_0-9]+)\b/);
   if(alias)for(const value of Object.values(files)){
     const m=new RegExp("\\bconst\\s+"+alias[1]+"\\s*=\\s*\\{").exec(value);
     if(m){const i=value.indexOf("{",m.index),j=end(value,i,"{","}");if(j>=0){const res=route(value.slice(i,j+1));if(res)return res}}
   }
   return null;
 }
 function property(body,key){
   const m=new RegExp("\\b"+key+"\\s*:\\s*").exec(body);
   if(!m)return {declared:false,route:null,expression:null};
   const text=body.slice(m.index+m[0].length);
   const arrow=text.indexOf("=>");
   if(arrow<0||arrow>200)return {declared:true,route:null,expression:text.match(/^[A-Za-z_]\w*/)?.[0]??null};
   const value=text.slice(arrow+2).trimStart();
   let expression;
   if(value.startsWith("({")||value.startsWith("{")){
     const i=value.indexOf("{"),j=end(value,i,"{","}");
     expression=j<0?value.slice(0,160):value.slice(0,j+1);
   }else expression=value.match(/^([A-Za-z_]\w*\([^)]*\)|[A-Z][A-Z_0-9]+)/)?.[0]??value.split("\n")[0].slice(0,160);
   return {declared:true,route:resolve(expression),expression:expression.slice(0,350)};
 }
 const results=[];
 for(const file of Object.keys(files).filter(p=>p.endsWith("/author/manifest.ts")||p.endsWith("/author/manifest.tsx")||p==="src/author/features/projectManifest.tsx").sort()){
   const s=files[file],m=/\bresources\s*:\s*\[/.exec(s);
   if(!m)continue;
   const start=s.indexOf("[",m.index),stop=end(s,start,"[","]");if(stop<0)continue;
   let i=start+1;
   while(i<stop){
     const j=s.indexOf("{",i);if(j<0||j>=stop)break;
     const k=end(s,j,"{","}");if(k<0||k>stop)break;
     const body=s.slice(j,k+1),kind=body.match(/^\{\s*kind\s*:\s*["']([^"']+)["']/)?.[1];
     if(kind){
       results.push({kind,label:body.match(/\blabel\s*:\s*["']([^"']+)["']/)?.[1]??null,
         owner:{file,line:s.slice(0,j).split("\n").length},
         create:property(body,"createRoute"),edit:property(body,"editRoute"),list:property(body,"listRoute")});
     }
     i=k+1;
   }
 }
 return results.sort((a,b)=>a.kind.localeCompare(b.kind));
}
function authorResourceSourceFiles(graph) {
  const paths=new Set();
  // Derive feature manifests from the actual Author composition registry.
  const registry=fs.readFileSync("src/author/features/registry.tsx","utf8");
  for(const match of registry.matchAll(/from\s+["']\.\.\/\.\.\/(features\/[^"']+\/author\/manifest)["']/g)){
    for(const extension of [".ts",".tsx"]){
      const file="src/"+match[1]+extension;
      if(fs.existsSync(file))paths.add(file);
    }
  }
  paths.add("src/author/features/projectManifest.tsx");
  // Resolve imported canonical route helpers using real source definitions,
  // not a second hand-maintained registry of resource destinations.
  for(const file of ["src/features/world/author/entityWorkspaces.tsx","src/features/inventory/author/workspaces.tsx"])
    if(fs.existsSync(file))paths.add(file);
  for(const node of graph.nodes)
    if(node.workspace&&["jsx.ReferenceField","declarative.resource"].includes(node.kind))
      paths.add(node.source.file);
  return Object.fromEntries([...paths].sort().filter(p=>fs.existsSync(p)).map(p=>[p,fs.readFileSync(p,"utf8")]));
}
function discoverReferenceSites(graph,files,providers) {
  const byKind=new Map(providers.map(provider=>[provider.kind,provider]));
  const sites=[];
  for(const n of graph.nodes){
    if(!n.workspace||!["jsx.ReferenceField","declarative.resource"].includes(n.kind))continue;
    const file=files[n.source.file];if(!file)continue;
    const text=file.split("\n").slice(n.source.line-1,n.source.line+16).join("\n");
    const kind=n.kind==="jsx.ReferenceField"
      ? text.match(/\bkind\s*=\s*["']([^"']+)["']/)?.[1]
      : (/\bonChange\s*:/.test(text.slice(0,800))?text.match(/\bkind\s*:\s*["']([^"']+)["']/)?.[1]:null);
    if(!kind)continue;
    const provider=byKind.get(kind);
    sites.push({id:n.id,source:n.source,workspace:n.workspace,resource_kind:kind,ui_contract:n.kind,
      create_route:provider?.create.route??null,create_declared:!!provider?.create.declared,
      visibility:"runtime-dependent",clicks_to_open_child:null});
  }
  return sites.sort((a,b)=>a.id.localeCompare(b.id));
}


function discoverWorkspaceBindings(files) {
  const bindings=[];
  for(const [file,source] of Object.entries(files)){
    const rx=/\bdefineAuthorWorkspace(?:<[^>]+>)?\s*\(\s*\{\s*id\s*:\s*["']([^"']+)["']/g;
    let m;
    while((m=rx.exec(source))){
      const snippet=source.slice(m.index,m.index+1200);
      const preamble=snippet.split(/\bcreateDraft\s*[:(]|\bbuildSpec\s*[:(]/)[0];
      const feature=preamble.match(/\broute\.feature\s*===\s*["']([\w-]+)["']/)?.[1];
      const workspace=preamble.match(/\broute\.workspace\s*===\s*["']([\w-]+)["']/)?.[1];
      if(!feature||!workspace)continue;
      bindings.push({
        from:"route:"+feature+"."+workspace,to:"workspace:"+m[1],
        source:{file,line:source.slice(0,m.index).split("\n").length},
        match_constraints:preamble.includes("route.data")?"additional route-data conditions":"feature and workspace predicates",
        evidence:"workspace matches() source declaration",pointer_actions:0,handler_invocations:0,
      });
    }
  }
  return bindings.sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)||a.source.file.localeCompare(b.source.file));
}
function findDeclaredRoutePath(model,sourceWorkspace,targetRoute,firstResource=null) {
  const start=sourceWorkspace.startsWith("workspace:")?sourceWorkspace:"workspace:"+sourceWorkspace;
  const end=targetRoute.startsWith("route:")?targetRoute:"route:"+targetRoute;
  const outgoing=new Map();
  for(const e of [...model.transitions,...model.contextual_creates,...model.workspace_route_bindings]){
    if(!outgoing.has(e.from))outgoing.set(e.from,[]);
    outgoing.get(e.from).push(e);
  }
  for(const list of outgoing.values())list.sort((a,b)=>a.to.localeCompare(b.to)||JSON.stringify(a.source??"").localeCompare(JSON.stringify(b.source??"")));
  // A via filter is a real graph constraint, not an output decoration.
  // Track whether the requested resource was actually traversed.
  const initialVia=!firstResource;
  const pending=[{at:start,steps:[],viaSatisfied:initialVia}];
  const seen=new Set([start+"|"+initialVia]);
  while(pending.length){
    const current=pending.shift();
    if(current.at===end&&current.viaSatisfied)return {found:true,steps:current.steps,
      declared_task_opens:current.steps.reduce((total,step)=>total+(step.handler_invocations??0),0)};
    for(const step of outgoing.get(current.at)??[]){
      const viaSatisfied=current.viaSatisfied||step.via==="resource:"+firstResource;
      const key=step.to+"|"+viaSatisfied;
      if(seen.has(key))continue;
      seen.add(key);pending.push({at:step.to,steps:[...current.steps,step],viaSatisfied});
    }
  }
  return {found:false,steps:[],declared_task_opens:null};
}


/**
 * Read-only evidence of shared Author lifecycle contracts. These are checks of
 * real source expressions, not an independent implementation of their effects.
 */
function describeTaskLifecycle(readFile) {
  const witnesses=[
    ["push-preserves-stack","src/author/tasks/useAuthorTaskRuntime.ts","commitTasks([...tasksRef.current, task]);"],
    ["root-open-replaces-stack","src/author/tasks/useAuthorTaskRuntime.ts","commitTasks([task]);"],
    ["completion-pops-child","src/author/tasks/useAuthorTaskRuntime.ts","return popTask(taskId, result);"],
    ["completion-sends-result","src/author/tasks/useAuthorTaskRuntime.ts","queueMicrotask(() => completion(result));"],
    ["root-completion-shows-tools","src/author/tasks/useAuthorTaskRuntime.ts",'commitTasks([taskFor({ type: "tools" })]);'],
    ["back-guards-dirty-draft","src/author/tasks/useAuthorTaskRuntime.ts",'setLeaveConfirmation({ action: "back", dirtyCount: 1, taskId: active.id });'],
    ["close-guards-dirty-tasks","src/author/tasks/useAuthorTaskRuntime.ts",'setLeaveConfirmation({ action: "close", dirtyCount: currentDirtyCount });'],
    ["master-close-clears-stack","src/author/tasks/useAuthorTaskRuntime.ts","commitTasks([]);"],
    ["resource-create-pushes-owner","src/author/resources/runtime.ts","pushTask(route, (result) => {"],
    ["resource-callback-checks-kind","src/author/resources/runtime.ts",'result?.type === "resource" && result.kind === kind'],
    ["reference-field-adopts-child","src/author/resources/ReferenceField.tsx","onChangeRef.current(resource.value);"],
    ["reference-picker-direct-create","src/author/resources/ReferenceField.tsx","if (!value && !options.length && canCreate) {"],
    ["reference-picker-chooser","src/author/resources/ReferenceField.tsx","setOpen(true);"],
    ["accepted-save-required","src/author/ui/workspaceDefinition.tsx","if (!result.accepted) return false;"],
    ["accepted-child-save-completes","src/author/ui/workspaceDefinition.tsx","if (result.completion && options.completeTask !== false && context.hasParentTask) context.completeTask(result.completion);"],
    ["save-control-requires-dirty-valid","src/author/ui/workspaceDefinition.tsx","disabled: saving || !dirty || !validForSave,"],
    ["parent-workspace-suspended-mounted","src/author/workspace/AuthorWorkspaceHost.tsx",'style={active ? undefined : { display: "none" }}'],
    ["master-x-returns-to-player","src/author/workspace/AuthorWorkspaceHost.tsx",'aria-label="Close Author tasks and return to play"'],
    ["master-x-invokes-request-close","src/author/workspace/AuthorWorkspaceHost.tsx","onClick={requestClose}"],
  ];
  const contracts=witnesses.map(([id,file,needle])=>{
    const source=readFile(file);
    const index=source?.indexOf(needle)??-1;
    return {id,status:index<0?"unresolved":"source-declared",source:index<0?{file,line:null}:{file,line:source.slice(0,index).split("\n").length}};
  });
  return {
    evidence:"matched expressions in shared Author source; no browser or handlers executed",
    contracts,
    unresolved_contracts:contracts.filter(c=>c.status==="unresolved").map(c=>c.id),
    observed_runtime_behavior:false,
  };
}
function resourceSaveCompletionContract(model,route,readFile) {
  const bindings=model.workspace_route_bindings.filter(b=>b.from===route);
  return bindings.map(binding=>{
    const source=readFile(binding.source.file);
    const hasAccepted=Boolean(source?.includes("accepted: true"));
    const hasCompletion=Boolean(source?.includes("completion:"));
    const hasResourceType=Boolean(source?.includes('type: "resource"'));
    return {
      workspace:binding.to,
      source:binding.source,
      route_conditions:binding.match_constraints,
      status:hasAccepted&&hasCompletion&&hasResourceType?"conditional-owner-completion-declared":"unresolved",
      conditions:["owner Save is enabled","owner validation accepts the draft","canonical persistence succeeds or is accepted for queuing","resource task returns a matching typed completion"],
    };
  });
}
function traceNestedRoundTrip(model,from,chain,readFile) {
  const root=from.startsWith("workspace:")?from:"workspace:"+from;
  const frames=[];
  const unknown=[];
  let cursor=root;
  if(!chain.length)unknown.push("A nonempty --chain is required");
  for(const kind of chain){
    const choices=model.contextual_creates.filter(e=>e.from===cursor&&e.via==="resource:"+kind);
    if(choices.length!==1){
      unknown.push({at:cursor,kind,reason:choices.length?"multiple-source-declared-reference-sites":"no-source-declared-contextual-create",candidates:choices});
      break;
    }
    const edge=choices[0],provider=model.resource_providers.find(p=>p.kind===kind);
    const bindings=model.workspace_route_bindings.filter(b=>b.from===edge.to);
    if(!provider||"route:"+provider.create.route!==edge.to){
      unknown.push({at:cursor,kind,reason:"canonical-provider-route-mismatch"});
      break;
    }
    if(bindings.length!==1){
      unknown.push({at:cursor,kind,reason:bindings.length?"multiple-route-matcher-candidates":"unresolved-route-workspace-binding",candidates:bindings});
      break;
    }
    const binding=bindings[0];
    const completion=resourceSaveCompletionContract(model,edge.to,readFile);
    if(!completion.some(entry=>entry.workspace===binding.to&&entry.status==="conditional-owner-completion-declared"))
      unknown.push({at:binding.to,kind,reason:"owner-resource-completion-source-unconfirmed"});
    frames.push({
      parent_workspace:cursor,resource_kind:kind,
      reference_site:edge.source,canonical_provider:provider.owner,
      child_route:edge.to,child_workspace:binding.to,
      entry:{action:"create-from-reference-field",pointer_actions:{direct_if_empty:1,chooser_if_options_present:2},conditional:true},
      save:{action:"canonical-owner-save",control:"author-core-save",pointer_actions_if_enabled:1,completion:completion[0]??null},
      handoff:{action:"typed-resource-result-to-parent-field",automatic_if_accepted:true,pointer_actions:0},
      return:{action:"completeTask-pop-to-immediate-parent",automatic_if_accepted:true,pointer_actions:0},
      unverified:["field visibility","draft validity","persistence success","focus and scroll restoration","actual rendered click sequence"],
    });
    cursor=binding.to;
  }
  const lifecycle=model.task_lifecycle;
  const needed=["push-preserves-stack","completion-pops-child","completion-sends-result","resource-create-pushes-owner","resource-callback-checks-kind","reference-field-adopts-child","accepted-save-required","accepted-child-save-completes","parent-workspace-suspended-mounted","master-x-returns-to-player","master-x-invokes-request-close"];
  const missing=needed.filter(id=>lifecycle.contracts.find(c=>c.id===id)?.status!=="source-declared");
  if(missing.length)unknown.push({reason:"unconfirmed-shared-runtime-contracts",ids:missing});
  const complete=frames.length===chain.length&&!unknown.length;
  return {
    type:"candidate-contextual-nested-round-trip",from:root,resource_chain:chain,
    source_path_resolved:complete,
    frames,return_order:[...frames].reverse().map(f=>({saved_child:f.resource_kind,resumes:f.parent_workspace,condition:"accepted matching resource completion; not an executed result"})),
    after_nested_tasks:{at:root,save_parent_if_dirty:"conditional; not counted as a verified Save",master_x:"requestClose; dirty tasks require confirmation"},
    declared_child_task_opens:complete?frames.length:null,
    possible_pointer_actions_for_opening_references:complete?{lower:frames.length,upper:frames.length*2,assumes_each_reference_field_rendered:true}:null,
    possible_child_save_button_activations_if_all_enabled:complete?frames.length:null,
    conditional_known_control_subtotal:complete?{
      lower:frames.length*2+1,upper:frames.length*3+1,
      includes:"nested Create controls, one enabled Save per child, and master X",
      excludes:["field editing and typing","parent Save","dirty-leave confirmation","any intervening choices or dialogs"],
      warning:"Only conditional source-declared controls, not a measured path or universal minimum.",
    }:null,
    exact_total_pointer_actions:null,
    browser_verified:false,persistence_verified:false,parent_draft_verified:false,
    unresolved:unknown,
    note:"This is a conditional source-derived sequence, never a certified successful play-to-author-to-play interaction.",
  };
}

const source=JSON.parse(fs.readFileSync("audit/author-flow/source-graph.json","utf8"));
const model=buildGraph(source);
const providerFiles=authorResourceSourceFiles(source);
model.resource_providers=parseProviders(providerFiles);
model.reference_sites=discoverReferenceSites(source,providerFiles,model.resource_providers);
model.workspace_route_bindings=discoverWorkspaceBindings(providerFiles);
model.contextual_creates=model.reference_sites.filter(s=>s.create_route).map(s=>({
  from:"workspace:"+s.workspace,to:"route:"+s.create_route,via:"resource:"+s.resource_kind,
  source:s.source,site_id:s.id,handler_invocations:1,pointer_actions:null,
  evidence:"reference-field-and-canonical-provider",conditional:true,
}));
model.counts.registered_resource_providers=model.resource_providers.length;
model.counts.contextual_create_declarations=model.contextual_creates.length;
model.counts.workspace_route_bindings=model.workspace_route_bindings.length;
model.schema_version=2;
model.semantics.graph_type="Directed multigraph of declared task pushes, canonical resource contracts, contextual reference fields and workspace matchers.";
model.semantics.workspace_route_identity="Joins use declared defineAuthorWorkspace matches predicates; any additional route-data conditions remain unresolved until evaluated.";
model.semantics.resource_paths="Path queries trace only declared edges; they do not execute handlers, Save or Back, and do not establish actual click counts.";
model.task_lifecycle=describeTaskLifecycle(path=>fs.existsSync(path)?fs.readFileSync(path,"utf8"):null);
model.schema_version=3;
model.semantics.task_lifecycle="Source-witnessed shared task mechanics and conditional owner completion; never an execution or Save guarantee.";
const args=process.argv.slice(2);
const value=k=>{const index=args.indexOf(k);return index===-1?null:args[index+1]};
const from=value("--from"),to=value("--to"),find=value("--find"),create=value("--create"),via=value("--via");
const chain=value("--chain");
if(args.includes("--roundtrip")){
  if(!from||!chain)throw Error("--roundtrip requires --from and --chain (comma-separated resource kinds)");
  const result=traceNestedRoundTrip(model,from,chain.split(",").map(s=>s.trim()).filter(Boolean),
    path=>fs.existsSync(path)?fs.readFileSync(path,"utf8"):null);
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}else if(args.includes("--path")){
  if(!from||!to)throw Error("--path requires --from and --to");
  const route=findDeclaredRoutePath(model,from,to,via);
  process.stdout.write(JSON.stringify({
    type:"candidate-declared-task-path",from,to,via:via??null,found:route.found,
    declared_task_opens:route.declared_task_opens,steps:route.steps,
    observed:false,actual_pointer_actions:null,actual_save_return_verified:false,
    warning:"A candidate through source declarations, not proof of a rendered, enabled, successful Author workflow. Absent path means unknown, not unreachable."
  },null,2)+"\n");
}else if(create){
  const matches=model.contextual_creates.filter(x=>x.via==="resource:"+create && (!from||x.from==="workspace:"+from));
  process.stdout.write(JSON.stringify({type:"contextual-resource-create-query",from:from??null,resource:create,candidates:matches,
    observed:false,description:"Source-declared navigation only; the field may be hidden and child Save/Back must be verified separately.",
    picker_actions:matches.length?{when_no_selection_and_no_existing_options:1,when_picker_is_needed:2}:null,
    note:"Picker counts are conditional from ReferenceField openOrCreate; no completed task/click-count claim."},null,2)+"\n");
}else if(from||to){
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
    resource_providers:model.resource_providers.filter(x=>JSON.stringify(x).toLowerCase().includes(needle)).slice(0,100),
    contextual_creates:model.contextual_creates.filter(x=>JSON.stringify(x).toLowerCase().includes(needle)).slice(0,100),
    workspace_route_bindings:model.workspace_route_bindings.filter(x=>JSON.stringify(x).toLowerCase().includes(needle)).slice(0,100),
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

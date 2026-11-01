#!/usr/bin/env node
/**
 * One deterministic, repo-only lookup for anticipated Author tasks.
 * Input tasks are explicit hypotheses; graph is source-derived; no browser.
 * No test runner, no GitHub Actions, no application runtime.
 */
import fs from "node:fs";
function buildLookup(model,definitions){
  if(model.schema_version<3)throw Error("Require navigation model schema 3");
  if(definitions.schema_version!==1)throw Error("Unsupported anticipated-task schema");
  const required=[
    "push-preserves-stack","completion-pops-child","completion-sends-result","resource-create-pushes-owner",
    "resource-callback-checks-kind","reference-field-adopts-child","accepted-save-required",
    "accepted-child-save-completes","save-control-requires-dirty-valid","master-x-invokes-request-close"
  ];
  const missingShared=required.filter(id=>model.task_lifecycle.contracts.find(c=>c.id===id)?.status!=="source-declared");
  const providerByKind=new Map(model.resource_providers.map(p=>[p.kind,p]));
  const unique=(a)=>[...new Set(a)];
  const items=[];
  for(const task of definitions.tasks){
    const trace=[],issues=[],flags=[];
    let cursor="workspace:"+task.start.workspace;
    const ownerOf=w=>w.replace(/^(?:workspace:|route:)/,"").split(/[.-]/)[0];
    let previousOwner=ownerOf(cursor);
    let crossFeature=0;
    let min=0,max=0,fullyLinked=true;
    let conditionalPickerCount=0;
    const frames=[];
    for(let i=0;i<task.resource_chain.length;i++){
      const step=task.resource_chain[i],provider=providerByKind.get(step.kind);
      const matching=model.reference_sites.filter(s=>"workspace:"+s.workspace===cursor&&s.resource_kind===step.kind);
      const operation=step.action;
      const routeKey=provider?.[operation]?.route? "route:"+provider[operation].route:null;
      // A contextual resource task can also be opened by a literal handler,
      // without using ReferenceField (e.g. Narrative Interaction -> new Node).
      // Demand an explicit resourceTask kind; do not treat every route push
      // as an authoring creation path.
      const directTasks=operation==="create"&&routeKey&&matching.length===0
        ? model.transitions.filter(e=>e.from===cursor&&e.to===routeKey
          && e.route_expression?.match(/\bresourceTask\s*:\s*["']([^"']+)["']/)?.[1]===step.kind)
        : [];
      const directTask=directTasks.length===1?directTasks[0]:null;
      const result={step:i+1,operation,resource_kind:step.kind,from:cursor,
        expected_resource_owner:provider?.owner?.file??null,
        source_reference_candidates:matching.map(m=>m.source),
        source_route:routeKey,source_workspace:null,
        controls:null,contract_status:"unresolved",blockers:[],
        entry_source_type:directTask?"explicit-resource-task-handler":"canonical-reference-field",
        evidence:directTask?[directTask.id]:matching.map(m=>m.id),
        source_direct_handler:directTask?.source??null};
      if(!provider)result.blockers.push("resource-kind-not-in-canonical-provider-registry");
      if(!routeKey)result.blockers.push("canonical-"+operation+"-route-not-resolved");
      if(matching.length!==1&&!directTask)result.blockers.push(directTasks.length>1?"ambiguous-resource-task-handlers":matching.length===0?"no-reference-field-or-resource-task-handler-declared-in-current-workspace":"ambiguous-reference-fields");
      if(operation==="create"&&matching.length===1&&matching[0].create_route!==provider?.create.route)
        result.blockers.push("reference-field-not-bound-to-provider-create-route");
      if(operation==="edit" && !provider?.edit.declared)result.blockers.push("canonical-edit-not-declared");
      if(!["create","edit"].includes(operation))result.blockers.push("unsupported-task-operation");
      const bindings=routeKey?model.workspace_route_bindings.filter(e=>e.from===routeKey):[];
      if(bindings.length!==1)result.blockers.push(bindings.length===0?"route-to-workspace-unresolved":"route-has-multiple-workspace-matches");
      if(bindings.length===1)result.source_workspace=bindings[0].to;
      if(result.blockers.length){
        fullyLinked=false;
        issues.push({at:cursor,operation,resource_kind:step.kind,reason:result.blockers});
        result.contract_status="unresolved-from-source";
        trace.push(result);
        break;
      }
      result.contract_status="conditional-source-route-declared";
      if(directTask){
        // The handler is source-certified but a custom UI's physical activation
        // count is not; preserve null instead of assuming one click.
        result.controls=null;
        result.contract_status="conditional-direct-resource-task-declared";
      }else if(operation==="create"){
        result.controls={conditional_min:1,conditional_max:2,
          branch:"ReferenceField opens direct Create if there is no selected value and no options; otherwise opens chooser then Create",
          guards:["reference field is rendered","provider canCreate","reference selection and option count"]};
        conditionalPickerCount++;
      }else{
        result.controls={conditional_min:1,conditional_max:1,branch:"selected ReferenceField [EDIT]",
          guards:["selected reference exists","provider canEdit","reference field is rendered"]};
      }
      if(result.controls){
        min+=result.controls.conditional_min;
        max+=result.controls.conditional_max;
      }
      frames.push({kind:step.kind,operation,parent:cursor,child:result.source_workspace,
        entry_controls_known:!!result.controls,save_if_edit_or_create:"one conditional canonical owner Save activation"});
      const nextOwner=ownerOf(result.source_workspace);
      if(previousOwner!==nextOwner)crossFeature++;
      previousOwner=nextOwner;
      cursor=result.source_workspace;
      trace.push(result);
    }
    // We count only controls whose declarations can be identified. This is
    // not a complete procedure or a measured/global minimum.
    const nestedSourceResolved=fullyLinked&&frames.length===task.resource_chain.length;
    if(nestedSourceResolved){
      min+=frames.length;
      max+=frames.length;
    }
    if(task.finish?.save_parent){min++;max++;}
    if(task.finish?.return_to_player){min++;max++;}
    const knownControls=nestedSourceResolved&&frames.every(f=>f.entry_controls_known)?{
      conditional_lower:min,conditional_upper:max,
      scope:"reference Create/Edit + child Save + parent Save + master X only",
      exact_total:null,not_a_click_minimum:true
    }:null;
    const unresolved=[
      ...issues.map(x=>({category:"missing-static-navigation",...x})),
      ...task.author_work.map(work=>({category:"authored-content-actions-not-modeled",work})),
      {category:"entry-from-real-player-not-modeled",description:"The start is a declared Author workspace; player-to-workspace route and toggle actions are not counted"},
      {category:"runtime-conditions-not-evaluated",description:"Visibility, chooser contents, disabled controls, dirty draft guards, persistence and exact return context are unverified"}
    ];
    for(const id of missingShared)unresolved.push({category:"shared-task-lifecycle-witness-missing",contract_id:id});
    const status=!nestedSourceResolved?"missing-source-link":!task.resource_chain.length?"workspace-task-without-nested-route":
      trace.some(x=>x.entry_source_type==="explicit-resource-task-handler")?"resource-task-handler-source-declared":"contextual-route-source-declared";
    if(!nestedSourceResolved)flags.push("contextual-task-path-unresolved");
    if(crossFeature)flags.push("cross-owner-authoring");
    if(frames.length>1)flags.push("deep-contextual-nesting");
    if(conditionalPickerCount)flags.push("resource-chooser-branch");
    if(trace.some(x=>x.entry_source_type==="explicit-resource-task-handler"))flags.push("direct-custom-resource-task-activation-unknown");
    if(task.author_work.length)flags.push("authoring-controls-not-modeled");
    items.push({
      task_id:task.id,game:task.game,goal:task.goal,
      starting_workspace:task.start.workspace,
      origin_assumption:task.start,
      intended_author_work:task.author_work,
      source_path_status:status,
      declared_path_complete:nestedSourceResolved,
      route_steps:trace,
      reverse_handoff_order:nestedSourceResolved?[...frames].reverse().map(f=>({from:f.child,to:f.parent,
        trigger:"accepted child Save with matching resource completion",automatic:"source-contract-conditional"})):[],
      measures:{
        declared_resource_tasks:task.resource_chain.length,
        source_matched_resource_steps:frames.length,
        maximum_nested_author_depth_from_start:nestedSourceResolved?frames.length+1:null,
        cross_owner_transitions:crossFeature,
        chooser_branch_points:conditionalPickerCount,
        conditional_control_subtotal:knownControls,
        verified_end_to_end_actions:null,
        verified_draft_retention:null,
        verified_saves:null,
      },
      friction_indicators:unique(flags),
      unmodeled_or_unresolved:unresolved,
      provenance:{model:"audit/author-flow/navigation-model.json",goal_source:"audit/author-flow/anticipated-tasks.json",runtime_executed:false}
    });
  }
  items.sort((a,b)=>a.task_id.localeCompare(b.task_id));
  const games=unique(items.map(t=>t.game)).sort().map(game=>{
    const ts=items.filter(t=>t.game===game);
    const unresolved=ts.filter(t=>!t.declared_path_complete);
    const withoutResourceChain=ts.filter(t=>t.measures.declared_resource_tasks===0);
    return {game,anticipated_tasks:ts.length,
      resolved_nested_resource_routes:ts.filter(t=>t.declared_path_complete&&t.measures.declared_resource_tasks>0).length,
      tasks_without_nested_resource_route:withoutResourceChain.length,
      unresolved_nested_resource_routes:unresolved.length,
      needs_content_action_model:ts.filter(t=>t.intended_author_work.length>0).length,
      top_static_gaps:unresolved.map(t=>({task_id:t.task_id,missing:t.route_steps.filter(s=>s.blockers.length).map(s=>({kind:s.resource_kind,at:s.from,reason:s.blockers}))}))};
  });
  return {
    schema_version:1,type:"source-derived-anticipated-task-lookup",
    generated_from:{tasks:"audit/author-flow/anticipated-tasks.json",source_navigation:"audit/author-flow/navigation-model.json"},
    interpretation:{
      task_catalog:"Goals are explicit hypothetical author tasks for two game genres, not observed behavior",
      graph:"Routes and source-owner ownership come from the canonical source-derived navigation model",
      cost:"Only source-declared controls are counted. Conditional subtotals are NOT end-to-end costs, actual required clicks, subjective UX scores, or global minima.",
      unknown:"Absence of a captured static reference is not proof that the task is impossible, and unknown steps are not assigned artificial costs",
      focus:"Find misplaced/absent contextual routes and unexplained switches; context preservation is a separate contract, not a click minimization objective"
    },
    summary:{total_tasks:items.length,
      resolved_nested_resource_routes:items.filter(x=>x.declared_path_complete&&x.measures.declared_resource_tasks>0).length,
      tasks_without_nested_resource_route:items.filter(x=>x.measures.declared_resource_tasks===0).length,
      unresolved_nested_resource_routes:items.filter(x=>!x.declared_path_complete).length,games},
    tasks:items
  };
}
const model=JSON.parse(fs.readFileSync("audit/author-flow/navigation-model.json","utf8"));
const goals=JSON.parse(fs.readFileSync("audit/author-flow/anticipated-tasks.json","utf8"));
const lookup=buildLookup(model,goals);
const args=process.argv.slice(2);
const opt=key=>{const i=args.indexOf(key);return i<0?null:args[i+1]};
const task=opt("--task"),game=opt("--game");
const search=opt("--search"),compare=opt("--compare");
if(compare){
  const previous=JSON.parse(fs.readFileSync(compare,"utf8"));
  if(previous.type!==lookup.type||!Array.isArray(previous.tasks))throw Error("Comparison requires an earlier task-lookup.json");
  const earlier=new Map(previous.tasks.map(task=>[task.task_id,task]));
  const current=new Map(lookup.tasks.map(task=>[task.task_id,task]));
  const changes=[];
  for(const id of new Set([...earlier.keys(),...current.keys()])){
    const before=earlier.get(id),after=current.get(id);
    if(!before||!after){
      changes.push({task_id:id,type:before?"goal-removed":"goal-added"});
      continue;
    }
    const beforeCost=before.measures.conditional_control_subtotal;
    const afterCost=after.measures.conditional_control_subtotal;
    if(before.source_path_status===after.source_path_status
      && before.measures.source_matched_resource_steps===after.measures.source_matched_resource_steps
      && JSON.stringify(beforeCost)===JSON.stringify(afterCost))continue;
    changes.push({task_id:id,before:before.source_path_status,after:after.source_path_status,
      route_resolved:!before.declared_path_complete&&after.declared_path_complete,
      route_became_unresolved:before.declared_path_complete&&!after.declared_path_complete,
      conditional_controls_before:beforeCost,conditional_controls_after:afterCost,
      caution:"Comparative source visibility, not proof of a faster or more predictable user experience"});
  }
  process.stdout.write(JSON.stringify({type:"author-task-lookup-diff",
    previous_tasks:previous.tasks.length,current_tasks:lookup.tasks.length,
    changes:changes.sort((a,b)=>a.task_id.localeCompare(b.task_id))},null,2)+"\n");
}else if(search){
  const tokens=search.toLowerCase().split(/\s+/).filter(Boolean);
  const hits=lookup.tasks.map(item=>{
    const haystack=[item.task_id,item.goal,...item.intended_author_work].join(" ").toLowerCase();
    return {item,overlap:tokens.filter(t=>haystack.includes(t)).length};
  }).filter(row=>row.overlap>0).sort((a,b)=>b.overlap-a.overlap||a.item.task_id.localeCompare(b.item.task_id));
  process.stdout.write(JSON.stringify({type:"anticipated-task-search",query:search,
    matched_tasks:hits.map(row=>row.item)},null,2)+"\n");
}else if(task){
  const match=lookup.tasks.find(x=>x.task_id===task);
  if(!match)throw Error("Unknown task: "+task);
  process.stdout.write(JSON.stringify(match,null,2)+"\n");
}else if(game){
  const tasks=lookup.tasks.filter(x=>x.game===game);
  if(!tasks.length)throw Error("Unknown game: "+game);
  process.stdout.write(JSON.stringify({game,summary:lookup.summary.games.find(x=>x.game===game),tasks},null,2)+"\n");
}else if(args.includes("--gaps")){
  process.stdout.write(JSON.stringify({
    type:"unresolved-source-route-index",
    gaps:lookup.tasks.filter(x=>!x.declared_path_complete).map(t=>({
      task_id:t.task_id,game:t.game,goal:t.goal,
      first_unresolved:t.unmodeled_or_unresolved.find(x=>x.category==="missing-static-navigation")??null
    }))
  },null,2)+"\n");
}else if(args.includes("--summary")){
  process.stdout.write(JSON.stringify(lookup.summary,null,2)+"\n");
}else{
  const filename="audit/author-flow/task-lookup.json";
  const body=JSON.stringify(lookup,null,2)+"\n";
  if(args.includes("--check")){
    if(!fs.existsSync(filename)||fs.readFileSync(filename,"utf8")!==body)
      throw Error("Task lookup out of date. Run node scripts/author-flow/task-lookup.mjs");
    console.log("Task lookup matches source model and anticipated goals");
  }else{
    fs.writeFileSync(filename,body);
    console.log("Updated task lookup from repo contracts:",lookup.summary.total_tasks,"tasks");
  }
}

#!/usr/bin/env node
/**
 * One deterministic, repo-only lookup for anticipated Author tasks.
 * Input tasks are explicit hypotheses; graph is source-derived; no browser.
 * No test runner, no GitHub Actions, no application runtime.
 */
import fs from "node:fs";
import { buildSourceNavigationModel } from "./navigation-model.mjs";
// Operation keys are authored once with each goal in task-lookup.json.
// These markers are only source witnesses, not a separate experience audit.
const operationSources={
  "player-input": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "PLAYER ENTERS",
      "narrative.interaction"
    ]
  ],
  "response-text": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "responseText: value.text",
      "narrative.interaction"
    ],
    [
      "src/features/narrative/author/nodeWorkspace.tsx",
      "<AuthoredTextEditor",
      "narrative.node"
    ]
  ],
  "character-name": [
    [
      "src/features/world/author/entityWorkspaces.tsx",
      "id: \"world-entity-name\"",
      "world-entity"
    ]
  ],
  "speaker-reference": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "kind=\"character\"",
      "narrative.interaction"
    ],
    [
      "src/features/narrative/author/nodeWorkspace.tsx",
      "kind=\"character\"",
      "narrative.node"
    ]
  ],
  "image-art": [
    [
      "src/features/media/author/vectorAssetWorkspace.tsx",
      "paintVectorCell",
      "media-vector-asset"
    ]
  ],
  "variable-name": [
    [
      "src/features/state/author/workspaces.tsx",
      "label: \"Name\"",
      "state-variable"
    ]
  ],
  "character-alias": [
    [
      "src/features/world/author/entityWorkspaces.tsx",
      "world-character-alias",
      "world-entity"
    ]
  ],
  "response-condition": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "title=\"WHEN\"",
      "narrative.interaction"
    ]
  ],
  "response-effects": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "title=\"EFFECTS\"",
      "narrative.interaction"
    ]
  ],
  "input-capture": [
    [
      "src/features/narrative/author/NarrativeAfterEditor.tsx",
      "SAVE INPUT TO",
      "narrative.interaction"
    ]
  ],
  "text-mention": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "ValueMentionField",
      "narrative.interaction"
    ]
  ],
  "node-scene-media": [],
  "command-name": [
    [
      "src/features/commands/author/commandWorkspace.tsx",
      "label: \"Name\"",
      "commands-command"
    ]
  ],
  "character-portrait": [
    [
      "src/features/world/author/entityWorkspaces.tsx",
      "label: \"Portrait\"",
      "world-entity"
    ]
  ],
  "canonical-save": [
    [
      "src/author/ui/workspaceDefinition.tsx",
      "id: \"author-core-save\"",
      null
    ]
  ],
  "return-to-play": [
    [
      "src/author/workspace/AuthorWorkspaceHost.tsx",
      "aria-label=\"Close Author tasks and return to play\"",
      null
    ]
  ],
  "response-destination": [
    [
      "src/features/narrative/author/InteractionEditor.tsx",
      "title=\"AFTER\"",
      "narrative.interaction"
    ]
  ],
  "node-narration": [
    [
      "src/features/narrative/author/nodeWorkspace.tsx",
      "<AuthoredTextEditor",
      "narrative.node"
    ]
  ],
  "location-name": [
    [
      "src/features/world/author/entityWorkspaces.tsx",
      "id: \"world-entity-name\"",
      "world-entity"
    ]
  ],
  "location-description": [
    [
      "src/features/world/author/entityWorkspaces.tsx",
      "label: \"Description\"",
      "world-entity"
    ]
  ],
  "location-reference": [
    [
      "src/features/narrative/author/nodeWorkspace.tsx",
      "kind=\"location\"",
      "narrative.node"
    ]
  ],
  "item-name": [
    [
      "src/features/inventory/author/workspaces.tsx",
      "label: \"Name\"",
      "inventory-item"
    ]
  ],
  "item-image": [
    [
      "src/features/inventory/author/workspaces.tsx",
      "label: \"Image\"",
      "inventory-item"
    ]
  ],
  "node-entry-condition": [
    [
      "src/features/narrative/author/nodeWorkspace.tsx",
      "<OutcomeConditionEditor",
      "narrative.node"
    ]
  ],
  "synth-definition": [
    [
      "src/features/media/author/synthSoundWorkspace.tsx",
      "id: \"synth-label\"",
      "media-synth-sound"
    ]
  ],
  "sequence-sound-reference": [
    [
      "src/features/radix/author/workspaces.tsx",
      "kind: \"synth-sound\"",
      "radix-sequence"
    ]
  ],
  "sequence-definition": [
    [
      "src/features/radix/author/workspaces.tsx",
      "label: \"LABEL\"",
      "radix-sequence"
    ]
  ],
  "startup-sequence": [
    [
      "src/features/radix/author/startupWorkspace.tsx",
      "kind: \"radix-sequence\"",
      "radix-startup-settings"
    ]
  ]
};
function deriveOperationWitnesses(readFile) {
  return Object.fromEntries(Object.entries(operationSources).map(([key,variants])=>[key,variants.map(([file,needle,workspace])=>{
    const contents=readFile(file);
    const index=contents?.indexOf(needle)??-1;
    return {file,workspace,source_line:index<0?null:contents.slice(0,index).split("\n").length,
      status:index<0?"source-witness-unresolved":"source-witness-found"};
  })]));
}


/**
 * Identify contextual references rendered by canonical nested UI components.
 * This is source evidence with explicit unexecuted disclosure/adapter steps;
 * it is not a second editor, resource registry, or guessed runtime click path.
 */
function deriveDelegatedReferenceSites(model, readFile) {
  const known=new Map(model.resource_providers.map(p=>[p.kind,p]));
  const files={
    interaction:"src/features/narrative/author/InteractionEditor.tsx",
    interactionHost:"src/features/narrative/author/interactionWorkspace.tsx",
    node:"src/features/narrative/author/nodeWorkspace.tsx",
    outcome:"src/author/outcomes/OutcomeComposer.tsx",
    condition:"src/author/ConditionEditor.tsx",
    effects:"src/author/EffectsEditor.tsx",
    after:"src/features/narrative/author/NarrativeAfterEditor.tsx",
    world:"src/features/world/author/entityWorkspaces.tsx",
  };
  const fileSource=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,readFile(path)??""]));
  const registered=[
    ["state","src/features/state/author/manifest.tsx","src/features/state/author/ruleAdapters.tsx"],
    ["inventory","src/features/inventory/author/manifest.tsx","src/features/inventory/author/ruleAdapters.tsx"]
  ];
  const sites=[];
  const line=(file,needle)=>{
    const text=readFile(file)??"",i=text.indexOf(needle);
    return i<0?null:{file,line:text.slice(0,i).split("\n").length};
  };
  const insert=(workspace,kind,routeInfo)=>{
    const provider=known.get(kind);
    if(!provider?.create.route)return;
    sites.push({
      id:"delegated:"+workspace+":"+kind+":"+routeInfo.channel+":"+routeInfo.adapter,
      workspace,resource_kind:kind,create_route:provider.create.route,
      source:routeInfo.source,channel:routeInfo.channel,adapter:routeInfo.adapter,
      declaration_chain:routeInfo.declaration_chain,
      access_decisions:routeInfo.access_decisions,
      contingent:routeInfo.contingent,
      source_contract:"nested-owner-component-or-feature-adapter",
      physical_pointer_count:null
    });
  };
  const hostOkay=fileSource.interactionHost.includes("<InteractionComposer");
  const conditionRendering=fileSource.outcome.includes("<ConditionEditor")&&
    fileSource.condition.includes("conditionAuthorAdapter(condition.type)")&&
    fileSource.condition.includes("adapter?.render");
  const effectRendering=fileSource.outcome.includes("<EffectsEditor")&&
    fileSource.effects.includes("effectAuthorAdapters()")&&
    fileSource.effects.includes("adapter?.render");
  for(const [feature,manifestFile,adapterFile] of registered){
    const manifest=readFile(manifestFile)??"";
    const source=readFile(adapterFile)??"";
    const rx=/export const (\w+): (ConditionAuthorAdapter|EffectAuthorAdapter) = \{/g;
    const matches=[...source.matchAll(rx)];
    for(let i=0;i<matches.length;i++){
      const m=matches[i],end=matches[i+1]?.index??source.length;
      const block=source.slice(m.index,end);
      if(!manifest.includes(m[1]))continue;
      const channel=m[2]==="ConditionAuthorAdapter"?"condition":"effect";
      if(channel==="condition"&&!conditionRendering||channel==="effect"&&!effectRendering)continue;
      const type=block.match(/\btype:\s*["']([^"']+)["']/)?.[1]??m[1];
      const fieldRx=/<ReferenceField\s+kind=["']([^"']+)["']/g;
      for(const field of block.matchAll(fieldRx)){
        const kind=field[1];
        const sourceLocation={file:adapterFile,line:source.slice(0,m.index+field.index).split("\n").length};
        for(const workspace of ["narrative.interaction","narrative.node",...(channel==="condition"&&fileSource.world.includes("world-character-alias-rules")&&fileSource.world.includes("<ConditionEditor")?["world-entity"]:[])]){
          const host=workspace==="narrative.interaction"?fileSource.interaction:workspace==="world-entity"?fileSource.world:fileSource.node;
          if(workspace==="narrative.interaction"&&!hostOkay)continue;
          const outer=channel==="condition"?"<OutcomeConditionEditor":"<OutcomeEffectsEditor";
          const hasOuter=workspace==="world-entity"?host.includes("<ConditionEditor"):
            channel==="effect"&&workspace==="narrative.node"?host.includes("<EffectsEditor"):host.includes(outer);
          if(!hasOuter)continue;
          insert(workspace,kind,{
            channel,adapter:type,source:sourceLocation,
            declaration_chain:[
              {file:workspace==="world-entity"?files.world:workspace==="narrative.node"?files.node:files.interaction,component:workspace==="world-entity"?"Character alias ConditionEditor":outer},
              {file:files.outcome,component:channel==="condition"?"ConditionEditor":"EffectsEditor"},
              {file:channel==="condition"?files.condition:files.effects,component:"registered feature-owned "+channel+" adapter"},
              {file:adapterFile,component:m[1]+" ReferenceField"},
              {file:manifestFile,component:feature+" feature registry"}
            ],
            access_decisions:channel==="condition"
              ? ["Open the appropriate WHEN/condition section","Choose "+type+" condition type","Use the canonical "+kind+" reference field"]
              : ["Open the appropriate EFFECTS section","Choose Add Effect","Choose "+type+" effect type","Use the canonical "+kind+" reference field"],
            contingent:["response/entry editor is visible","section is expanded","adapter type is selected",
              ...(workspace==="world-entity"?["resource is a Character, not a Location","Character has at least one alias","alias SHOW WHEN is configured"]:[]),
              ...(block.includes('scope === "node"')?["global scope selected; node-local flags do not require a project resource"]:[])],
          });
        }
      }
    }
  }
  // The capture sequence is built inside the existing NarrativeAfterEditor.
  // It is not a separately routed resource owner.
  const after=fileSource.after;
  if(after.includes("<CaptureFlowEditor")&&after.includes('kind="text-variable"')){
    for(const workspace of ["narrative.interaction","narrative.node"]){
      const host=workspace==="narrative.interaction"?fileSource.interaction:fileSource.node;
      if(workspace==="narrative.interaction"&&!hostOkay)continue;
      if(!host.includes("<NarrativeAfterEditor"))continue;
      insert(workspace,"text-variable",{
        channel:"capture",adapter:"CaptureFlowEditor",source:line(files.after,'kind="text-variable"'),
        declaration_chain:[{file:workspace==="narrative.node"?files.node:files.interaction,component:"NarrativeAfterEditor"},
          {file:files.after,component:"CaptureFlowEditor"},{file:files.after,component:'ReferenceField kind="text-variable"'}],
        access_decisions:["Open AFTER","Choose CAPTURE INPUT","Use SAVE INPUT TO reference"],
        contingent:["capture flow selected","capture editor displayed"]
      });
    }
  }
  // Both Interaction and Node opening editors use the same NarrativeAfterEditor
  // canonical Create New destination action, which invokes the provided
  // createDestination task callback instead of a ReferenceField.
  if(fileSource.after.includes('label: "CREATE NEW"')&&
    fileSource.node.includes("const createDestination")&&
    fileSource.node.includes('resourceTask: "node"')&&
    fileSource.node.includes("onCreateDestination={createDestination}")&&
    fileSource.node.includes("<NarrativeAfterEditor")){
    insert("narrative.node","node",{
      channel:"destination",adapter:"NarrativeAfterEditor",source:line(files.node,"const createDestination"),
      declaration_chain:[{file:files.node,component:"OpeningEditor and createDestination callback"},
        {file:files.after,component:"NarrativeAfterEditor CREATE NEW"},
        {file:files.node,component:"canonical node resource task push"}],
      access_decisions:["Open Node entry response AFTER","Choose CREATE NEW"],
      contingent:["Node opening editor is displayed"],
    });
  }
  return sites.sort((a,b)=>a.workspace.localeCompare(b.workspace)||a.resource_kind.localeCompare(b.resource_kind)||a.id.localeCompare(b.id));
}

/** Read the concrete workspace matcher, not merely its shared feature route. */
function matchWorkspaceForResource(model,route,kind,readFile) {
  const candidates=model.workspace_route_bindings.filter(b=>b.from===route);
  if(candidates.length<=1)return candidates;
  const accepts=b=>{
    const source=readFile(b.source.file);
    if(!source)return false;
    const start=source.split("\n").slice(b.source.line-1).join("\n");
    const match=start.match(/matches:\s*\(route\)\s*=>[\s\S]{0,390}?(?=,\s*createDraft:)/);
    if(!match)return false;
    const predicate=match[0];
    const inclusion=predicate.match(/\[([^\]]+)\]\.includes\(route\.data\?\.resourceKind/);
    if(inclusion)return [...inclusion[1].matchAll(/["']([^"']+)["']/g)].some(x=>x[1]===kind);
    const direct=predicate.match(/route\.data\?\.resourceKind\s*===\s*["']([^"']+)["']/);
    if(direct)return direct[1]===kind;
    return !predicate.includes("route.data?.resourceKind")&&candidates.length===1;
  };
  return candidates.filter(accepts);
}

function buildLookup(model,definitions,operationWitnesses,readFile){
  if(model.schema_version<3)throw Error("Require navigation model schema 3");
  if(definitions.schema_version!==1)throw Error("Unsupported anticipated-task schema");
  const required=[
    "push-preserves-stack","completion-pops-child","completion-sends-result","resource-create-pushes-owner",
    "resource-callback-checks-kind","reference-field-adopts-child","accepted-save-required",
    "accepted-child-save-completes","save-control-requires-dirty-valid","master-x-invokes-request-close"
  ];
  const missingShared=required.filter(id=>model.task_lifecycle.contracts.find(c=>c.id===id)?.status!=="source-declared");
  const providerByKind=new Map(model.resource_providers.map(p=>[p.kind,p]));
  const delegated=deriveDelegatedReferenceSites(model,readFile);
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
      const operation=step.action;
      const directReferences=model.reference_sites.filter(s=>"workspace:"+s.workspace===cursor&&s.resource_kind===step.kind);
      const indirectReferences=operation==="create"?delegated.filter(s=>"workspace:"+s.workspace===cursor&&s.resource_kind===step.kind):[];
      const matching=[...directReferences,...indirectReferences];
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
        entry_source_type:indirectReferences.length?"delegated-resource-or-rule-control":directTask?"explicit-resource-task-handler":"canonical-reference-field",
        evidence:directTask?[directTask.id]:matching.map(m=>m.id),
        source_direct_handler:directTask?.source??null,
        delegated_paths:indirectReferences.map(ref=>({
          channel:ref.channel,adapter:ref.adapter,access_decisions:ref.access_decisions,
          contingent:ref.contingent,declaration_chain:ref.declaration_chain,source:ref.source
        })),
        source_access_decision_range:indirectReferences.length?{
          min:Math.min(...indirectReferences.map(x=>x.access_decisions.length)),
          max:Math.max(...indirectReferences.map(x=>x.access_decisions.length)),
          metric:"declared decision descriptions, NOT clicks",
          alternatives:indirectReferences.length
        }:null};
      if(!provider)result.blockers.push("resource-kind-not-in-canonical-provider-registry");
      if(!routeKey)result.blockers.push("canonical-"+operation+"-route-not-resolved");
      // Different adapters may lead to the same canonical resource owner.
      // They are alternative contextual routes, not an ambiguity that blocks creation.
      const compatible=matching.every(ref=>ref.create_route===provider?.create.route);
      if(!matching.length&&!directTask)result.blockers.push("no-reference-field-or-resource-task-handler-declared-in-current-workspace");
      if(matching.length>0&&!compatible)result.blockers.push("reference-fields-disagree-on-canonical-create-route");
      if(directTasks.length>1&&!directTask&&!matching.length)result.blockers.push("ambiguous-resource-task-handlers");
      if(operation==="create"&&matching.length===1&&matching[0].create_route!==provider?.create.route)
        result.blockers.push("reference-field-not-bound-to-provider-create-route");
      if(operation==="edit" && !provider?.edit.declared)result.blockers.push("canonical-edit-not-declared");
      if(!["create","edit"].includes(operation))result.blockers.push("unsupported-task-operation");
      const bindings=routeKey?matchWorkspaceForResource(model,routeKey,step.kind,readFile):[];
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
      if(indirectReferences.length){
        result.controls=null;
        result.contract_status="conditional-delegated-contextual-route-declared";
      }else if(directTask){
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
    const availableWorkspaces=new Set([task.start.workspace,...frames.map(f=>f.child.replace(/^workspace:/,""))]);
    const operationSteps=(task.requested_operations??[]).map(({description,operation})=>{
      const found=(operationWitnesses[operation]??[]).filter(x=>x.status==="source-witness-found");
      const inContext=found.filter(x=>x.workspace===null||availableWorkspaces.has(x.workspace));
      return {intent:description,operation,source_evidence:found,
        status:!found.length?"source-witness-unresolved":!inContext.length?"owner-not-reached-by-declared-task-path":"owner-control-declared-in-task-context",
        exact_actions:null,note:"A source control witness does not prove a complete configuration or a visible UI."};
    });
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
    for(const op of operationSteps.filter(x=>x.status!=="owner-control-declared-in-task-context"))
      unresolved.push({category:"authoring-operation-source-gap",operation:op.operation,reason:op.status});
    const status=!nestedSourceResolved?"missing-source-link":!task.resource_chain.length?"workspace-task-without-nested-route":
      trace.some(x=>x.delegated_paths.length)?"delegated-contextual-route-source-declared":
      trace.some(x=>x.entry_source_type==="explicit-resource-task-handler")?"resource-task-handler-source-declared":"contextual-route-source-declared";
    if(!nestedSourceResolved)flags.push("contextual-task-path-unresolved");
    if(crossFeature)flags.push("cross-owner-authoring");
    if(frames.length>1)flags.push("deep-contextual-nesting");
    if(conditionalPickerCount)flags.push("resource-chooser-branch");
    if(trace.some(x=>x.entry_source_type==="explicit-resource-task-handler"))flags.push("direct-custom-resource-task-activation-unknown");
    if(trace.some(x=>x.delegated_paths.length))flags.push("nested-rule-editor-decisions");
    if(task.author_work.length)flags.push("authoring-controls-not-modeled");
    items.push({
      task_id:task.id,game:task.game,goal:task.goal,
      starting_workspace:task.start.workspace,
      origin_assumption:task.start,
      definition:task,
      intended_author_work:task.author_work,
      operation_steps:operationSteps,
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
        source_declared_pre_reference_decisions:trace.some(t=>t.source_access_decision_range)?{
          lower:trace.reduce((n,t)=>n+(t.source_access_decision_range?.min??0),0),
          upper:trace.reduce((n,t)=>n+(t.source_access_decision_range?.max??0),0),
          metric:"source-described decisions across nested UI layers, not physical clicks",
          caveat:"Some steps are contingent; only the selected alternative is traversed, and entry-to-workspace steps are excluded."
        }:null,
        alternative_delegated_paths:trace.reduce((n,t)=>n+Math.max(0,t.delegated_paths.length-1),0),
        conditional_delegated_paths:trace.flatMap(t=>t.delegated_paths.map(p=>({
          resource:t.resource_kind,channel:p.channel,adapter:p.adapter,decision_sequence:p.access_decisions,guards:p.contingent
        }))),
        conditional_control_subtotal:knownControls,
        operation_controls_found_in_context:operationSteps.filter(x=>x.status==="owner-control-declared-in-task-context").length,
        operation_controls_without_context:operationSteps.filter(x=>x.status!=="owner-control-declared-in-task-context").length,
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
      operation_witnesses_in_context:ts.reduce((n,t)=>n+t.measures.operation_controls_found_in_context,0),
      operation_witnesses_unresolved:ts.reduce((n,t)=>n+t.measures.operation_controls_without_context,0),
      top_static_gaps:unresolved.map(t=>({task_id:t.task_id,missing:t.route_steps.filter(s=>s.blockers.length).map(s=>({kind:s.resource_kind,at:s.from,reason:s.blockers}))}))};
  });
  return {
    schema_version:2,type:"source-derived-anticipated-task-lookup",
    generated_from:{source_inventory:"audit/author-flow/source-graph.json",compiler:"scripts/author-flow/task-lookup.mjs"},
    interpretation:{
      authority:"This is the single authoritative current Author task-evaluation artifact. Both imagined goals and source-derived results live together.",
      operational_evidence:"Source control witnesses prove declarations, not rendered interactions, completed configuration, or Save.",
      task_catalog:"Goals are explicit hypothetical author tasks for two game genres, not observed behavior",
      graph:"Routes and source-owner ownership come from the canonical source-derived navigation model",
      cost:"Only source-declared controls are counted. Conditional subtotals are NOT end-to-end costs, actual required clicks, subjective UX scores, or global minima.",
      unknown:"Absence of a captured static reference is not proof that the task is impossible, and unknown steps are not assigned artificial costs",
      focus:"Find misplaced/absent contextual routes and unexplained switches; context preservation is a separate contract, not a click minimization objective",
      delegated:"Rules and flows are composed from canonical Condition/Effects/NarrativeAfter components and feature-adapter registrations. Source-described decision stages are not physical clicks and depend on conditions and chosen adapter."
    },
    summary:{total_tasks:items.length,
      task_operation_witnesses_found:items.reduce((n,t)=>n+t.measures.operation_controls_found_in_context,0),
      task_operation_witnesses_unresolved:items.reduce((n,t)=>n+t.measures.operation_controls_without_context,0),
      resolved_nested_resource_routes:items.filter(x=>x.declared_path_complete&&x.measures.declared_resource_tasks>0).length,
      tasks_without_nested_resource_route:items.filter(x=>x.measures.declared_resource_tasks===0).length,
      unresolved_nested_resource_routes:items.filter(x=>!x.declared_path_complete).length,games},
    tasks:items
  };
}
const filename="audit/author-flow/task-lookup.json";
const previous=JSON.parse(fs.readFileSync(filename,"utf8"));
const goals={schema_version:1,tasks:previous.tasks.map(row=>row.definition)};
const model=buildSourceNavigationModel();
const witnesses=deriveOperationWitnesses(file=>fs.existsSync(file)?fs.readFileSync(file,"utf8"):null);
const lookup=buildLookup(model,goals,witnesses,file=>fs.existsSync(file)?fs.readFileSync(file,"utf8"):null);
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
      && JSON.stringify(beforeCost)===JSON.stringify(afterCost)
      && JSON.stringify(before.operation_steps?.map(x=>x.status)??[])===JSON.stringify(after.operation_steps?.map(x=>x.status)??[]))continue;
    changes.push({task_id:id,before:before.source_path_status,after:after.source_path_status,
      route_resolved:!before.declared_path_complete&&after.declared_path_complete,
      route_became_unresolved:before.declared_path_complete&&!after.declared_path_complete,
      conditional_controls_before:beforeCost,conditional_controls_after:afterCost,
      operation_witnesses_in_context_before:before.measures?.operation_controls_found_in_context??null,
      operation_witnesses_in_context_after:after.measures?.operation_controls_found_in_context??null,
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
    gaps:lookup.tasks.filter(x=>!x.declared_path_complete||x.measures.operation_controls_without_context>0).map(t=>({
      task_id:t.task_id,game:t.game,goal:t.goal,
      missing_route:t.unmodeled_or_unresolved.find(x=>x.category==="missing-static-navigation")??null,
      operation_gaps:t.operation_steps.filter(x=>x.status!=="owner-control-declared-in-task-context")
        .map(x=>({intent:x.intent,operation:x.operation,reason:x.status}))
    }))
  },null,2)+"\n");
}else if(args.includes("--summary")){
  process.stdout.write(JSON.stringify(lookup.summary,null,2)+"\n");
}else{
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

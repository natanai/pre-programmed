#!/usr/bin/env node
/**
 * Bounded, deterministic browser traversal of the REAL Author UI.
 * Branches are replayed in new browser contexts against the same disposable local D1 fixture.
 * Persistent mutations are *never* clicked: they remain explicit frontier records.
 * No inferred author intentions, imagined destinations, or simulated UI states.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const origin = "http://127.0.0.1:5173";
const dataDir = ".wrangler/author-flow-audit";
const outputDir = "audit/author-flow/traces";
const recorderPath = path.resolve("scripts/author-flow/browser-recorder.js");
const desktop = { id: "desktop", width: 1280, height: 800 };
const mobile = { id: "mobile", width: 390, height: 844 };
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}
function number(name, fallback) {
  const value = Number(arg(name, fallback));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(name + " must be a positive integer.");
  return value;
}
const maxStates = number("--max-states", 65);
const maxDepth = number("--max-depth", 4);
const maxExecutions = number("--max-executions", 90);
const enableScroll=args.includes("--scroll");
const captureWrites=args.includes("--writes");
const captureDraftNavigation=args.includes("--draft-navigation");
const resumeFrom=arg("--resume-from",null);
if(resumeFrom && !/^[a-z][a-z0-9-]{0,24}$/.test(resumeFrom))throw Error("--resume-from must name an existing recorded suite.");
if(resumeFrom&&(captureWrites||captureDraftNavigation))throw Error("--resume-from requires ordinary safe browser exploration.");
if(captureWrites&&captureDraftNavigation)throw Error("Choose only one targeted audit mode.");
const strategy = arg("--strategy", "breadth");
if (!["breadth","stratified"].includes(strategy)) throw Error("--strategy must be breadth or stratified");
const suite = arg("--suite", "baseline");
if (!/^[a-z][a-z0-9-]{0,24}$/.test(suite)) throw Error("--suite must be a short lowercase identifier");
const selected = arg("--viewport", "both");
if (!["both", "desktop", "mobile"].includes(selected)) throw new Error("--viewport must be both, desktop or mobile.");
const viewports = selected === "both" ? [desktop, mobile] : [selected === "mobile" ? mobile : desktop];
const pageTimeout = number("--page-timeout-ms", 20_000);
const SHA = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
async function requireExclusiveLocalPorts() {
  const {createServer} = await import("node:net");
  for (const port of [5173,8787]) {
    await new Promise((resolve,reject)=>{
      const probe=createServer();
      probe.once("error",error=>reject(new Error("Author audit refused to start: 127.0.0.1:"+port+" is occupied ("+error.code+"). Stop other local clients first.")));
      probe.listen({host:"127.0.0.1",port,exclusive:true},()=>probe.close(resolve));
    });
  }
}
let server = null;

async function request(uri, options) {
  const response = await fetch(origin + uri, options);
  if (!response.ok) throw new Error(uri + " (" + response.status + "): " + (await response.text()).slice(0,400));
  return response.json();
}
async function startLocal({reset=false}={}) {
  if(reset) await rm(dataDir, {recursive:true,force:true});
  server = spawn(process.execPath, ["scripts/run-local.mjs"], {
    stdio: "inherit",
    env: {...process.env, PRE_PROGRAMMED_LOCAL_DATA_DIR:dataDir},
    detached:process.platform!=="win32",
  });
  server.once("exit", (code) => { if (code && !closing) console.error("Audit local runtime exited:", code); });
  for (let tries=0; tries<75; tries++) {
    try {
      const health=await request("/api/health");
      if (health.ok && health.persistence==="d1") return;
    } catch {}
    await new Promise(r=>setTimeout(r,450));
  }
  throw new Error("Isolated Author local D1 server was not ready.");
}
let closing = false;
async function stopServer() {
  const child=server;
  server=null;
  if(!child)return;
  if(child.exitCode===null) {
    if(process.platform==="win32") {
      spawnSync("taskkill",["/pid",String(child.pid),"/T","/F"],{stdio:"ignore"});
    }else{
      try{process.kill(-child.pid,"SIGTERM");}catch{try{child.kill("SIGTERM");}catch{}}
    }
    await Promise.race([once(child,"exit"),new Promise(r=>setTimeout(r,3500))]);
  }
}
async function startFreshDisposable() {
  await stopServer();
  for(let attempt=0;attempt<30;attempt++){
    try{
      await requireExclusiveLocalPorts();
      await startLocal({reset:true});
      return;
    }catch(error){
      if(attempt===29)throw error;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
  }
}
async function restartLocal(expectedHash) {
  await stopServer();
  let available=false;
  for(let attempt=0;attempt<20;attempt++){
    try{await requireExclusiveLocalPorts();available=true;break;}catch(error){
      if(attempt===19)throw error;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
  }
  if(!available)throw Error("Isolated local ports did not become available for restart.");
  await startLocal();
  const snapshot=await request("/api/project/snapshot");
  if(SHA(snapshot)!==expectedHash)throw Error("Disposable project fixture changed during local server restart; cannot combine observations.");
}
async function stopLocal() {
  closing=true;
  await stopServer();
  await rm(dataDir,{recursive:true,force:true});
}
const performance = {charactersPerSecond:18,cues:[]};
async function seedFixture() {
  const initial=await request("/api/project/snapshot");
  const login=await request("/api/author/login", {
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({key:"local"}),
  });
  if(!login.token)throw new Error("No local Author token.");
  const nodeId=initial.startNodeId;
  const operations=[
    {type:"entity.upsert",entity:{
      id:"audit-character",key:"audit_character",type:"character",name:"Mysterious Voice",
      aliases:[{name:"Known Voice",condition:{type:"flag",key:"hasasked",value:true}}],
      startingNameSelection:"first",description:"Disposable audit Character",tags:[],interactable:true,operations:[],hooks:[],
    }},
    {type:"entity.upsert",entity:{
      id:"audit-location",key:"audit_location",type:"location",name:"Audit Room",
      aliases:[],startingNameSelection:"first",description:"Disposable audit Location",tags:[],interactable:true,operations:[],hooks:[],
    }},
    {type:"variable.upsert",definition:{
      id:"audit-flag",key:"hasasked",label:"Has asked",valueType:"boolean",initialValue:false,
      playerPresentation:null,interactable:false,operations:[],hooks:[],timeRate:0,timeUnit:"second",
    }},
    {type:"variable.upsert",definition:{
      id:"audit-number",key:"trust",label:"Trust",valueType:"number",initialValue:0,
      playerPresentation:null,interactable:false,operations:[],hooks:[],timeRate:0,timeUnit:"second",
    }},
    {type:"stateGroup.upsert",group:{id:"audit-status",label:"Audit status",order:0,visibleWhen:{type:"always"}}},
    {type:"interaction.upsert",interaction:{
      id:"audit-input",sourceNodeId:nodeId,wording:"who are you?",matchMode:"command",
      order:0,choiceVisibility:"immediate",choiceVisibleWhen:{type:"always"},
      outcomeSelection:"first",aliases:["who are you?"],tags:[],notes:"",
      outcomes:[{
        id:"audit-response",order:0,label:"default",authorStatus:"configured",
        condition:{type:"always"},responseText:"I am a voice.",dialogueText:"",
        speakerId:"audit-character",responsePerformance:performance,dialoguePerformance:performance,
        effects:[],after:[],
      }],
    }},
  ];
  const response=await request("/api/author/mutate",{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+login.token},
    body:JSON.stringify({expectedRevision:initial.revision,description:"Build disposable browser flow audit fixture",operations}),
  });
  if(!response.snapshot?.entities?.some(x=>x.id==="audit-character"))throw new Error("Audit character fixture missing after mutation.");
  if(!response.snapshot?.interactions?.some(x=>x.id==="audit-input"))throw new Error("Audit input fixture missing after mutation.");
  return {snapshot:response.snapshot,token:login.token,nodeId};
}
function quote(value) { return '"' + value.replaceAll("\\","\\\\").replaceAll('"','\\"') + '"'; }
function selectorFor(locator) { return "[data-author-flow-probe=" + quote(locator) + "]"; }
const unsafe = /\b(SAVE|DELETE|RESET|BACKUP|IMPORT|EXPORT|APPLY|REMOVE|DISCARD|CLEAR ALL|START NEW|NEW GAME|LOAD|UNDO|REORDER|ADD TO RUN|RESTORE)\b/i;
function actionDomain(state) {
  const actions=[], frontier=[];
  const seen=new Set();
  for(const control of state.ui.visible_controls) {
    if(!control.enabled)continue;
    const base={locator:control.locator};
    if(["input","textarea"].includes(control.kind) && typeof control.value==="string") {
      frontier.push({state:state.id,locator:control.locator,reason:"unbounded-input"});
      continue;
    }
    if(control.kind==="a") {
      frontier.push({state:state.id,locator:control.locator,reason:"async-external"});
      continue;
    }
    if(unsafe.test(control.label)) {
      frontier.push({state:state.id,locator:control.locator,reason:"unsafe-mutation",action:{...base,event:"click",value:null,pointer_activations:1}});
      continue;
    }
    if(control.kind==="select") {
      for(const option of control.options) {
        if(!option.enabled||option.value===control.value)continue;
        actions.push({...base,event:"change",value:option.value,pointer_activations:0});
      }
    } else if(["button","summary"].includes(control.kind)) {
      actions.push({...base,event:"click",value:null,pointer_activations:1});
    } else if(control.kind==="input" && typeof control.value==="boolean") {
      actions.push({...base,event:"toggle",value:!control.value,pointer_activations:1});
    }
  }
  if(enableScroll)for(const region of state.ui.scrollable_regions??[]) {
    const step=Math.max(48,Math.round(region.client_height*.7));
    const remaining=region.max_top-region.top;
    if(remaining>2)actions.push({locator:region.locator,event:"scroll",value:Math.min(step,remaining),pointer_activations:0});
    if(region.top>2)actions.push({locator:region.locator,event:"scroll",value:-Math.min(step,region.top),pointer_activations:0});
  }
  const unique=actions.filter(a=>{
    const key=JSON.stringify(a);if(seen.has(key))return false;seen.add(key);return true;
  });
  return {actions:unique,frontier};
}
async function settle(page) {
  let last="",same=0;
  for(let i=0;i<16;i++){
    await page.waitForTimeout(75);
    const id=await page.evaluate(()=>window.__authorFlowAudit.snapshot().id);
    if(id===last)same++;else same=0;
    if(same>=2)break;
    last=id;
  }
}
async function perform(page,action) {
  if(action.event==="fill") {
    const target=page.locator(selectorFor(action.locator));
    if(await target.count()!==1)throw Error("Missing or ambiguous text input: "+action.locator);
    await target.fill(action.value,{timeout:4000});
    await settle(page);
    return;
  }
  if(action.event==="scroll") {
    const region=page.locator("[data-author-flow-scroll-probe="+quote(action.locator)+"]");
    if(await region.count()!==1)throw Error("Missing or ambiguous scroll region: "+action.locator);
    const rect=await region.boundingBox();
    if(!rect)throw Error("Scroll region has no visible bounds: "+action.locator);
    const x=Math.min(page.viewportSize().width-2,Math.max(1,rect.x+rect.width/2));
    const y=Math.min(page.viewportSize().height-2,Math.max(1,rect.y+rect.height/2));
    await page.mouse.move(x,y);
    await page.mouse.wheel(0,action.value);
    await settle(page);
    return;
  }
  const probe=page.locator(selectorFor(action.locator));
  if(await probe.count()!==1) throw new Error("Nonunique or missing probe: "+action.locator);
  if(action.event==="change")await probe.selectOption(action.value,{timeout:4000});
  else if(action.event==="toggle")await probe.setChecked(action.value,{timeout:4000});
  else await probe.click({timeout:4000});
  await settle(page);
}
async function newPage(browser, fixture, token) {
  const context=await browser.newContext({
    viewport:{width:fixture.viewport.width,height:fixture.viewport.height},
    ...(fixture.id.includes("-mobile") ? {isMobile:true,hasTouch:true,deviceScaleFactor:2} : {}),
    reducedMotion:"reduce",
    serviceWorkers:"block",
  });
  try {
  await context.addInitScript(value=>sessionStorage.setItem("pre-programmed:author-token",value),token);
  await context.addInitScript({path:recorderPath});
  const page=await context.newPage();
  page.setDefaultTimeout(pageTimeout);
  await page.goto(origin,{waitUntil:"domcontentloaded"});
  const bootstrap=page.locator(".universe-bootstrap-action");
  await bootstrap.waitFor({state:"visible",timeout:pageTimeout});
  await bootstrap.click();
  await page.locator(".author-home").waitFor({state:"visible",timeout:pageTimeout});
  await page.evaluate(fixture=>window.__authorFlowAudit.start(fixture),fixture);
  await settle(page);
  return {page,context};
  } catch(error) {
    await context.close();
    throw error;
  }
}
/**
 * Queue only *recorded* unvisited actions from an earlier compatible fixture.
 * A prior UI state does not certify current behavior: each full prefix must
 * execute again in the real browser. Missing replay prefixes stay unknown.
 */
function pendingFrontierPaths(viewport, fixtureHash) {
  const filename=path.join(outputDir,"author-audit-"+viewport.id+"-"+resumeFrom+".json");
  const prior=JSON.parse(fs.readFileSync(filename,"utf8"));
  const sourceFixture=prior.fixtures?.[0];
  if(prior.provenance?.runtime_executed!==true || sourceFixture?.project_sha256!==fixtureHash)
    throw Error("Prior frontier has incompatible executed provenance or project fixture: "+filename);
  if(sourceFixture.viewport?.width!==viewport.width||sourceFixture.viewport?.height!==viewport.height)
    throw Error("Prior frontier viewport differs: "+filename);
  if(!Array.isArray(prior.replays))throw Error("Prior frontier has no contiguous replay evidence");
  const prefixes=new Map();
  const put=(state,actions)=>{
    const current=prefixes.get(state);
    if(!current || actions.length<current.length ||
      (actions.length===current.length&&JSON.stringify(actions)<JSON.stringify(current)))
      prefixes.set(state,actions);
  };
  for(const replay of prior.replays){
    if(replay.completed!==true || !Array.isArray(replay.steps))continue;
    let current=replay.initial_state, actions=[];
    put(current,actions);
    for(const step of replay.steps){
      if(step.from!==current)throw Error("Noncontiguous prior replay: "+replay.id);
      actions=[...actions,step.action];
      current=step.to;
      put(current,actions);
    }
  }
  const candidates=new Map();
  let lackingPrefix=0;
  for(const entry of prior.frontier){
    if(entry.reason!=="unvisited"||!entry.action)continue;
    const prefix=prefixes.get(entry.state);
    if(!prefix){lackingPrefix++;continue;}
    const actions=[...prefix,entry.action];
    if(actions.length>maxDepth)continue;
    const key=JSON.stringify([entry.state,entry.action]);
    if(!candidates.has(key))candidates.set(key,{path:actions,from:entry.state});
  }
  const queue=[...candidates.values()].sort((a,b)=>a.path.length-b.path.length||JSON.stringify(a.path).localeCompare(JSON.stringify(b.path)));
  if(queue.length===0)throw Error("No replay-certified unvisited actions within max-depth for "+filename);
  console.log("Replaying prior observed frontier",{
    source:filename,source_entries:prior.frontier.length,replayable:queue.length,
    lacks_replay_prefix:lackingPrefix,max_depth:maxDepth
  });
  return queue;
}
async function traverse(browser, fixture, token, expectedHash, initialQueue=null) {
  const states=new Map(),transitions=new Map(),frontier=new Map(),replays=[];
  let initialStateId=null;
  const queue=initialQueue??[{path:[],from:null}];const visited=new Set();let replayFailures=0;let executedPaths=0;
  const servedFirst=new Map(),servedSecond=new Map();
  function dequeue() {
    if(strategy==="breadth" || queue.length<2) return queue.shift();
    // Fairness depends only on the literal interaction sequence, never on presumed author goals.
    // Every first-hop branch gets equal opportunities; within it, balance second-hop branches.
    const firstKey=item=>item.path[0] ? JSON.stringify(item.path[0]) : "__root__";
    const secondKey=item=>JSON.stringify(item.path.slice(0,2));
    let best=0,score=null;
    for(let i=0;i<queue.length;i++) {
      const candidate=queue[i];
      const next=[servedFirst.get(firstKey(candidate))??0,servedSecond.get(secondKey(candidate))??0,candidate.path.length,i];
      if(!score||next.some((value,k)=>value<score[k]&&next.slice(0,k).every((prior,j)=>prior===score[j]))) {
        best=i;score=next;
      }
    }
    const [chosen]=queue.splice(best,1);
    const first=firstKey(chosen),second=secondKey(chosen);
    servedFirst.set(first,(servedFirst.get(first)??0)+1);
    servedSecond.set(second,(servedSecond.get(second)??0)+1);
    return chosen;
  }
  const note=(entry)=>frontier.set(JSON.stringify(entry),entry);
  const addState=(state)=>{if(!states.has(state.id))states.set(state.id,state);};
  while(queue.length && visited.size < maxStates && executedPaths < maxExecutions) {
    executedPaths++;
    if(executedPaths>1 && (executedPaths-1)%10===0) await restartLocal(expectedHash);
    const next=dequeue();
    const path=next.path;
    let page=null,context=null;
    let lastObserved=null;
    const replaySteps=[];
    let replayInitialId=null;
    try {
      ({page,context}=await newPage(browser,fixture,token));
      let state=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
      if(!initialStateId) initialStateId=state.id;
      replayInitialId=state.id;
      lastObserved=state;
      addState(state);
      for(const action of path){
        const before=state;
        await perform(page,action);
        state=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
        lastObserved=state;
        addState(state);
        const id=SHA([fixture.id,before.id,action,state.id]).slice(0,20);
        transitions.set(id,{id:"transition:"+id,fixture:fixture.id,from:before.id,to:state.id,action,observed:true});
        replaySteps.push({from:before.id,to:state.id,action});
      }
      replays.push({id:"replay:"+SHA([fixture.id,path]).slice(0,20),fixture:fixture.id,initial_state:replayInitialId,steps:replaySteps,completed:true});
      if(visited.has(state.id))continue;
      visited.add(state.id);
      const choices=actionDomain(state);
      for(const entry of choices.frontier)note(entry);
      if(path.length>=maxDepth) {
        for(const action of choices.actions)note({state:state.id,locator:action.locator,reason:"unvisited",action});
        continue;
      }
      for(const action of choices.actions) {
        // Identical paths are replayable using native pointer events only.
        queue.push({path:[...path,action],from:state.id});
      }
      if(visited.size%10===0)console.log(fixture.id+": "+visited.size+" unique UI states; "+queue.length+" queued paths");
    } catch(error) {
      replayFailures++;
      note({state:lastObserved?.id??next.from??states.values().next().value?.id??"state:unavailable",locator:path.at(-1)?.locator??"runtime",reason:"unknown",...(path.at(-1)?{action:path.at(-1)}:{})});
      console.error("Branch failed:",fixture.id,path.map(x=>x.locator).join(" -> "),String(error).slice(0,220));
      let healthy=false;
      try { const status=await request("/api/health");healthy=status.ok===true&&status.persistence==="d1"; } catch {}
      if(!healthy) await restartLocal(expectedHash);
    } finally {
      await context?.close();
    }
  }
  if(queue.length) {
    // Record budget-limited branches as an explicit unexplored frontier.
    for(const remaining of queue) {
      // Prior source-frontier origins were not necessarily reached again.
      // Their original unvisited records remain in the immutable source trace;
      // never introduce unobserved source state IDs into this new trace.
      if(!remaining.from || !states.has(remaining.from))continue;
      note({state:remaining.from,locator:remaining.path.at(-1)?.locator??"unknown",...(remaining.path.at(-1)?{action:remaining.path.at(-1)}:{}),reason:"unvisited"});
    }
  }
  return {
    states:[...states.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    transitions:[...transitions.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    frontier:[...frontier.values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
    replays:replays.sort((a,b)=>a.id.localeCompare(b.id)),
    initialStateId,
    stats:{strategy,visited:visited.size,executed_paths:executedPaths,queue_remaining:queue.length,replay_failures:replayFailures},
  };
}
const writeDomains=[
  {id:"ascii",value:"Audit text alpha."},
  {id:"punctuation",value:"Line two: punctuation?! (audit)"},
  {id:"empty",value:""},
];
async function captureWrite(browser,viewport,test) {
  // One independently bootstrapped disposable D1 project per value/viewport.
  await startFreshDisposable();
  const {snapshot,token,nodeId}=await seedFixture();
  const before=await request("/api/project/snapshot");
  const initialText=before.nodes.find(node=>node.id===nodeId)?.openings?.[0]?.narrationText;
  if(typeof initialText!=="string"||initialText===test.value)throw Error("Unexpected initial narration fixture.");
  const fixture={
    id:"author-audit-"+viewport.id+"-write-"+test.id,
    project_fixture:"isolated-local-d1-write-v1",
    project_sha256:SHA(snapshot),
    viewport:{width:viewport.width,height:viewport.height},
    initial_run:{nodeId,revision:snapshot.revision},
    seed:"runtime-uncontrolled",clock:"not-frozen",
    input_domain:{kind:"node.opening[0].narrationText",case_id:test.id,value:test.value},
  };
  let context;
  try {
    const opened=await newPage(browser,fixture,token);
    context=opened.context;
    const page=opened.page,states=new Map(),steps=[],transitions=[];
    let current=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
    const initialId=current.id;
    states.set(current.id,current);
    async function doAction(action) {
      const from=current;
      await perform(page,action);
      current=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
      states.set(current.id,current);
      const id="transition:"+SHA([fixture.id,from.id,action,current.id]).slice(0,20);
      const transition={id,fixture:fixture.id,from:from.id,to:current.id,action,observed:true};
      transitions.push(transition);
      steps.push({from:from.id,to:current.id,action});
      return transition;
    }
    const selectVisible=(kind,label)=> {
      const matches=current.ui.visible_controls.filter(c=>c.kind===kind&&c.label===label&&c.enabled);
      if(matches.length!==1)throw Error("Expected one enabled "+kind+" labeled "+JSON.stringify(label)+", got "+matches.length+" in "+current.ui.workspace);
      return matches[0];
    };
    const open=selectVisible("button","[EDIT NODE]");
    await doAction({locator:open.locator,event:"click",value:null,pointer_activations:1});
    if(current.ui.workspace!=="narrative.node")throw Error("The real Node editor was not reached.");
    const editor=selectVisible("textarea","NARRATION");
    await doAction({locator:editor.locator,event:"fill",value:test.value,pointer_activations:0});
    if(current.ui.visible_controls.find(c=>c.locator===editor.locator)?.value!==test.value)throw Error("DOM field did not retain the entered sample.");
    const save=selectVisible("button","[SAVE]");
    const saved=await doAction({locator:save.locator,event:"click",value:null,pointer_activations:1});
    let after=null;
    for(let attempt=0;attempt<45;attempt++){
      const probe=await request("/api/project/snapshot");
      const text=probe.nodes.find(node=>node.id===nodeId)?.openings?.[0]?.narrationText;
      if(probe.revision>before.revision&&text===test.value){after=probe;break;}
      await page.waitForTimeout(200);
    }
    if(!after)throw Error("Canonical Save did not durably persist expected narration.");
    saved.persistence={
      source:"local-d1-readback",node_id:nodeId,field:"openings[0].narrationText",
      prior_value:initialText,expected_value:test.value,readback_value:after.nodes.find(n=>n.id===nodeId).openings[0].narrationText,
      revision_before:before.revision,revision_after:after.revision,
      snapshot_sha256_before:SHA(before),snapshot_sha256_after:SHA(after),
      restart_verified:false,
    };
    await context.close();context=null;
    await restartLocal(SHA(after));
    const afterRestart=await request("/api/project/snapshot");
    if(SHA(afterRestart)!==SHA(after)
      ||afterRestart.nodes.find(n=>n.id===nodeId)?.openings?.[0]?.narrationText!==test.value)
      throw Error("Persisted project differed after isolated D1 server restart.");
    saved.persistence.restart_verified=true;
    saved.persistence.restart_snapshot_sha256=SHA(afterRestart);
    const trace={
      schema_version:1,type:"author-observed-transitions",
      provenance:{method:"browser-observation",runtime_executed:true,recorder_version:"2",source_commit:process.env.GITHUB_SHA??"local",initial_state_id:initialId,
        explorer:{strategy:"finite-write",suite:"write",maxStates:states.size,maxDepth:3,maxExecutions:1},
        fixture_reset:"disposable-d1-per-case",input_mechanism:"playwright.fill",save_mechanism:"canonical-ui-button",
      },
      fixtures:[fixture],states:[...states.values()],transitions,frontier,
      replays:[{id:"replay:"+SHA([fixture.id,steps]).slice(0,20),fixture:fixture.id,initial_state:initialId,steps,completed:true}],
    };
    const dest=path.join(outputDir,fixture.id+".json");
    await writeFile(dest,JSON.stringify(trace,null,2)+"\n");
    console.log("Verified isolated canonical Save",fixture.id,{revision_before:before.revision,revision_after:after.revision,after_restart:true,transitions:transitions.length},dest);
  }finally {
    await context?.close();
  }
}

const navigationCases=[
  {id:"close-keep-discard",value:"Uncommitted audit narration / keep-discard"},
  {id:"close-save-all",value:"Audit narration committed by Save All"},
  {id:"nested-parent-return",value:"Unsaved parent draft survives child return"},
  {id:"dirty-child-back",value:"Unsaved nested node draft before Back"},
];
async function captureDraftNavigationCase(browser,viewport,test) {
  // Reset ALL persisted authored data between cases. No user or live DB access.
  await startFreshDisposable();
  const {snapshot,token,nodeId}=await seedFixture();
  const before=await request("/api/project/snapshot");
  const original=before.nodes.find(n=>n.id===nodeId)?.openings?.[0]?.narrationText;
  if(typeof original!=="string" || original===test.value)throw Error("Bad original narration fixture");
  const fixture={
    id:"author-audit-"+viewport.id+"-navigation-"+test.id,
    project_fixture:"isolated-local-d1-draft-navigation-v1",
    project_sha256:SHA(before),
    viewport:{width:viewport.width,height:viewport.height},
    initial_run:{nodeId,revision:before.revision},
    seed:"runtime-uncontrolled",clock:"not-frozen",
    navigation_case:test.id,
  };
  let context;
  try{
    const opened=await newPage(browser,fixture,token);
    context=opened.context;
    const page=opened.page,states=new Map(),transitions=[],steps=[],frontier=[];
    let blockedNestedBack=false;
    let current=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
    const initialId=current.id;
    states.set(current.id,current);
    function select(kind,label) {
      const controls=current.ui.visible_controls.filter(c=>c.kind===kind&&c.label===label&&c.enabled);
      if(controls.length!==1)throw Error("Expected one enabled "+kind+" "+JSON.stringify(label)+" in "+(current.ui.workspace||"terminal")+", got "+controls.length+"; choices: "+current.ui.visible_controls.map(c=>c.label).slice(0,24).join(" | "));
      return controls[0];
    }
    async function move(kind,label,event="click",value=null){
      const c=select(kind,label);
      const action={locator:c.locator,event,value,pointer_activations:event==="click"?1:0};
      const from=current;
      await perform(page,action);
      current=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
      states.set(current.id,current);
      const edge={id:"transition:"+SHA([fixture.id,from.id,action,current.id]).slice(0,20),fixture:fixture.id,from:from.id,to:current.id,action,observed:true};
      transitions.push(edge);steps.push({from:from.id,to:current.id,action});
      return edge;
    }
    function expectNarration(value){
      if(current.ui.workspace!=="narrative.node")throw Error("Expected active real Node workspace.");
      const field=select("textarea","NARRATION");
      if(field.value!==value)throw Error("Draft was lost: expected "+JSON.stringify(value)+", observed "+JSON.stringify(field.value));
      return field;
    }
    async function expectDialog(title,actions) {
      const dialog=page.locator('[role="alertdialog"]');
      if(await dialog.count()!==1 || !(await dialog.innerText()).includes(title))throw Error("Expected "+title+" Author navigation confirmation.");
      for(const action of actions)select("button",action);
    }
    await move("button","[EDIT NODE]");
    if(test.id!=="dirty-child-back"){
      expectNarration(original);
      await move("textarea","NARRATION","fill",test.value);
      expectNarration(test.value);
    }
    if(test.id==="nested-parent-return"){
      await move("button","[TOOLS]");
      if(current.ui.workspace!=="author-tools")throw Error("Opening nested Tools did not suspend Node editor.");
      await move("button","[← BACK]");
      expectNarration(test.value);
      transitions.at(-1).draft_observation={kind:"resumed-parent",field:"openings[0].narrationText",expected_value:test.value,observed_value:select("textarea","NARRATION").value};
    }
    if(test.id==="dirty-child-back"){
      await move("button","[TOOLS]");
      if(current.ui.workspace!=="author-tools")throw Error("Expected nested Tools.");
      await move("button","STRUCTURE Browse Nodes, entry responses, valid inputs, and destinations. ›");
      if(current.ui.workspace!=="narrative-structure")throw Error("Expected nested Structure workspace.");
      const depthBefore=current.ui.task_depth;
      const row=current.ui.visible_controls.find(c=>c.kind==="button"&&c.label.startsWith("Node #1")&&c.enabled);
      if(!row)throw Error("No actual Node #1 navigation control available from Structure.");
      const openedNode=await move("button",row.label);
      const depthAfter=current.ui.task_depth;
      const backVisible=current.ui.visible_controls.some(c=>c.kind==="button"&&c.label==="[← BACK]"&&c.enabled);
      openedNode.task_depth_observation={before:depthBefore,after:depthAfter,back_visible:backVisible};
      expectNarration(original);
      await move("textarea","NARRATION","fill",test.value);
      expectNarration(test.value);
      if(!backVisible){
        // The child unexpectedly replaced the task stack. This is a factual
        // frontier: no Back action was presented, therefore no Back edge exists.
        blockedNestedBack=true;
        frontier.push({state:current.id,locator:"author-workspace-back",reason:"unknown"});
        await move("button","Close Author tasks and return to play");
        await expectDialog("RETURN TO PLAYER",["[KEEP EDITING]","[DISCARD ALL & RETURN]"]);
      }else{
        await move("button","[← BACK]");
        await expectDialog("UNSAVED CHANGES",["[KEEP EDITING]","[DISCARD CHANGES]"]);
        await move("button","[KEEP EDITING]");
        expectNarration(test.value);
        await move("button","[← BACK]");
        await expectDialog("UNSAVED CHANGES",["[KEEP EDITING]","[DISCARD CHANGES]"]);
        await move("button","[DISCARD CHANGES]");
        if(current.ui.workspace!=="narrative-structure")throw Error("Discard Back did not return to nested parent task.");
        const afterDiscard=await request("/api/project/snapshot");
        if(SHA(afterDiscard)!==SHA(before))throw Error("Discard Back unexpectedly persisted node changes.");
      }
    }
    if(test.id!=="dirty-child-back"){
      await move("button","Close Author tasks and return to play");
      await expectDialog("RETURN TO PLAYER",["[KEEP EDITING]","[SAVE ALL & RETURN]","[DISCARD ALL & RETURN]"]);
      if(test.id==="close-keep-discard"){
        await move("button","[KEEP EDITING]");
        expectNarration(test.value);
        await move("button","Close Author tasks and return to play");
        await expectDialog("RETURN TO PLAYER",["[DISCARD ALL & RETURN]"]);
      }
    }
    const willSave=test.id==="close-save-all";
    const end=await move("button",willSave?"[SAVE ALL & RETURN]":
      test.id==="dirty-child-back"&&!blockedNestedBack?"Close Author tasks and return to play":"[DISCARD ALL & RETURN]");
    if(test.id==="dirty-child-back" && await page.locator('[role="alertdialog"]').count())throw Error("Nested Author task left dirty close confirmation.");
    if(current.ui.overlay_open)throw Error("Master X did not return to actual player surface.");
    let after=null;
    for(let attempt=0;attempt<45;attempt++){
      const result=await request("/api/project/snapshot");
      const updated=result.nodes.find(n=>n.id===nodeId)?.openings?.[0]?.narrationText;
      if(willSave ? result.revision>before.revision&&updated===test.value : SHA(result)===SHA(before)){after=result;break;}
      await page.waitForTimeout(200);
    }
    if(!after)throw Error("Unexpected D1 state after navigation: "+test.id);
    const expectedValue=willSave?test.value:original;
    end.project_observation={
      source:"local-d1-readback",case_id:test.id,field:"openings[0].narrationText",node_id:nodeId,
      expected_value:expectedValue,readback_value:after.nodes.find(n=>n.id===nodeId).openings[0].narrationText,
      revision_before:before.revision,revision_after:after.revision,
      snapshot_sha256_before:SHA(before),snapshot_sha256_after:SHA(after),
      changed:willSave,restart_verified:false,
    };
    await context.close();context=null;
    await restartLocal(SHA(after));
    const restarted=await request("/api/project/snapshot");
    if(SHA(restarted)!==SHA(after)||restarted.nodes.find(n=>n.id===nodeId)?.openings?.[0]?.narrationText!==expectedValue)
      throw Error("D1 project or Node narration diverged across restart.");
    end.project_observation.restart_verified=true;
    end.project_observation.restart_snapshot_sha256=SHA(restarted);
    const trace={
      schema_version:1,type:"author-observed-transitions",
      provenance:{method:"browser-observation",runtime_executed:true,recorder_version:"2",source_commit:process.env.GITHUB_SHA??"local",initial_state_id:initialId,
        fixture_reset:"disposable-d1-per-case",input_mechanism:"playwright.fill",navigation_mechanism:"canonical-task-shell",
        explorer:{strategy:"finite-draft-navigation",suite:"navigation",maxStates:states.size,maxDepth:steps.length,maxExecutions:1}},
      fixtures:[fixture],states:[...states.values()],transitions,frontier,
      replays:[{id:"replay:"+SHA([fixture.id,steps]).slice(0,20),fixture:fixture.id,initial_state:initialId,steps,completed:true}],
    };
    const dest=path.join(outputDir,fixture.id+".json");
    await writeFile(dest,JSON.stringify(trace,null,2)+"\n");
    console.log("Verified isolated dirty Author navigation",fixture.id,{steps:steps.length,changed:willSave,blocked_nested_back:blockedNestedBack,revision_before:before.revision,revision_after:after.revision,restart_verified:true});
  }finally{
    await context?.close();
  }
}
let browser;
try {
  const { chromium }=await import("playwright").catch(()=>{
    throw new Error("Playwright is required for the isolated browser audit. CI installs it; locally install with npm install --no-save --no-package-lock playwright@1.56.1 and npx playwright install chromium.");
  });
  await requireExclusiveLocalPorts();
  const generated=spawnSync(process.execPath,["scripts/generate-asset-manifest.mjs"],{stdio:"inherit"});
  if(generated.status!==0)throw new Error("Cannot prepare repository asset manifest for local Author client.");
  if(captureDraftNavigation){
    browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
    await mkdir(outputDir,{recursive:true});
    for(const viewport of viewports)for(const test of navigationCases)await captureDraftNavigationCase(browser,viewport,test);
    console.log("All finite Author navigation cases verified with independent D1 restarts.");
  }else if(captureWrites){
    browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
    await mkdir(outputDir,{recursive:true});
    for(const viewport of viewports)for(const test of writeDomains)await captureWrite(browser,viewport,test);
    console.log("All finite write fixtures persisted and survived local D1 restart.");
  }else{
  await startLocal({reset:true});
  const {snapshot,token,nodeId}=await seedFixture();
  const fixtureHash=SHA(snapshot);
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  await mkdir(outputDir,{recursive:true});
  for(const viewport of viewports) {
    const fixture={
      id:"author-audit-"+viewport.id+(suite==="baseline"?"":"-"+suite),
      project_fixture:"isolated-local-d1-seeded-v1",
      project_sha256:fixtureHash,
      viewport:{width:viewport.width,height:viewport.height},
      initial_run:{nodeId,revision:snapshot.revision},
      seed:"runtime-uncontrolled",
      clock:"not-frozen",
    };
    const priorQueue=resumeFrom?pendingFrontierPaths(viewport,fixtureHash):null;
    const result=await traverse(browser,fixture,token,fixtureHash,priorQueue);
    const trace={
      schema_version:1,type:"author-observed-transitions",
      provenance:{method:"browser-observation",runtime_executed:true,recorder_version:"2",source_commit:process.env.GITHUB_SHA??"local",initial_state_id:result.initialStateId,explorer:{strategy,suite,maxStates,maxDepth,maxExecutions,enableScroll,scrollMechanism:enableScroll?"wheel":"none",...(resumeFrom?{resumeFrom}: {})}},
      fixtures:[fixture],
      states:result.states,transitions:result.transitions,frontier:result.frontier,replays:result.replays,
    };
    const filename=path.join(outputDir,fixture.id+".json");
    await writeFile(filename,JSON.stringify(trace,null,2)+"\n");
    console.log("Observed",fixture.id,result.stats,filename);
    if(result.stats.replay_failures>Math.ceil(result.stats.visited*0.6))
      throw new Error("Too many failed browser branches; inspect the recorded frontier.");
  }
  }
}finally{
  await browser?.close();
  await stopLocal();
}

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
async function restartLocal(expectedHash) {
  await stopServer();
  await requireExclusiveLocalPorts();
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
}
async function traverse(browser, fixture, token, expectedHash) {
  const states=new Map(),transitions=new Map(),frontier=new Map(),replays=[];
  let initialStateId=null;
  const queue=[{path:[],from:null}];const visited=new Set();let replayFailures=0;let executedPaths=0;
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
    const {page,context}=await newPage(browser,fixture,token);
    let lastObserved=null;
    const replaySteps=[];
    let replayInitialId=null;
    try {
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
    } finally {
      await context.close();
    }
  }
  if(queue.length) {
    // Record budget-limited branches as an explicit unexplored frontier.
    for(const remaining of queue) {
      note({state:remaining.from??states.values().next().value?.id??"state:unavailable",locator:remaining.path.at(-1)?.locator??"unknown",...(remaining.path.at(-1)?{action:remaining.path.at(-1)}:{}),reason:"unvisited"});
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
let browser;
try {
  const { chromium }=await import("playwright").catch(()=>{
    throw new Error("Playwright is required for the isolated browser audit. CI installs it; locally install with npm install --no-save --no-package-lock playwright@1.56.1 and npx playwright install chromium.");
  });
  await requireExclusiveLocalPorts();
  const generated=spawnSync(process.execPath,["scripts/generate-asset-manifest.mjs"],{stdio:"inherit"});
  if(generated.status!==0)throw new Error("Cannot prepare repository asset manifest for local Author client.");
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
    const result=await traverse(browser,fixture,token,fixtureHash);
    const trace={
      schema_version:1,type:"author-observed-transitions",
      provenance:{method:"browser-observation",runtime_executed:true,recorder_version:"2",source_commit:process.env.GITHUB_SHA??"local",initial_state_id:result.initialStateId,explorer:{strategy,suite,maxStates,maxDepth,maxExecutions}},
      fixtures:[fixture],
      states:result.states,transitions:result.transitions,frontier:result.frontier,replays:result.replays,
    };
    const filename=path.join(outputDir,fixture.id+".json");
    await writeFile(filename,JSON.stringify(trace,null,2)+"\n");
    console.log("Observed",fixture.id,result.stats,filename);
    if(result.stats.replay_failures>Math.ceil(result.stats.visited*0.6))
      throw new Error("Too many failed browser branches; inspect the recorded frontier.");
  }
}finally{
  await browser?.close();
  await stopLocal();
}

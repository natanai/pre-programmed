#!/usr/bin/env node
/**
 * Bounded, deterministic browser traversal of the REAL Author UI.
 * Branches are replayed in new browser contexts against the same disposable local D1 fixture.
 * Persistent mutations are *never* clicked: they remain explicit frontier records.
 * No inferred author intentions, imagined destinations, or simulated UI states.
 */
import { spawn } from "node:child_process";
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
const selected = arg("--viewport", "both");
if (!["both", "desktop", "mobile"].includes(selected)) throw new Error("--viewport must be both, desktop or mobile.");
const viewports = selected === "both" ? [desktop, mobile] : [selected === "mobile" ? mobile : desktop];
const pageTimeout = number("--page-timeout-ms", 20_000);
const SHA = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
let server = null;

async function request(uri, options) {
  const response = await fetch(origin + uri, options);
  if (!response.ok) throw new Error(uri + " (" + response.status + "): " + (await response.text()).slice(0,400));
  return response.json();
}
async function startLocal() {
  await rm(dataDir, {recursive:true,force:true});
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
async function stopLocal() {
  closing=true;
  if(server&&server.exitCode===null) {
    if (process.platform==="win32") {
      const {spawnSync}=await import("node:child_process");
      spawnSync("taskkill",["/pid",String(server.pid),"/T","/F"],{stdio:"ignore"});
    } else {
      try { process.kill(-server.pid,"SIGTERM"); } catch { server.kill("SIGTERM"); }
    }
    await Promise.race([once(server,"exit"),new Promise(r=>setTimeout(r,3500))]);
  }
  await rm(dataDir,{recursive:true,force:true});
}
const performance = {charactersPerSecond:1000,cues:[]};
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
      frontier.push({state:state.id,locator:control.locator,reason:"unsafe-mutation"});
      continue;
    }
    if(control.kind==="select") {
      for(const option of control.options) {
        if(!option.enabled||option.value===control.value)continue;
        actions.push({...base,event:"change",value:option.value,pointer_activations:1});
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
    reducedMotion:"reduce",
    serviceWorkers:"block",
  });
  await context.addInitScript(value=>sessionStorage.setItem("pre-programmed:author-token",value),token);
  await context.addInitScript({path:recorderPath});
  const page=await context.newPage();
  page.setDefaultTimeout(pageTimeout);
  await page.goto(origin,{waitUntil:"domcontentloaded"});
  await page.locator(".author-home").waitFor({state:"visible",timeout:pageTimeout});
  await page.evaluate(fixture=>window.__authorFlowAudit.start(fixture),fixture);
  await settle(page);
  return {page,context};
}
async function traverse(browser, fixture, token) {
  const states=new Map(),transitions=new Map(),frontier=new Map();
  const queue=[[]];const visited=new Set();let replayFailures=0;
  const note=(entry)=>frontier.set(JSON.stringify(entry),entry);
  const addState=(state)=>{if(!states.has(state.id))states.set(state.id,state);};
  while(queue.length && visited.size < maxStates) {
    const path=queue.shift();
    const {page,context}=await newPage(browser,fixture,token);
    try {
      let state=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
      addState(state);
      for(const action of path){
        const before=state;
        await perform(page,action);
        state=await page.evaluate(()=>window.__authorFlowAudit.snapshot());
        addState(state);
        const id=SHA([fixture.id,before.id,action,state.id]).slice(0,20);
        transitions.set(id,{id:"transition:"+id,fixture:fixture.id,from:before.id,to:state.id,action,observed:true,effects:[]});
      }
      if(visited.has(state.id))continue;
      visited.add(state.id);
      const choices=actionDomain(state);
      for(const entry of choices.frontier)note(entry);
      if(path.length>=maxDepth) {
        for(const action of choices.actions)note({state:state.id,locator:action.locator,reason:"unvisited"});
        continue;
      }
      for(const action of choices.actions) {
        // Identical paths are replayable using native pointer events only.
        queue.push([...path,action]);
      }
      if(visited.size%10===0)console.log(fixture.id+": "+visited.size+" unique UI states; "+queue.length+" queued paths");
    } catch(error) {
      replayFailures++;
      const previous=states.values().next().value;
      note({state:previous?.id??"state:unavailable",locator:path.at(-1)?.locator??"runtime",reason:"unknown"});
      console.error("Branch failed:",fixture.id,path.map(x=>x.locator).join(" -> "),String(error).slice(0,220));
    } finally {
      await context.close();
    }
  }
  if(queue.length) {
    // Record budget-limited branches as an explicit unexplored frontier.
    for(const remaining of queue) {
      const parent=remaining.at(-2)?.from ?? states.values().next().value?.id??"state:unavailable";
      note({state:parent,locator:remaining.at(-1)?.locator??"unknown",reason:"unvisited"});
    }
  }
  return {
    states:[...states.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    transitions:[...transitions.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    frontier:[...frontier.values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
    stats:{visited:visited.size,queue_remaining:queue.length,replay_failures:replayFailures},
  };
}
let browser;
try {
  const { chromium }=await import("playwright").catch(()=>{
    throw new Error("Playwright is required for the isolated browser audit. CI installs it; locally install with npm install --no-save --no-package-lock playwright@1.56.1 and npx playwright install chromium.");
  });
  await startLocal();
  const {snapshot,token,nodeId}=await seedFixture();
  const fixtureHash=SHA(snapshot);
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  await mkdir(outputDir,{recursive:true});
  for(const viewport of viewports) {
    const fixture={
      id:"author-audit-"+viewport.id,
      project_fixture:"isolated-local-d1-seeded-v1",
      project_sha256:fixtureHash,
      viewport:{width:viewport.width,height:viewport.height},
      initial_run:{nodeId,revision:snapshot.revision},
      seed:0,
      clock:"not-frozen",
    };
    const result=await traverse(browser,fixture,token);
    const trace={
      schema_version:1,type:"author-observed-transitions",
      provenance:{method:"browser-observation",runtime_executed:true,recorder_version:"2",source_commit:process.env.GITHUB_SHA??"local"},
      fixtures:[fixture],
      states:result.states,transitions:result.transitions,frontier:result.frontier,
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

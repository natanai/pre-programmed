/* Inject this file into a dedicated Author test browser (for example Playwright page.addInitScript).
 * Passive recorder only: never clicks, navigates, persists, or changes the game.
 * The resulting JSON is evidence for actions performed by the test runner.
 */
(() => {
  if (window.__authorFlowAudit) return;
  let session=null;
  let pending=Promise.resolve();
  let capturing=false;
  const sleepFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const hash=text=>{
    let value=0xcbf29ce484222325n;
    for(let i=0;i<text.length;i++)value=BigInt.asUintN(64,(value^BigInt(text.charCodeAt(i)))*0x100000001b3n);
    return value.toString(16).padStart(16,"0");
  };
  function visible(node) {
    if(!node.isConnected||node.closest("[aria-hidden=true],[inert]"))return false;
    const style=getComputedStyle(node);
    return style.display!=="none"&&style.visibility!=="hidden"&&node.getClientRects().length>0;
  }
  function descriptor(node,index) {
    const region=node.closest("[data-author-ui-workspace],[data-author-ui-role],[data-task-id]")||document.body;
    const scope=region.getAttribute("data-author-ui-workspace")||region.getAttribute("data-author-ui-role")||region.getAttribute("data-task-id")||"page";
    const kind=node.tagName.toLowerCase();
    const id=node.id||node.getAttribute("aria-label")||node.getAttribute("name");
    const label=(node.getAttribute("aria-label")||node.labels?.[0]?.textContent||node.innerText||node.textContent||"").replace(/\s+/g," ").trim().slice(0,180);
    const ordinal=Array.from(region.querySelectorAll("button,input,textarea,select,summary,a[href]")).indexOf(node);
    const locator=scope+"/"+kind+"/"+(id?"id:"+id:"index:"+ordinal);
    const value=(kind==="select")?node.value:
      node.type==="checkbox"||node.type==="radio"?Boolean(node.checked):
      node.hasAttribute("aria-pressed")?node.getAttribute("aria-pressed")==="true":
      null;
    const options=kind==="select"?Array.from(node.options).map(o=>({label:o.textContent.trim(),value:o.value,enabled:!o.disabled})):[];
    return {locator,kind,label,enabled:!node.disabled,value,options,expanded:node.getAttribute("aria-expanded"),index};
  }
  function screen() {
    const overlay=document.querySelector(".author-workspace-layer");
    const root=overlay||document.querySelector(".author-input-surface")||document.body;
    const controls=Array.from(root.querySelectorAll("button,input,textarea,select,summary,a[href]")).filter(visible).map(descriptor);
    const trail=Array.from(document.querySelectorAll(".author-task-trail:first-of-type li")).map(n=>({label:n.textContent.trim(),current:n.getAttribute("aria-current")==="page"}));
    const ui={visible_controls:controls,workspace:document.querySelector(".author-task-surface.is-active [data-author-ui-workspace]")?.getAttribute("data-author-ui-workspace")??null};
    const task_stack=trail;
    const content=JSON.stringify({ui,task_stack});
    return {id:"state:"+hash(content),fixture:session.fixture.id,ui,task_stack,draft_state:{observed:false},run_state:{observed:false}};
  }
  function insertState(state) {
    if(!session.states.has(state.id))session.states.set(state.id,state);
    return state.id;
  }
  async function waitSettled() {
    await sleepFrame();
    // A stable DOM is an observation boundary, not proof that all network work is done.
    let prev="";let stable=0;
    for(let i=0;i<16;i++) {
      await new Promise(resolve=>setTimeout(resolve,50));
      const now=JSON.stringify(screen().ui);
      stable=now===prev?stable+1:0;
      if(stable>=2)break;
      prev=now;
    }
  }
  function record(event) {
    if(!session)return;
    const target=event.target?.closest?.("button,input,textarea,select,summary,a[href]");
    if(!target||!visible(target))return;
    const kind=target.tagName.toLowerCase();
    // Text typing is an unbounded domain, so record only committed changes.
    if(event.type==="click"&&!["button","summary","a"].includes(kind))return;
    if(event.type==="change"&&kind!=="input"&&kind!=="select"&&kind!=="textarea")return;
    const from=insertState(screen());
    const d=descriptor(target,0);
    if(capturing) {
      session.frontier.push({state:from,locator:d.locator,reason:"unknown"});
      return;
    }
    capturing=true;
    const action={locator:d.locator,event:event.type,value:event.type==="change"&&target.type!=="checkbox"&&target.type!=="radio"?null:d.value,pointer_activations:event.type==="click"?1:0};
    pending=pending.then(async()=>{
      await waitSettled();
      if(!session)return;
      const to=insertState(screen());
      const key=from+"|"+JSON.stringify(action)+"|"+to;
      session.transitions.push({id:"transition:"+hash(key),fixture:session.fixture.id,from,to,action,observed:true,effects:[]});
      capturing=false;
    });
  }
  const onClick=e=>record(e);
  const onChange=e=>record(e);
  function start(fixture) {
    if(session)throw new Error("Stop the existing audit capture first.");
    if(!fixture?.id||!fixture?.project_fixture||!fixture?.viewport||!fixture?.initial_run)throw new Error("Fixture requires id, project_fixture, viewport and initial_run.");
    capturing=false;
    session={fixture,states:new Map(),transitions:[],frontier:session.frontier};
    insertState(screen());
    document.addEventListener("click",onClick,true);
    document.addEventListener("change",onChange,true);
    return session.fixture.id;
  }
  async function stop() {
    if(!session)throw new Error("No active capture.");
    document.removeEventListener("click",onClick,true);
    document.removeEventListener("change",onChange,true);
    await pending;
    const result={schema_version:1,type:"author-observed-transitions",provenance:{method:"browser-observation",runtime_executed:true,recorder_version:"1"},fixtures:[session.fixture],states:[...session.states.values()],transitions:session.transitions,frontier:[]};
    session=null;pending=Promise.resolve();
    return result;
  }
  window.__authorFlowAudit=Object.freeze({start,stop,idle:()=>pending,snapshot:()=>session?screen():null});
})();

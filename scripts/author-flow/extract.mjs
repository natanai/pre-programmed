#!/usr/bin/env node
/* Read-only Author source inventory. Never executes handlers or infers their outcomes. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const output = path.join(root, "audit/author-flow/source-graph.json");
const check = process.argv.includes("--check");
const uiKinds = new Set(["field","resource","select","toggle","choice","section","disclosure","list","action-row","custom","status"]);
const jsxKinds = new Set(["button","input","select","textarea","option","summary","a","ReferenceField","AuthorInlineDisclosure","ConditionEditor","EffectsEditor","OutcomeConditionEditor","OutcomeEffectsEditor","OperationHooksEditor","AuthorPicker","AuthorUiBlocks","AuthorToolIndex","ValueMentionField"]);
const callbacks = ["onAction","onChange","onClick","onSelect","onSubmit","onToggle","onCreate","onEdit","onRemove","onMove"];
const taskCalls = new Set(["pushTask","openTask","completeTask","leaveCurrentTask","requestBack","requestClose","openList","create","edit","persist","registerWorkspaceSave"]);
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const p=path.join(dir,entry.name);
    if (entry.isDirectory()) return /^(vendor|generated|__snapshots__)$/.test(entry.name)?[]:walk(p);
    return /\.(ts|tsx)$/.test(entry.name)?[p]:[];
  });
}
function unwrap(n) {
  while(n && (ts.isAsExpression(n)||ts.isParenthesizedExpression(n)||ts.isSatisfiesExpression(n)||ts.isNonNullExpression(n))) n=n.expression;
  return n;
}
function lit(n) {
  n=unwrap(n);
  if (!n) return null;
  if (ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if(n.kind===ts.SyntaxKind.TrueKeyword) return true;
  if(n.kind===ts.SyntaxKind.FalseKeyword) return false;
  return null;
}
function prop(n,key) {
  n=unwrap(n);
  if(!n||!ts.isObjectLiteralExpression(n)) return null;
  const found=n.properties.find(p=>ts.isPropertyAssignment(p)&&String(lit(p.name)??p.name.getText()).replace(/^["']|["']$/g,"")===key);
  return found?.initializer??null;
}
function val(n,sf) {
  if(!n) return null;
  const v=lit(n);
  return v!==null?v:{expression:n.getText(sf)};
}
function options(n,sf) {
  n=unwrap(n);
  if(!n) return null;
  if(!ts.isArrayLiteralExpression(n)) return {enumeration:"dynamic",expression:n.getText(sf)};
  return n.elements.map(e=>{
    const x=unwrap(e);
    return ts.isObjectLiteralExpression(x)
      ? {value:val(prop(x,"value"),sf),label:val(prop(x,"label"),sf),has_content:Boolean(prop(x,"content"))}
      : {enumeration:"dynamic",expression:e.getText(sf)};
  });
}
function guards(n,sf) {
  const result=[];
  for(let p=n.parent;p;p=p.parent) {
    if(ts.isConditionalExpression(p)) result.push(p.condition.getText(sf));
    else if(ts.isIfStatement(p)) result.push(p.expression.getText(sf));
    else if(ts.isBinaryExpression(p)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind)) result.push(p.left.getText(sf));
    if(result.length>=5)break;
  }
  return [...new Set(result)];
}
function workspace(n,sf) {
  for(let p=n.parent;p;p=p.parent)
    if(ts.isCallExpression(p)&&p.expression.getText(sf).endsWith("defineAuthorWorkspace"))
      return lit(prop(p.arguments[0],"id"))??"dynamic";
  return null;
}
function attr(n,name,sf) {
  const attrs=(ts.isJsxElement(n)?n.openingElement:n).attributes.properties;
  const a=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.text===name);
  if(!a)return null;
  if(!a.initializer)return true;
  if(ts.isStringLiteral(a.initializer))return a.initializer.text;
  return val(a.initializer.expression??a.initializer,sf);
}
function handlers(n,sf) {
  if(ts.isObjectLiteralExpression(n))return Object.fromEntries(callbacks.map(k=>[k,prop(n,k)?.getText(sf)]).filter(([,v])=>v));
  const attrs=(ts.isJsxElement(n)?n.openingElement:n).attributes.properties;
  return Object.fromEntries(attrs.filter(a=>ts.isJsxAttribute(a)&&callbacks.includes(a.name.text)).map(a=>[a.name.text,a.initializer?.getText(sf)??""]));
}
function label(n,sf) {
  const a=attr(n,"aria-label",sf)??attr(n,"label",sf);
  if(a!==null)return a;
  if(ts.isJsxSelfClosingElement(n))return null;
  const raw=n.children.filter(x=>ts.isJsxText(x)).map(x=>x.getText(sf).trim()).filter(Boolean).join(" ").replace(/\s+/g," ");
  return raw||{expression:"dynamic JSX children"};
}
const paths=[...walk(path.join(root,"src/author")),...walk(path.join(root,"src/features")),...walk(path.join(root,"src/engine")),...walk(path.join(root,"src/player")),...walk(path.join(root,"src/components")),...walk(path.join(root,"src/ui")),path.join(root,"src/App.tsx")].filter(fs.existsSync).sort();
const nodes=[];const edges=[];const calls=[];const sources=[];const branchSites=[];const collectionSites=[];
for(const p of paths) {
  const file=path.relative(root,p).split(path.sep).join("/");
  const sf=ts.createSourceFile(file,fs.readFileSync(p,"utf8"),ts.ScriptTarget.Latest,true,p.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const candidates=[]; const byStart=new Map(); let callCount=0;
  function location(n){const at=sf.getLineAndCharacterOfPosition(n.getStart(sf));return {file,line:at.line+1,column:at.character+1};}
  function id(loc){return loc.file+":"+loc.line+":"+loc.column;}
  function visit(n) {
    let entry=null;
    if(ts.isObjectLiteralExpression(n)) {
      const kind=lit(prop(n,"type"));
      if(uiKinds.has(kind)&&(prop(n,"id")||prop(n,"label")||prop(n,"items")||prop(n,"actions"))) entry={
        kind:"declarative."+kind,declared_id:val(prop(n,"id"),sf),
        label:val(prop(n,"label")??prop(n,"text"),sf),
        selected_value:val(prop(n,"value")??prop(n,"checked"),sf),
        disabled:val(prop(n,"disabled"),sf),default_open:val(prop(n,"defaultOpen"),sf),
        options:options(prop(n,"options"),sf),items:options(prop(n,"items"),sf),
      };
    } else if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)) {
      const tag=(ts.isJsxElement(n)?n.openingElement:n).tagName.getText(sf);
      if(jsxKinds.has(tag))entry={
        kind:"jsx."+tag,declared_id:attr(n,"id",sf),
        label:label(n,sf),selected_value:attr(n,"value",sf)??attr(n,"checked",sf),
        disabled:attr(n,"disabled",sf),default_open:attr(n,"open",sf),
      };
    }
    if(entry) {
      const loc=location(n); const node={id:id(loc),...entry,source:loc,workspace:workspace(n,sf),parent_id:null,guards:guards(n,sf),handlers:handlers(n,sf)};
      nodes.push(node);candidates.push([n,node]);byStart.set(n.getStart(sf),node.id);
    }
    if(ts.isIfStatement(n)||ts.isConditionalExpression(n)||ts.isSwitchStatement(n)||ts.isBinaryExpression(n)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken].includes(n.operatorToken.kind)) {
      const loc=location(n);
      const predicate=ts.isIfStatement(n)?n.expression:ts.isConditionalExpression(n)?n.condition:ts.isSwitchStatement(n)?n.expression:n.left;
      branchSites.push({id:id(loc)+":branch",source:loc,syntax:ts.SyntaxKind[n.kind],predicate:predicate.getText(sf),workspace:workspace(n,sf),alternatives:ts.isSwitchStatement(n)?n.caseBlock.clauses.map(c=>ts.isCaseClause(c)?c.expression.getText(sf):"default"):["taken","not-taken"]});
    }
    if(ts.isCallExpression(n)) {
      const api=n.expression.getText(sf), method=api.split(".").at(-1);
      if(["map","flatMap","filter"].includes(method)) {
        const loc=location(n);
        collectionSites.push({id:id(loc)+":collection",source:loc,method,source_expression:api,workspace:workspace(n,sf),enumeration:"runtime-dependent"});
      }
      if(taskCalls.has(method)&&api.includes(".")) {
        const loc=location(n);
        calls.push({id:id(loc)+":call",source:loc,api,args:n.arguments.map(a=>a.getText(sf)),owner_control:null,guards:guards(n,sf)});
        callCount++;
      }
    }
    ts.forEachChild(n,visit);
  }
  visit(sf);
  for(const [n,node] of candidates) {
    let x=n.parent;
    while(x&&!byStart.has(x.getStart(sf)))x=x.parent;
    node.parent_id=x?byStart.get(x.getStart(sf)):null;
    if(node.parent_id)edges.push({from:node.parent_id,to:node.id,relation:"declared-nesting",evidence:"static"});
  }
  for(const call of calls.filter(c=>c.source.file===file)) {
    const pos=sf.getPositionOfLineAndCharacter(call.source.line-1,call.source.column-1);
    const match=candidates.filter(([n])=>n.getStart(sf)<=pos&&n.getEnd()>=pos).at(-1);
    call.owner_control=match?.[1].id??null;
    if(call.owner_control)edges.push({from:call.owner_control,to:null,relation:"declares-call",call_id:call.id,evidence:"static"});
  }
  sources.push({file,control_declarations:candidates.length,api_call_sites:callCount});
}
const graph={
  schema_version:1,type:"author-source-declarations",
  provenance:{method:"typescript-ast",generator:"scripts/author-flow/extract.mjs",runtime_executed:false},
  semantics:{nodes:"Source-level UI declarations; not unique rendered instances.",edges:"Declared nesting and API calls; not observed screen transitions.",guards:"Raw source expressions, not evaluated."},
  counts:{source_files:paths.length,controls:nodes.length,declared_nesting:edges.filter(e=>e.relation==="declared-nesting").length,api_calls:calls.length,branch_sites:branchSites.length,collection_sites:collectionSites.length,observed_transitions:0},
  sources,nodes,edges,navigation_calls:calls,branch_sites:branchSites,collection_sites:collectionSites,
};
const content=JSON.stringify(graph,null,2)+"\n";
if(check) {
  if(!fs.existsSync(output)||fs.readFileSync(output,"utf8")!==content) {console.error("Source graph is stale: npm run audit:author:extract");process.exitCode=1;}
  else console.log("Author graph is current:",nodes.length,"controls,",calls.length,"calls");
}else {
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,content);
  console.log("Author graph generated:",nodes.length,"controls,",calls.length,"calls");
}

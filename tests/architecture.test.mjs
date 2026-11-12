import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlan, validatePlan, floorSvg, planInventory, snapPoint, constrainLine, translateElement, elementBounds } from '../shared/architecture.mjs';
import { createPlanState, planReducer } from '../shared/architectureHistory.mjs';
import { projectInput } from '../server/src/architecture.mjs';

test('residential and condominium bases are editable metric plans with access-control equipment',()=>{
  for(const name of ['blank','house','condominium']){
    const plan=validatePlan(newPlan(name));assert.equal(plan.units,'m');assert.equal(plan.floors.length,1);assert.equal(new Set(plan.floors[0].elements.map(item=>item.id)).size,plan.floors[0].elements.length);
    assert.equal(validatePlan(plan).floors[0].name,'Térreo');assert.match(floorSvg(plan,plan.floors[0].id),/<svg/);
  }
  const inventory=planInventory(newPlan('condominium'));assert.equal(inventory.items.find(item=>item.equipment==='camera_bullet').quantity,4);assert.equal(inventory.items.find(item=>item.equipment==='facial').quantity,1);assert.equal(inventory.items.find(item=>item.equipment==='lock_na').quantity,1);
});
test('invalid geometry, duplicate identities and active reference formats are rejected before rendering or saving',()=>{
  const original=newPlan('house');
  const check=mutate=>{const plan=structuredClone(original);mutate(plan);assert.throws(()=>validatePlan(plan),error=>error.statusCode===400);};
  check(plan=>{plan.width=Infinity;});check(plan=>{plan.layers={};});check(plan=>{plan.floors=[];});check(plan=>{plan.floors[0].elements[0].x=NaN;});
  check(plan=>{plan.floors[0].elements[1].id=plan.floors[0].elements[0].id;});check(plan=>{plan.floors[0].elements[0].color='red" onload="alert(1)';});check(plan=>{plan.floors[0].elements[0].type='script';});
  check(plan=>{plan.floors[0].background={src:'https://external.invalid/private.png',x:0,y:0,width:10,height:10};});
  check(plan=>{plan.floors[0].background={src:'data:image/svg+xml;base64,PHN2Zz4=',x:0,y:0,width:10,height:10};});
  check(plan=>{plan.floors[0].elements.find(item=>item.type==='equipment').equipment='unknown';});
});
test('snap, orthogonal constraints, translation and metric cable quantities remain consistent across floors',()=>{
  assert.deepEqual(snapPoint({x:1.24,y:-.16}),{x:1.2,y:-.2});assert.deepEqual(snapPoint({x:1.24,y:.16},.1,false),{x:1.24,y:.16});
  assert.deepEqual(constrainLine({x:2,y:2},{x:5,y:3},true),{x:5,y:2});
  const cable={id:'cable-1',type:'cable',layer:'network',x:0,y:0,x2:3,y2:4,rotation:0,label:'UTP'};
  const moved=translateElement(cable,1,-1);assert.deepEqual([moved.x,moved.y,moved.x2,moved.y2],[1,-1,4,3]);assert.equal(cable.x,0);
  const door={type:'door',x:4,y:4,width:1,rotation:0};assert.ok(elementBounds(door).y<3.1);assert.ok(elementBounds({...door,rotation:90}).x<4.1);
  const doc=newPlan('house');doc.floors[0].elements.push(cable);doc.floors.push({id:'floor-2',name:'Superior',background:null,elements:[{...cable,id:'cable-2'},...doc.floors[0].elements.filter(item=>item.equipment==='lock_nf').map(item=>({...item,id:'nf-2',model:'Modelo B'}))]});
  const inventory=planInventory(validatePlan(doc));assert.equal(inventory.cable,10);assert.equal(inventory.items.filter(item=>item.equipment==='lock_nf').length,2);
});
test('SVG export escapes project text, respects hidden layers, preserves original reference and remains vector based',()=>{
  const doc=newPlan('house');doc.floors[0].elements.push({id:'label',type:'text',layer:'notes',x:1,y:1,rotation:0,label:'<script>alert("x")</script> & texto',fontSize:.3});
  const before=JSON.stringify(doc),svg=floorSvg(doc,doc.floors[0].id,{title:'<img onerror="alert(1)">'});assert.match(svg,/&lt;script&gt;/);assert.doesNotMatch(svg,/<script|<img/);assert.match(svg,/<line/);assert.equal(JSON.stringify(doc),before);
  doc.layers.find(item=>item.id==='notes').visible=false;assert.doesNotMatch(floorSvg(doc,doc.floors[0].id),/&lt;script&gt;/);
});
test('undo and redo preserve prior drawings; a save confirmation cannot erase edits made during the request',()=>{
  const project={id:'project',revision:1,updated_at:'old',title:'Teste',document:newPlan()};let state=createPlanState(project);
  const next={...project.document,width:50};state=planReducer(state,{type:'document',document:next});const sentChange=state.change;
  state=planReducer(state,{type:'document',document:{...next,height:40}});
  state=planReducer(state,{type:'saved',project:{...project,revision:2,updated_at:'new'},change:sentChange});assert.equal(state.project.document.height,40);assert.notEqual(state.change,state.savedChange);assert.equal(state.project.revision,2);
  state=planReducer(state,{type:'undo'});assert.equal(state.project.document.height,30);state=planReducer(state,{type:'redo'});assert.equal(state.project.document.height,40);
  state=planReducer(state,{type:'undo'});state=planReducer(state,{type:'document',document:{...next,height:70}});assert.equal(state.future.length,0);
  for(let index=0;index<60;index++)state=planReducer(state,{type:'document',document:{...next,height:70+index}});assert.equal(state.past.length,40);
});
test('project metadata uses allow-listed site and share modes and validates collaborators',()=>{
  const input={title:' Casa ',site_type:'house',visibility:'private',document:newPlan()};assert.equal(projectInput(input).title,'Casa');
  assert.throws(()=>projectInput({...input,title:''}));assert.throws(()=>projectInput({...input,visibility:'public'}));assert.throws(()=>projectInput({...input,editor_ids:['not-an-id']}));assert.throws(()=>projectInput({...input,document:{version:3}}));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectDwg,validateCadMetadata,cadViewports,cadSvgForView,MAX_DWG_BYTES} from '../shared/architectureCad.mjs';
import {newPlan,validatePlan} from '../shared/architecture.mjs';

test('DWG validates binary signature and limits, preserves source identification through document round trip',()=>{
  const bytes=new Uint8Array(64);bytes.set(new TextEncoder().encode('AC1032'));
  assert.deepEqual(inspectDwg(bytes),{signature:'AC1032',version:'2018'});
  assert.deepEqual(inspectDwg(bytes.buffer),inspectDwg(bytes));
  assert.throws(()=>inspectDwg(new TextEncoder().encode('<html>fake DWG</html>')));
  assert.throws(()=>inspectDwg(bytes,MAX_DWG_BYTES+1));
  const cad={format:'DWG',name:'Planta.dwg',sha256:'a'.repeat(64),signature:'AC1032',size:64,entity_count:114091,layer_count:71,omitted_count:170,warning_code:68,calibrated:false};
  const plan=newPlan();plan.floors[0].background={src:'data:image/png;base64,YQ==',x:1,y:1,width:20,height:20,opacity:1,cad};
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))).floors[0].background.cad,cad);
  assert.throws(()=>validateCadMetadata({...cad,sha256:'invalid'}));
  assert.throws(()=>validateCadMetadata({...cad,name:'../source.dwg'}));
  assert.throws(()=>validateCadMetadata({...cad,calibrated:'false'}));
});

test('DWG frames dense geometry while retaining overview and limits SVG dimensions',()=>{
  const entities=Array.from({length:200},(_,i)=>({startPoint:{x:50000+i%10,y:17000+i%20}}));entities.push({startPoint:{x:-100000,y:100000}});
  const svg='<svg viewBox="-100000 -100000 200000 200000" width="100%" height="100%" stroke="#000000" stroke-width="0.1%"></svg>';
  const views=cadViewports({entities},svg);assert.equal(views.length,2);assert.ok(views[0].box[2]<100);assert.deepEqual(views[1].box,[-100000,-100000,200000,200000]);
  const output=cadSvgForView(svg,views[0].box,1000);assert.match(output,/height="1000"/);assert.doesNotMatch(output,/stroke-width="0.1%"/);
  assert.throws(()=>cadSvgForView(svg,[0,0,NaN,1]));assert.throws(()=>cadViewports({entities:[]},'<svg/>'));
  const long=entities.map((entity,i)=>({startPoint:{x:50000+i%10,y:17000+i*10}}));const strips=cadViewports({entities:long},svg);assert.equal(strips.length,4);assert.equal(strips[3].name,'DWG — visão geral');
  const sheets=Array.from({length:2000},(_,i)=>({startPoint:{x:i%100,y:i%500}}));
  sheets.push({startPoint:{x:50,y:-1000}});
  const readable=cadViewports({entities:sheets},svg);
  assert.equal(readable.length,4);
  assert.ok(readable.slice(0,-1).every(view=>view.box[3]<220),'isolated objects must not create empty regional bands');
});

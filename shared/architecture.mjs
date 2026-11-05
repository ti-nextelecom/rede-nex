export const PLAN_LAYERS = [
  { id: 'structure', name: 'Arquitetura', color: '#334155' },
  { id: 'security', name: 'Segurança e acesso', color: '#ea580c' },
  { id: 'network', name: 'Infraestrutura', color: '#2563eb' },
  { id: 'notes', name: 'Cotas e anotações', color: '#64748b' },
];
export const EQUIPMENT = [
  { id: 'camera_dome', name: 'Câmera dome', code: 'CAM', category: 'CFTV', color: '#2563eb', layer: 'security' },
  { id: 'camera_bullet', name: 'Câmera bullet', code: 'CAM', category: 'CFTV', color: '#2563eb', layer: 'security' },
  { id: 'facial', name: 'Leitor facial', code: 'FAC', category: 'Controle de acesso', color: '#7c3aed', layer: 'security' },
  { id: 'lock_na', name: 'Fechadura NA', code: 'NA', category: 'Controle de acesso', color: '#ea580c', layer: 'security' },
  { id: 'lock_nf', name: 'Fechadura NF', code: 'NF', category: 'Controle de acesso', color: '#dc2626', layer: 'security' },
  { id: 'intercom', name: 'Interfone / vídeo porteiro', code: 'INT', category: 'Controle de acesso', color: '#7c3aed', layer: 'security' },
  { id: 'exit_button', name: 'Botoeira de saída', code: 'BOT', category: 'Controle de acesso', color: '#059669', layer: 'security' },
  { id: 'controller', name: 'Controladora de acesso', code: 'CTL', category: 'Controle de acesso', color: '#7c3aed', layer: 'security' },
  { id: 'switch', name: 'Switch PoE', code: 'SW', category: 'Rede', color: '#0891b2', layer: 'network' },
  { id: 'rack', name: 'Rack / NVR', code: 'RCK', category: 'Rede', color: '#0f766e', layer: 'network' },
  { id: 'network_point', name: 'Ponto de rede', code: 'PT', category: 'Rede', color: '#0891b2', layer: 'network' },
];
export const ELEMENT_TYPES = ['wall', 'room', 'door', 'window', 'dimension', 'cable', 'text', 'equipment'];
export const newId = () => globalThis.crypto.randomUUID();
export const round = (value, precision = 3) => Number(value.toFixed(precision));
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const snapPoint = (point, step = .1, enabled = true) => ({ x: round(enabled ? Math.round(point.x / step) * step : point.x), y: round(enabled ? Math.round(point.y / step) * step : point.y) });
export const formatMetres = value => `${Number(value.toFixed(2)).toLocaleString('pt-BR')} m`;
export function constrainLine(start, end, orthogonal) { return !orthogonal ? end : Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? { x: end.x, y: start.y } : { x: start.x, y: end.y }; }
export function newPlan(template = 'blank', id = newId) {
  const floorId = id();
  const doc = { version: 1, units: 'm', width: template==='house'?20:template==='condominium'?33:40, height: template==='house'?18:template==='condominium'?28:30, layers: PLAN_LAYERS.map(layer => ({ id: layer.id, visible: true, locked: false })), floors: [{ id: floorId, name: 'Térreo', elements: [], background: null }] };
  const add = (type, values) => doc.floors[0].elements.push({ id: id(), type, layer: ['text', 'dimension'].includes(type) ? 'notes' : type === 'equipment' ? 'security' : 'structure', x: 0, y: 0, rotation: 0, label: '', ...values });
  const wall = (x, y, x2, y2) => add('wall', { x, y, x2, y2, thickness: .15 });
  if (template === 'house') {
    [[4,4,16,4],[16,4,16,13],[16,13,4,13],[4,13,4,4],[10,4,10,13],[4,9,10,9],[10,8.5,16,8.5],[13,8.5,13,13]].forEach(points => wall(...points));
    [[4,4,6,5,'Sala / cozinha'],[4,9,6,4,'Quarto'],[10,4,6,4.5,'Garagem'],[10,8.5,3,4.5,'Circulação'],[13,8.5,3,4.5,'Suíte']].forEach(([x,y,width,height,label]) => add('room',{x,y,width,height,label,color:'#e2e8f0'}));
    add('door',{x:10,y:10,width:.9}); add('door',{x:7,y:13,width:1}); add('window',{x:6,y:4,width:1.5});
    add('equipment',{x:4.6,y:4.6,equipment:'camera_dome',label:'CAM 01',rotation:45,fov:90,range:6});
    add('equipment',{x:7.7,y:12.6,equipment:'facial',label:'FAC 01'});
    add('equipment',{x:6.8,y:12.8,equipment:'lock_nf',label:'NF 01'});
    add('dimension',{x:4,y:14.5,x2:16,y2:14.5});
  } else if (template === 'condominium') {
    [[3,3,29,3],[29,3,29,23],[29,23,3,23],[3,23,3,3],[3,18,9,18],[9,18,9,23]].forEach(points=>wall(...points));
    [[5,5,9,7,'Bloco A'],[18,5,9,7,'Bloco B'],[11,15,15,6,'Estacionamento'],[3,18,6,5,'Portaria']].forEach(([x,y,width,height,label])=>add('room',{x,y,width,height,label,color:'#e2e8f0'}));
    add('door',{x:13,y:23,width:3}); add('door',{x:9,y:20,width:1,rotation:90});
    [[4,4,45],[28,4,135],[28,22,225],[4,17,315]].forEach(([x,y,rotation],index)=>add('equipment',{x,y,equipment:'camera_bullet',label:`CAM 0${index+1}`,rotation,fov:85,range:9}));
    add('equipment',{x:9.7,y:20,equipment:'facial',label:'FAC 01'}); add('equipment',{x:8.5,y:20,equipment:'lock_na',label:'NA 01'});
    add('equipment',{x:5,y:21,equipment:'rack',layer:'network',label:'RCK 01'});
    add('dimension',{x:3,y:25,x2:29,y2:25});
  }
  return doc;
}
const bad = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const number = (value, min, max, fallback) => { if (value === undefined && fallback !== undefined) return fallback; if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) bad('Medida fora dos limites da planta.'); return round(value); };
const text = (value, max = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export function validatePlan(input) {
  if (!input || input.version !== 1 || input.units !== 'm' || !Array.isArray(input.floors) || !input.floors.length || input.floors.length > 20) bad('Planta inválida. Use um arquivo Rede NEX versão 1 com até 20 pavimentos.');
  if (input.layers !== undefined && !Array.isArray(input.layers)) bad('Camadas inválidas.');
  if (new TextEncoder().encode(JSON.stringify(input)).length > 5_500_000) bad('A planta excede o limite de tamanho. Reduza a imagem de referência.');
  const ids = new Set(); let total = 0;
  const register = id => { if (!validId(id) || ids.has(id)) bad('Identificação de elemento repetida ou inválida.'); ids.add(id); return id; };
  return { version: 1, units: 'm', width: number(input.width, 5, 500), height: number(input.height, 5, 500),
    layers: PLAN_LAYERS.map(layer => { const value = input.layers?.find(item => item.id === layer.id); return { id: layer.id, visible: value?.visible !== false, locked: value?.locked === true }; }),
    floors: input.floors.map(floor => {
      if (!floor || !Array.isArray(floor.elements) || (total += floor.elements.length) > 10000) bad('Limite de 10.000 elementos por projeto.');
      let background = null;
      if (floor.background) {
        const value = floor.background;
        if (typeof value.src !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.src) || value.src.length > 1_500_000) bad('Referência deve ser imagem PNG, JPEG ou WebP de até 1 MB.');
        background = { src: value.src, x: number(value.x,-500,500), y: number(value.y,-500,500), width: number(value.width,.1,500), height: number(value.height,.1,500), opacity: number(value.opacity,.05,1,.5) };
      }
      return { id: register(floor.id), name: text(floor.name,80) || 'Pavimento', background, elements: floor.elements.map(element => {
        if (!element || !ELEMENT_TYPES.includes(element.type) || !PLAN_LAYERS.some(layer=>layer.id===element.layer)) bad('Tipo de elemento ou camada inválida.');
        const result = { id: register(element.id), type: element.type, layer: element.layer, x: number(element.x,-500,1000), y: number(element.y,-500,1000), rotation: number(element.rotation,-36000,36000,0), label: text(element.label), notes: text(element.notes,1000) };
        if (['wall','dimension','cable'].includes(element.type)) { result.x2 = number(element.x2,-500,1000); result.y2 = number(element.y2,-500,1000); }
        if (element.type === 'wall') result.thickness = number(element.thickness,.05,1,.15);
        if (['room','door','window'].includes(element.type)) result.width = number(element.width,.1,500,1);
        if (element.type === 'room') result.height = number(element.height,.1,500,1);
        if (element.color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(element.color)) bad('Cor inválida.'); result.color = element.color; }
        if (element.type === 'text') result.fontSize = number(element.fontSize,.1,3,.3);
        if (element.type === 'equipment') {
          if (!EQUIPMENT.some(item=>item.id===element.equipment)) bad('Equipamento não reconhecido.');
          Object.assign(result,{equipment:element.equipment,range:number(element.range,.5,100,6),fov:number(element.fov,15,180,90),size:number(element.size,.2,3,.7),model:text(element.model,120),height:number(element.height,0,100,2.5),address:text(element.address,120)});
        }
        return result;
      }) };
    }) };
}
export function translateElement(element, dx, dy) { const next={...element,x:round(element.x+dx),y:round(element.y+dy)}; if (element.x2 !== undefined) {next.x2=round(element.x2+dx);next.y2=round(element.y2+dy);} return next; }
export function elementBounds(element) {
  const {type,x,y}=element,margin=.1;
  if(['wall','cable','dimension'].includes(type))return {x:Math.min(x,element.x2)-margin,y:Math.min(y,element.y2)-margin,width:Math.abs(element.x2-x)+margin*2,height:Math.abs(element.y2-y)+margin*2};
  let left=0,top=0,width=element.width||.7,height=.5;
  if(type==='equipment'){width=height=element.size||.7;left=top=-width/2;}
  if(type==='door'){height=width;top=-height;}
  if(type==='window'){height=.2;top=-.1;}
  if(type==='room')height=element.height||1;
  if(type==='text'){height=element.fontSize||.3;top=-height;width=Math.max(.3,(element.label||' ').length*height*.55);}
  const angle=(type==='room'?0:element.rotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const points=[[left,top],[left+width,top],[left+width,top+height],[left,top+height]].map(([px,py])=>({x:x+px*cos-py*sin,y:y+px*sin+py*cos}));
  const minX=Math.min(...points.map(point=>point.x)),minY=Math.min(...points.map(point=>point.y));
  return {x:minX-margin,y:minY-margin,width:Math.max(...points.map(point=>point.x))-minX+margin*2,height:Math.max(...points.map(point=>point.y))-minY+margin*2};
}
export function planInventory(document) {
  const groups=new Map(); let cable=0;
  for(const floor of document.floors) for(const element of floor.elements) {
    if(element.type==='cable')cable+=distance(element,{x:element.x2,y:element.y2});
    if(element.type!=='equipment')continue;
    const definition=EQUIPMENT.find(item=>item.id===element.equipment); if(!definition)continue;
    const key=element.equipment+'\0'+(element.model||''); const row=groups.get(key)||{equipment:element.equipment,name:definition.name,model:element.model||'',quantity:0,floors:[]}; row.quantity++; if(!row.floors.includes(floor.name))row.floors.push(floor.name);groups.set(key,row);
  }
  return {items:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),cable:round(cable,2)};
}
export const escapeXml = value => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]));
export function elementSvg(element,{coverage=true}={}) {
  const {x,y,type}=element; const rotation=element.rotation||0;
  const label=escapeXml(element.label||'');const color=element.color||'#334155';
  const lineEnd={x:element.x2,y:element.y2};
  if(type==='wall')return `<line x1="${x}" y1="${y}" x2="${element.x2}" y2="${element.y2}" stroke="${color}" stroke-width="${element.thickness||.15}" stroke-linecap="square"/>`;
  if(type==='room')return `<g><rect x="${x}" y="${y}" width="${element.width}" height="${element.height}" fill="${element.color||'#e2e8f0'}" fill-opacity=".35" stroke="#94a3b8" stroke-width=".025"/><text x="${x+element.width/2}" y="${y+element.height/2}" text-anchor="middle" fill="#475569" font-size=".28">${label}</text><text x="${x+element.width/2}" y="${y+element.height/2+.4}" text-anchor="middle" fill="#64748b" font-size=".22">${round(element.width*element.height,2).toLocaleString('pt-BR')} m²</text></g>`;
  if(type==='text')return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})" fill="${color}" font-size="${element.fontSize||.3}">${label}</text>`;
  if(type==='dimension'||type==='cable') {
    const length=distance(element,lineEnd),angle=Math.atan2(element.y2-y,element.x2-x)*180/Math.PI;const cable=type==='cable';
    return `<g stroke="${cable?'#2563eb':color}" stroke-width=".035" fill="none"><line x1="${x}" y1="${y}" x2="${element.x2}" y2="${element.y2}" ${cable?'stroke-dasharray=".18 .12"':''}/>${!cable?`<path d="M${x-.12} ${y-.12}l.24 .24 M${element.x2-.12} ${element.y2-.12}l.24 .24"/>`:''}<text transform="translate(${(x+element.x2)/2} ${(y+element.y2)/2-.15}) rotate(${angle>90||angle< -90?angle+180:angle})" stroke="white" stroke-width=".08" paint-order="stroke" fill="${cable?'#2563eb':color}" text-anchor="middle" font-size=".23">${label?label+' · ':''}${formatMetres(length)}</text></g>`;
  }
  if(type==='door'||type==='window') {
    const w=element.width||.9;
    return `<g transform="translate(${x} ${y}) rotate(${rotation})" fill="none"><path d="M0 0h${w}" stroke="white" stroke-width=".24"/>${type==='door'?`<path d="M0 0v${-w} M0 ${-w}A${w} ${w} 0 0 1 ${w} 0" stroke="#b45309" stroke-width=".04"/>`:`<rect x="0" y="-.09" width="${w}" height=".18" stroke="#0284c7" stroke-width=".035"/><path d="M0 0h${w}" stroke="#0284c7" stroke-width=".025"/>`}</g>`;
  }
  if(type!=='equipment')return '';
  const item=EQUIPMENT.find(item=>item.id===element.equipment); if(!item)return '';
  const s=element.size||.7,range=element.range||6,half=(element.fov||90)/2*Math.PI/180;
  const cone=coverage&&element.equipment.startsWith('camera_')?`<path pointer-events="none" d="M0 0L${range*Math.cos(-half)} ${range*Math.sin(-half)}A${range} ${range} 0 0 1 ${range*Math.cos(half)} ${range*Math.sin(half)}Z" fill="${item.color}" fill-opacity=".07" stroke="${item.color}" stroke-opacity=".3" stroke-width=".025" stroke-dasharray=".12 .12"/>`:'';
  const shape=element.equipment.startsWith('camera_')?`<rect x="-.27" y="-.17" width=".42" height=".34" rx=".05"/><path d="M.15 -.1L.32 -.2V.2L.15 .1Z"/>`:element.equipment==='facial'?`<rect x="-.2" y="-.28" width=".4" height=".56" rx=".07"/><circle cy="-.06" r=".09"/><path d="M-.12 .17Q0 -.02 .12 .17"/>`:element.equipment.startsWith('lock_')?`<rect x="-.2" y="-.02" width=".4" height=".3" rx=".04"/><path d="M-.12 -.02v-.14a.12 .12 0 0 1 .24 0v.14"/>`:`<rect x="-.27" y="-.21" width=".54" height=".42" rx=".05"/><path d="M-.17 0h.34 M-.17 .1h.1 M.07 .1h.1"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">${cone}<g transform="scale(${s/.54})" fill="white" stroke="${item.color}" stroke-width=".05">${shape}</g></g><text x="${x}" y="${y+s/2+.28}" font-size=".25" text-anchor="middle" fill="${item.color}" stroke="white" stroke-width=".055" paint-order="stroke">${label||item.code}</text>`;
}
export function floorSvg(document,floorId,{grid=false,coverage=true,title='Planta baixa',includeHidden=false}={}) {
  const doc=validatePlan(document),floor=doc.floors.find(item=>item.id===floorId)||doc.floors[0];
  const layers=new Map(doc.layers.map(item=>[item.id,item.visible]));
  const background=floor.background;const body=floor.elements.filter(element=>includeHidden||layers.get(element.layer)).sort((a,b)=>(a.type==='room'?-1:0)-(b.type==='room'?-1:0)).map(element=>elementSvg(element,{coverage})).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width*60}" height="${doc.height*60}" viewBox="0 0 ${doc.width} ${doc.height}" font-family="Arial,sans-serif"><title>${escapeXml(title)} · ${escapeXml(floor.name)}</title><rect width="100%" height="100%" fill="white"/>${grid?'<defs><pattern id="grid" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M.5 0H0V.5" fill="none" stroke="#e2e8f0" stroke-width=".015"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/>':''}${background?`<image href="${background.src}" x="${background.x}" y="${background.y}" width="${background.width}" height="${background.height}" opacity="${background.opacity}" preserveAspectRatio="none"/>`:''}${body}</svg>`;
}

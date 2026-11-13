import { MAX_DWG_BYTES, cadSvgForView, inspectDwg, type CadMetadata, type CadView } from '../../shared/architectureCad.mjs';
import { newId, type PlanFloor } from '../../shared/architecture.mjs';
import { getCadSource, putCadSource } from './architectureDrafts';
import { downloadFile } from './architectureFiles';

interface Result {svg:string;views:CadView[];summary:Pick<CadMetadata,'entity_count'|'layer_count'|'omitted_count'|'warning_code'>}
export async function dwgHash(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');}
function parse(bytes:ArrayBuffer,onProgress:(value:string)=>void,signal?:AbortSignal):Promise<Result>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../workers/architectureDwg.worker.ts',import.meta.url),{type:'module'});
    const finish=(error?:Error,result?:Result)=>{clearTimeout(timeout);signal?.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(result!);};
    const abort=()=>finish(new Error('Importação cancelada. O original foi preservado.'));
    const timeout=setTimeout(()=>finish(new Error('A leitura excedeu dois minutos. Tente em um computador com mais memória.')),120000);
    worker.onerror=()=>finish(new Error('O leitor DWG foi interrompido. Tente em um computador com mais memória.'));
    worker.onmessage=event=>{if(event.data.progress)onProgress(event.data.progress);else if(event.data.error)finish(new Error(event.data.error));else finish(undefined,event.data);};
    if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});worker.postMessage(bytes,[bytes]);
  });
}
async function render(svg:string,view:CadView){
  const url=URL.createObjectURL(new Blob([cadSvgForView(svg,view.box,4000)],{type:'image/svg+xml'}));
  try{
    const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar a base 2D.');context.fillStyle='#0b1220';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0);
    for(const quality of [.88,.76,.64,.5]){const src=canvas.toDataURL('image/jpeg',quality);if(src.length<=1_100_000)return src;}
    throw Error('A base ficou grande demais. Simplifique uma cópia do DWG e importe novamente.');
  }finally{URL.revokeObjectURL(url);}
}
export async function importDwg(file:File,ownerId:string,onProgress:(value:string)=>void=()=>{},signal?:AbortSignal):Promise<PlanFloor[]>{
  if(file.size<64||file.size>MAX_DWG_BYTES)throw Error('Escolha um DWG válido de até 20 MB.');
  const bytes=await file.arrayBuffer(),identity=inspectDwg(bytes),sha256=await dwgHash(bytes);
  const result=await parse(bytes,onProgress,signal),floors:PlanFloor[]=[];
  for(const view of result.views){if(signal?.aborted)throw Error('Importação cancelada.');onProgress(`Preparando ${view.name}…`);const ratio=view.box[2]/view.box[3],width=ratio>=1?60:60*ratio,height=width/ratio;
    floors.push({id:newId(),name:view.name,elements:[],background:{src:await render(result.svg,view),x:1,y:1,width,height,opacity:1,cad:{format:'DWG',name:file.name,signature:identity.signature,sha256,size:file.size,...result.summary,calibrated:false}}});
  }
  await putCadSource(ownerId,sha256,file).catch(()=>{throw Error('Não foi possível preservar a cópia local do DWG. Libere espaço no navegador e tente novamente.');});
  return floors;
}
export async function downloadDwg(ownerId:string,cad:CadMetadata){
  const source=await getCadSource(ownerId,cad.sha256);if(!source)throw Error('O original DWG está apenas no dispositivo onde foi importado. A base visual permanece neste projeto.');
  if(await dwgHash(await source.file.arrayBuffer())!==cad.sha256)throw Error('A cópia local não passou na verificação de integridade. Use o DWG original.');
  downloadFile(source.file,'application/acad',source.name);
}

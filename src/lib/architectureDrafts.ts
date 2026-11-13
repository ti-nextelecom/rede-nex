import type { ArchitectureProject } from './architectureApi';
export interface ArchitectureDraft { key:string;ownerId:string;project:ArchitectureProject;savedAt:string;dirty:boolean }
const DATABASE='nex-architecture-drafts-v1';
const memory=new Map<string,ArchitectureDraft>();
function open():Promise<IDBDatabase> {return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,2);request.onupgradeneeded=()=>{for(const name of ['drafts','cadSources'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'key'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Armazenamento bloqueado por outra janela.'));});}
async function run<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore)=>IDBRequest<T>,storeName='drafts'):Promise<T> {
  const db=await open();try{return await new Promise<T>((resolve,reject)=>{const transaction=db.transaction(storeName,mode),request=work(transaction.objectStore(storeName));transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});}finally{db.close();}
}
export async function putCadSource(ownerId:string,sha256:string,file:File){await run('readwrite',store=>store.put({key:`${ownerId}:${sha256}`,ownerId,sha256,file,name:file.name}),'cadSources');}
export async function getCadSource(ownerId:string,sha256:string):Promise<{file:Blob;name:string}|null>{const source=await run<{ownerId:string;file:Blob;name:string}|undefined>('readonly',store=>store.get(`${ownerId}:${sha256}`),'cadSources');return source?.ownerId===ownerId?source:null;}
const key=(ownerId:string,id:string)=>`${ownerId}:${id}`;
export async function getArchitectureDraft(ownerId:string,id:string){const cached=memory.get(key(ownerId,id));if(cached)return cached;const draft=await run<ArchitectureDraft|undefined>('readonly',store=>store.get(key(ownerId,id))).catch(()=>null);return draft?.ownerId===ownerId?draft:null;}
export async function putArchitectureDraft(ownerId:string,project:ArchitectureProject,dirty=true){const draft={key:key(ownerId,project.id),ownerId,project,savedAt:new Date().toISOString(),dirty};memory.set(draft.key,draft);return run('readwrite',store=>store.put(draft)).then(()=>true).catch(()=>false);}
export function removeArchitectureDraft(ownerId:string,id:string){memory.delete(key(ownerId,id));return run('readwrite',store=>store.delete(key(ownerId,id)));}
export async function listArchitectureDrafts(ownerId:string){const rows=await run<ArchitectureDraft[]>('readonly',store=>store.getAll()).catch(()=>[]);const merged=new Map(rows.map(item=>[item.key,item]));for(const [id,draft] of memory)merged.set(id,draft);return [...merged.values()].filter(item=>item.ownerId===ownerId&&item.dirty).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));}

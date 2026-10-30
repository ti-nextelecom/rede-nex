// Private administrative importer. Never serve these HTMLs or their extracted data.
// JSON.parse + a constrained literal parser only: NO eval, vm or browser execution.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { addMonths, validDate } from '../../shared/hr.mjs';
import { hrTransaction, hrAccess, saveHrRecord, validateHrRecord } from '../src/hr.js';
const nameKey = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export function extractData(html) {
  if (html.length>5000000) throw new Error('Esboço excede o limite de 5 MB.');
  const match=/\bconst\s+DATA\s*=\s*(\[[\s\S]*?\]);/.exec(html);
  if(!match) throw new Error('Bloco DATA não encontrado.');
  const rows=JSON.parse(match[1]);
  if(!Array.isArray(rows) || rows.length>2500)throw new Error('Lista DATA inválida.');
  return rows;
}
export function extractDefaults(html) {
  const match=/\bconst\s+DEFAULTS\s*=\s*\{\s*\n([\s\S]*?)^\s*\};/m.exec(html);if(!match)return {};
  const result={};
  for(const line of match[1].split(/\r?\n/).filter(l=>l.trim())){
    const row=/^\s*'([a-z0-9_-]+)'\s*:\s*\{([^{}]*)\}\s*,?\s*$/i.exec(line);
    if(!row)throw new Error('DEFAULTS contém conteúdo não reconhecido; revise manualmente.');
    const plan={};let remainder=row[2];
    remainder=remainder.replace(/\b(inicio|mes)\s*:\s*'(\d{4}-\d{2}(?:-\d{2})?)'/g,(_,key,value)=>{plan[key]=value;return '';});
    remainder=remainder.replace(/\b(gozo|abono)\s*:\s*(\d+)/g,(_,key,value)=>{plan[key]=Number(value);return '';});
    remainder=remainder.replace(/\bpendente\s*:\s*(true|false)/g,(_,value)=>{plan.pendente=value==='true';return '';});
    if(remainder.replace(/[,\s]/g,''))throw new Error('Programação contém expressão não literal.');
    result[row[1]]=plan;
  }
  return result;
}
export function mapPrototypes(asoHtml,vacationHtml,userMap={}) {
  const asos=extractData(asoHtml), vacations=extractData(vacationHtml), defaults=extractDefaults(vacationHtml);
  const people=new Map(), entries=[], problems=[];let merged=0;
  for(const [source,rows] of [['aso',asos],['vacations',vacations]]){
    const seen=new Set(), sourceIds=new Set();
    rows.forEach((row,index)=>{
      try {
        if(!row || typeof row.nome!=='string' || !row.id || String(row.id).length>100)throw new Error('Identificação ausente.');
        const mappedUser=userMap[source+':'+row.id];
        if(mappedUser && !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(mappedUser))throw new Error('UUID de usuário inválido no mapa.');
        const key=mappedUser ? 'user:'+mappedUser : nameKey(row.nome);if(seen.has(key) || sourceIds.has(String(row.id)))throw new Error('Nome, usuário ou identificador duplicado no mesmo esboço.');seen.add(key);sourceIds.add(String(row.id));
        let person=people.get(key);
        if(!person){person={key,employee:{ user_id:mappedUser,full_name:row.nome,short_name:row.curto || '',team:row.team || '',needs_review:!!row.nf },sources:[]};people.set(key,person);}else merged++;
        if(source==='aso')Object.assign(person.employee,{area:row.area || '',company:row.empresa || '',position:row.cargo || '',admission_on:row.adm || null});
        if(source==='vacations')Object.assign(person.employee,{employee_code:row.nf ? null : String(row.id),needs_review:person.employee.needs_review || !!row.nf});
        const sourceKey={source:'hr-'+source+'-html-v1',id:String(row.id)};person.sources.push(sourceKey);
        if(source==='aso'){
          const body={employee_id:'00000000-0000-4000-8000-000000000001',last_exam_on:row.ult || null,periodicity_months:Number(row.per) || 12,scheduled_on:row.dia || null,planned_month:row.mes ? row.mes+'-01' : null,completed_on:row.realizado || null,notes:row.obs || ''};
          validateHrRecord('asos',body);entries.push({person:key,source:sourceKey,table:'asos',body});
        }else {
          if(!Array.isArray(row.periods))throw new Error('Períodos de férias inválidos.');
          const selected=row.periods.findIndex(p=>p.tipo==='vencido');
          row.periods.forEach((period,periodIndex)=>{
            if(!validDate(period.ini) || !validDate(period.fim))throw new Error('Período aquisitivo inválido.');
            const plan=periodIndex===(selected<0 ? 0 : selected) ? defaults[row.id] || {} : {};
            const body={employee_id:'00000000-0000-4000-8000-000000000001',acquisition_start:period.ini,acquisition_end:period.fim,concession_end:addMonths(period.fim,12),source_start_limit:period.limite || null,
              balance_days:String(period.saldo),leave_days:plan.gozo ?? Math.max(1,Math.min(30,Math.floor(Number(period.saldo)))),bonus_days:plan.abono || 0,
              start_on:plan.inicio || null,planned_month:plan.mes ? plan.mes+'-01' : null,awaiting_employee:plan.pendente || false,status:plan.inicio || plan.mes ? 'planned' : 'draft',notes:''};
            validateHrRecord('vacations',body);entries.push({person:key,source:sourceKey,table:'vacations',body});
          });
        }
      }catch(error){problems.push({source,row:index+1,message:error.message});}
    });
  }
  for(const person of people.values())try{validateHrRecord('employees',{...person.employee,user_id:person.employee.user_id || '00000000-0000-4000-8000-000000000001'});}catch(error){problems.push({source:'cadastro',row:[...people.keys()].indexOf(person.key)+1,message:error.message});}
  return {people:[...people.values()],entries,report:{asoSourceRows:asos.length,vacationSourceRows:vacations.length,employees:people.size,matchedNames:merged,unlinkedUsers:[...people.values()].filter(p=>!p.employee.user_id).length,asoRecords:entries.filter(e=>e.table==='asos').length,vacationPeriods:entries.filter(e=>e.table==='vacations').length,needsReview:[...people.values()].filter(p=>p.employee.needs_review).length,problems}};
}
export async function applyPrototypeImport(pool,actorId,mapped) {
  if(mapped.report.problems.length)throw new Error('Corrija as pendências do dry-run antes de importar.');
  if(mapped.people.some(person=>!person.employee.user_id))throw new Error('Informe --user-map com o UUID existente de cada colaborador. Nenhum cadastro independente será criado.');
  return hrTransaction(pool,actorId,async client=>{
    if(!(await hrAccess(client)).admin)throw new Error('A importação exige um Administrador ativo.');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('nex_hr.initial-import'))");
    let inserted=0,skipped=0;
    for(const person of mapped.people){
      const linked=[];
      for(const source of person.sources){const existing=(await client.query('SELECT employee_id FROM nex_hr.import_keys WHERE source=$1 AND source_id=$2',[source.source,source.id])).rows[0];if(existing)linked.push(existing.employee_id);}
      if(new Set(linked).size>1)throw new Error('Vínculos de importação conflitantes; nenhuma alteração aplicada.');
      // An already imported person is never overwritten by a new HTML snapshot.
      if(linked.length){
        if(linked.length!==person.sources.length)throw new Error('Importação parcial anterior: revise os vínculos antes de continuar.');
        const previous=(await client.query('SELECT user_id FROM nex_hr.employees WHERE id=$1',[linked[0]])).rows[0];
        if(previous?.user_id!==person.employee.user_id)throw new Error('O mapa alterou um vínculo já importado. Revise antes de continuar; nenhum dado foi sobrescrito.');
        skipped++;continue;
      }
      const employee=await saveHrRecord(client,'employees',person.employee);
      for(const source of person.sources)await client.query('INSERT INTO nex_hr.import_keys VALUES($1,$2,$3)',[source.source,source.id,employee.id]);
      for(const entry of mapped.entries.filter(e=>e.person===person.key))await saveHrRecord(client,entry.table,{...entry.body,employee_id:employee.id});
      inserted++;
    }
    return {insertedEmployees:inserted,skippedAlreadyImported:skipped};
  });
}
async function main(){
  const args=process.argv.slice(2);const option=key=>{const index=args.indexOf(key);return index>=0 ? args[index+1] : null;};
  const asoPath=option('--aso'),vacationPath=option('--vacations');
  if(!asoPath || !vacationPath)throw new Error('Uso: node server/scripts/import-hr-prototypes.mjs --aso "arquivo.html" --vacations "arquivo.html" [--user-map "vinculos.json"] [--apply --accept-name-matches --actor UUID]. Sem --apply apenas analisa.');
  const mapPath=option('--user-map');const userMap=mapPath ? JSON.parse(await readFile(mapPath,'utf8')) : {};
  if(!userMap || typeof userMap!=='object' || Array.isArray(userMap))throw new Error('Mapa de usuários inválido.');
  const mapped=mapPrototypes(await readFile(asoPath,'utf8'),await readFile(vacationPath,'utf8'),userMap);
  console.log(JSON.stringify({mode:args.includes('--apply') ? 'apply' : 'dry-run',...mapped.report},null,2));
  if(!args.includes('--apply'))return;
  if(!args.includes('--accept-name-matches'))throw new Error('Revise a associação por nome normalizado e informe --accept-name-matches para confirmar. Homônimos devem ser corrigidos antes.');
  const actorId=option('--actor');if(!/^[a-f0-9-]{36}$/i.test(actorId || ''))throw new Error('Informe o UUID do Administrador em --actor.');
  if(!process.env.HR_IMPORT_DATABASE_URL)throw new Error('Defina HR_IMPORT_DATABASE_URL explicitamente para o destino aprovado. DATABASE_URL e arquivos .env não são lidos.');
  const pool=new pg.Pool({connectionString:process.env.HR_IMPORT_DATABASE_URL,connectionTimeoutMillis:5000});
  try{console.log(JSON.stringify(await applyPrototypeImport(pool,actorId,mapped)));}finally{await pool.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(['23505','23503','42501'].includes(error.code) ? 'Conflito de cadastro ou falta de permissão no destino; importação revertida.' : error.message);process.exitCode=1;});

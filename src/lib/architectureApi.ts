import { apiGet, apiPost, apiPut } from './apiClient';
import { validatePlan, type PlanDocument } from '../../shared/architecture.mjs';
export interface ArchitectureMeta { title:string;description:string;client_name:string;address:string;site_type:'house'|'condominium'|'other';is_template:boolean;visibility:'private'|'team';editor_ids:string[];viewer_ids:string[] }
export interface ArchitectureProject extends ArchitectureMeta { id:string;owner_id:string;owner_name?:string;revision:number;document:PlanDocument;preview?:PlanDocument;can_edit:boolean;can_manage:boolean;archived_at:string|null;updated_at:string;created_at:string;floor_count?:number;element_count?:number }
export type ArchitectureSummary=Omit<ArchitectureProject,'document'>;
export const newProjectMeta = ():ArchitectureMeta => ({title:'Novo projeto',description:'',client_name:'',address:'',site_type:'house',is_template:false,visibility:'team',editor_ids:[],viewer_ids:[]});
export async function listArchitecture(archived=false,offset=0) { return (await apiGet<{data:{projects:ArchitectureSummary[];has_more:boolean}}>(`/architecture/projects?archived=${archived?'1':'0'}&offset=${offset}`)).data; }
export async function getArchitecture(id:string) { const project=(await apiGet<{data:ArchitectureProject}>(`/architecture/projects/${encodeURIComponent(id)}`)).data; return {...project,document:validatePlan(project.document)}; }
export async function saveArchitecture(project:ArchitectureProject,ownerId:string) {
  const {title,description,client_name,address,site_type,is_template,visibility,editor_ids,viewer_ids,document}=project;
  const body={title,description,client_name,address,site_type,is_template,visibility,editor_ids,viewer_ids,document:validatePlan(document),expected_revision:project.revision};
  const headers={'X-Nex-User-Id':ownerId};
  const response=project.id.startsWith('local-')?await apiPost<{data:ArchitectureProject}>('/architecture/projects',body,undefined,headers):await apiPut<{data:ArchitectureProject}>(`/architecture/projects/${project.id}`,body,headers);
  return response.data;
}
export async function archiveArchitecture(project:ArchitectureSummary,ownerId:string,archived:boolean) {return (await apiPut<{data:ArchitectureProject}>(`/architecture/projects/${project.id}/archive`,{archived,expected_revision:project.revision},{'X-Nex-User-Id':ownerId})).data;}

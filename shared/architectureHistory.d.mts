import type {PlanDocument} from './architecture.mjs';
export interface PlanState<P>{project:P;past:PlanDocument[];future:PlanDocument[];change:number;savedChange:number}
export type PlanAction<P>={type:'document';document:PlanDocument}|{type:'meta';patch:Partial<P>}|{type:'undo'|'redo'}|{type:'saved';project:P;change:number};
export function createPlanState<P>(project:P,dirty?:boolean):PlanState<P>;
export function planReducer<P extends {document:PlanDocument;id:string;revision:number;updated_at:string}>(state:PlanState<P>,action:PlanAction<P>):PlanState<P>;

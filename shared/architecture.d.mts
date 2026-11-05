export type Point={x:number;y:number};
export type LayerId='structure'|'security'|'network'|'notes';
export type ElementType='wall'|'room'|'door'|'window'|'dimension'|'cable'|'text'|'equipment';
export interface PlanElement extends Point { id:string;type:ElementType;layer:LayerId;rotation:number;label:string;notes?:string;x2?:number;y2?:number;width?:number;height?:number;thickness?:number;color?:string;fontSize?:number;equipment?:string;range?:number;fov?:number;size?:number;model?:string;address?:string }
export interface PlanBackground {src:string;x:number;y:number;width:number;height:number;opacity:number}
export interface PlanFloor {id:string;name:string;elements:PlanElement[];background:PlanBackground|null}
export interface PlanDocument {version:1;units:'m';width:number;height:number;layers:{id:LayerId;visible:boolean;locked:boolean}[];floors:PlanFloor[]}
export const PLAN_LAYERS:{id:LayerId;name:string;color:string}[];
export const EQUIPMENT:{id:string;name:string;code:string;category:string;color:string;layer:LayerId}[];
export const ELEMENT_TYPES:ElementType[];
export function newId():string;
export function round(value:number,precision?:number):number;
export function distance(a:Point,b:Point):number;
export function snapPoint(point:Point,step?:number,enabled?:boolean):Point;
export function formatMetres(value:number):string;
export function constrainLine(start:Point,end:Point,orthogonal:boolean):Point;
export function newPlan(template?:'blank'|'house'|'condominium',id?:()=>string):PlanDocument;
export function validatePlan(input:unknown):PlanDocument;
export function translateElement(element:PlanElement,dx:number,dy:number):PlanElement;
export function elementBounds(element:PlanElement):{x:number;y:number;width:number;height:number};
export function planInventory(document:PlanDocument):{items:{equipment:string;name:string;model:string;quantity:number;floors:string[]}[];cable:number};
export function escapeXml(value:unknown):string;
export function elementSvg(element:PlanElement,options?:{coverage?:boolean}):string;
export function floorSvg(document:PlanDocument,floorId:string,options?:{grid?:boolean;coverage?:boolean;title?:string;includeHidden?:boolean}):string;

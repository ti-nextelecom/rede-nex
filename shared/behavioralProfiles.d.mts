export type BehavioralKey='T'|'A'|'L'|'G'|'F';
export type BehavioralMode='pure'|'traits'|'hybrid'|'blend'|'balanced';
export interface BehavioralQuestion {id:number;text:string;weight:number;dimension:string;options:{key:BehavioralKey;text:string}[]}
export interface BehavioralDefinition {key:string;name:string;icon:string;disc:string;description:string;strengths:string[];attention:string[];color:string;autonomy:string;consistency:string;motivation:string;managerGuide:string;image:string}
export interface BehavioralBadge {profile_key:string;mode:BehavioralMode;dominant_key:BehavioralKey;secondary_key:BehavioralKey|null;components:BehavioralKey[]}
export interface BehavioralResult extends BehavioralBadge {version:string;display_name:string;icon:string;color:string;scores:Record<BehavioralKey,number>;percentages:Record<BehavioralKey,number>;total_weight:number;ratio:number;ties:BehavioralKey[];profile:BehavioralDefinition;component_profiles:BehavioralDefinition[];autonomy:{scores:Record<BehavioralKey,number>;key:BehavioralKey;message:string};responsibility:{scores:Record<BehavioralKey,number>;key:BehavioralKey;message:string}}
export interface BehavioralQuestionnaire {version:string;source_sha256:string;questions:BehavioralQuestion[];hybrid_threshold:number;traits_threshold:number;tie_order:BehavioralKey[]}
export const BEHAVIORAL_VERSION:string;
export const BEHAVIORAL_KEYS:BehavioralKey[];
export const BEHAVIORAL_MODES:BehavioralMode[];
export const BEHAVIORAL_HYBRIDS:Record<string,string>;
export const DIMENSION_LABELS:Record<string,string>;
export const BEHAVIORAL_QUESTIONS:BehavioralQuestion[];
export const BEHAVIORAL_PROFILES:Record<string,BehavioralDefinition>;
export const BEHAVIORAL_SOURCE:{file:string;sha256:string;questionCount:number;profileCount:number;assets:Record<string,{url:string;bytes:number;sha256:string}>};
export function behavioralAnswers(input:unknown,options?:{complete?:boolean}):Partial<Record<number,BehavioralKey>>;
export function behavioralQuestionnaireSnapshot():BehavioralQuestionnaire;
export function scoreBehavioralProfile(input:unknown):BehavioralResult;
export function behavioralBadge(result:BehavioralResult):BehavioralBadge;
export function behavioralIdentity(value:BehavioralBadge|null|undefined):{name:string;icon:string;color:string;image:string;combination:string}|null;

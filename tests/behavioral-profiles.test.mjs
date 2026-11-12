import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {behavioralAnswers,behavioralBadge,behavioralIdentity,behavioralQuestionnaireSnapshot,BEHAVIORAL_KEYS,BEHAVIORAL_PROFILES,BEHAVIORAL_QUESTIONS,BEHAVIORAL_SOURCE,BEHAVIORAL_VERSION,scoreBehavioralProfile} from '../shared/behavioralProfiles.mjs';
const all=key=>Object.fromEntries(BEHAVIORAL_QUESTIONS.map(question=>[question.id,key]));
const pair=(a,b,split=10)=>Object.fromEntries(BEHAVIORAL_QUESTIONS.map((question,index)=>[question.id,index<split?a:b]));
test('v22 questions and weights match the reviewed questionnaire and preserve all ten original image assets',async()=>{
  assert.equal(BEHAVIORAL_QUESTIONS.length,20);assert.deepEqual(BEHAVIORAL_QUESTIONS.map(question=>question.id),Array.from({length:20},(_,index)=>index+1));
  assert.equal(BEHAVIORAL_QUESTIONS.reduce((sum,question)=>sum+question.weight,0),29.5);assert.equal(Object.keys(BEHAVIORAL_PROFILES).length,10);assert.equal(BEHAVIORAL_SOURCE.sha256,'v22-quiz-fix-revisado-v3');assert.equal(BEHAVIORAL_VERSION,'nex-v22-quiz-fix-v1.0');assert.equal(createHash('sha256').update(JSON.stringify(BEHAVIORAL_QUESTIONS)).digest('hex'),'d09fc51728a962965930476c86aed41a1dcf2e7f82f956242371a7e6fae1d9c8');
  for(const question of BEHAVIORAL_QUESTIONS){assert.deepEqual(question.options.map(option=>option.key),BEHAVIORAL_KEYS);assert.ok(question.text&&question.options.every(option=>option.text));}
  for(const asset of Object.values(BEHAVIORAL_SOURCE.assets)){const image=await readFile(new URL('../public'+asset.url,import.meta.url));assert.equal(image.length,asset.bytes);assert.equal(createHash('sha256').update(image).digest('hex'),asset.sha256);}
});
test('five base profiles follow the original weighted totals',()=>{
  for(const key of BEHAVIORAL_KEYS){const result=scoreBehavioralProfile(all(key));assert.equal(result.profile_key,key);assert.equal(result.mode,'pure');assert.equal(result.scores[key],29.5);assert.equal(result.percentages[key],100);assert.equal(result.secondary_key,null);assert.equal(result.version,BEHAVIORAL_VERSION);}
});
test('the five original combinations and secondary traits keep the source thresholds',()=>{
  for(const[a,b,expected]of [['A','L','orca'],['G','L','cisne'],['T','G','leao'],['A','T','onca'],['T','F','puma']]){const result=scoreBehavioralProfile(pair(a,b));assert.equal(result.profile_key,expected);assert.equal(result.mode,'hybrid');assert.deepEqual(result.components,[a,b]);assert.ok(result.ratio>=82);}
  const traits=scoreBehavioralProfile(pair('T','A',11));assert.equal(traits.mode,'traits');assert.equal(traits.profile_key,'T');assert.match(traits.display_name,/traços/);assert.ok(traits.ratio>=65&&traits.ratio<82);
  const dominant=scoreBehavioralProfile(pair('T','A',14));assert.equal(dominant.mode,'pure');
});
test('unmapped combinations and three-way ties remain explicit instead of assigning an arbitrary animal',()=>{
  const blended=scoreBehavioralProfile(pair('L','F'));assert.equal(blended.mode,'blend');assert.equal(blended.display_name,'Lobo + Falcão');assert.equal(blended.profile_key,'combined');
  const remaining=[13,13,13,10,10],questions=[...BEHAVIORAL_QUESTIONS].sort((a,b)=>b.weight-a.weight),answers={};
  const failed=new Set(); function place(index){const state=index+':'+remaining.join(',');if(failed.has(state))return false;if(index===questions.length)return remaining.every(value=>value===0);const question=questions[index],weight=question.weight*2;for(let key=0;key<5;key++){if(remaining[key]<weight)continue;remaining[key]-=weight;answers[question.id]=BEHAVIORAL_KEYS[key];if(place(index+1))return true;remaining[key]+=weight;}failed.add(state);return false;}
  assert.ok(place(0));const balanced=scoreBehavioralProfile(answers);assert.equal(balanced.mode,'balanced');assert.deepEqual(balanced.ties,['T','A','L']);assert.equal(balanced.display_name,'Tigre + Águia + Lobo');
});
test('incomplete, unknown and malformed responses cannot produce a result',()=>{
  assert.throws(()=>scoreBehavioralProfile({1:'T'}),error=>error.statusCode===400);assert.throws(()=>behavioralAnswers([]));assert.throws(()=>behavioralAnswers({...all('T'),21:'A'}));assert.throws(()=>behavioralAnswers({...all('T'),1:'unknown'}));assert.throws(()=>behavioralAnswers({...all('T'),email:'someone@example.invalid'}));
  assert.deepEqual(behavioralAnswers({1:'T',2:null}),{1:'T'});
});
test('public identity contains no answers or scores; questionnaire snapshots cannot mutate the source',()=>{
  const result=scoreBehavioralProfile(pair('A','L')),badge=behavioralBadge(result),identity=behavioralIdentity(badge);assert.equal(identity.name,'Orca');assert.equal(identity.combination,'Águia + Lobo');assert.equal('answers'in badge,false);assert.equal('scores'in badge,false);assert.equal('profile'in badge,false);assert.equal(behavioralIdentity({dominant_key:'unknown',mode:'pure'}),null);
  const snapshot=behavioralQuestionnaireSnapshot(),before=BEHAVIORAL_QUESTIONS[0].text;snapshot.questions[0].text='changed';assert.equal(BEHAVIORAL_QUESTIONS[0].text,before);assert.equal(snapshot.version,BEHAVIORAL_VERSION);
});

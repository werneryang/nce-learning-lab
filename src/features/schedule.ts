import type { Mastery, Rating, Skill } from '../shared/schema';
const steps=[1,3,7,14,30];
export function schedule(chunkId:string,skill:Skill,rating:Rating,previous?:Mastery,at=new Date()):Mastery{
 const repetitions=rating==='again'?0:(previous?.repetitions||0)+1;
 let interval=rating==='again'?0:steps[Math.min(repetitions-1,4)];
 if(repetitions>5)interval=30*Math.pow(1.5,repetitions-5);
 if(rating==='hard')interval=Math.max(1,Math.floor(interval/2));if(rating==='easy')interval=Math.ceil(interval*1.5);
 const due=new Date(at);if(!interval)due.setMinutes(due.getMinutes()+10);else due.setDate(due.getDate()+interval);
 return {chunkId,skill,repetitions,intervalDays:interval,lastRating:rating,lastReviewedAt:at.toISOString(),dueAt:due.toISOString()};
}
export function dueQueue(mastery:Mastery[],at=new Date()){return mastery.filter(m=>m.dueAt&&new Date(m.dueAt)<=at).sort((a,b)=>(a.dueAt||'').localeCompare(b.dueAt||''));}

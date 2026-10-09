import type {Chunk,State} from '../shared/schema';
import {now} from '../shared/schema';
export const chunkKey=(c:Pick<Chunk,'canonical'|'senseKey'>)=>`${c.canonical.trim().toLowerCase().replace(/\s+/g,' ')}::${c.senseKey.trim().toLowerCase()}`;
export function acceptChunk(state:State,candidate:Chunk,lessonId:string,segmentIds:string[]=[],exampleText?:string):State{
 const existing=state.chunks.find(c=>chunkKey(c)===chunkKey(candidate));const chunk=existing||{...candidate,createdAt:now(),updatedAt:now()};
 return {...state,chunks:existing?state.chunks:[...state.chunks,chunk],links:state.links.some(l=>l.lessonId===lessonId&&l.chunkId===chunk.id)?state.links:[...state.links,{lessonId,chunkId:chunk.id,importance:2,segmentIds}],examples:exampleText&&!state.examples.some(x=>x.chunkId===chunk.id&&x.text===exampleText)?[...state.examples,{id:crypto.randomUUID(),chunkId:chunk.id,text:exampleText,provenance:'project_original'}]:state.examples};
}
export function mergeChunks(state:State,fromId:string,toId:string):State{
 const from=state.chunks.find(c=>c.id===fromId),to=state.chunks.find(c=>c.id===toId);if(!from||!to||fromId===toId)throw new Error('Select two distinct existing cards.');if(from.senseKey!==to.senseKey)throw new Error('Different senses cannot be merged. Edit or retain separate cards.');
 const links=state.links.map(l=>({...l,chunkId:l.chunkId===fromId?toId:l.chunkId})).filter((l,i,all)=>all.findIndex(x=>x.lessonId===l.lessonId&&x.chunkId===l.chunkId)===i);
 const mastery=state.mastery.map(m=>({...m,chunkId:m.chunkId===fromId?toId:m.chunkId})).filter((m,i,all)=>all.findIndex(x=>x.chunkId===m.chunkId&&x.skill===m.skill)===i);
 return {...state,chunks:state.chunks.filter(c=>c.id!==fromId),links,mastery,examples:state.examples.map(e=>({...e,chunkId:e.chunkId===fromId?toId:e.chunkId})),mistakes:state.mistakes.map(m=>({...m,chunkId:m.chunkId===fromId?toId:m.chunkId})),sessions:state.sessions.map(s=>({...s,targetChunkIds:[...new Set(s.targetChunkIds.map(id=>id===fromId?toId:id))]}))};
}

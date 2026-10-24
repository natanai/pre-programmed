import type { PremidiComposition, PremidiInstrument, PremidiNote } from "./premidi-schema.js";
export function audition(instrument:PremidiInstrument,pitch:number):Promise<void>;
export function play(score:PremidiComposition|(()=>PremidiComposition),options?:{
 loop?:boolean|(()=>boolean);onPosition?:(bar:number,step:number)=>void;onStop?:()=>void;
}):Promise<{stop():void}>;
export function stepEvents(score:PremidiComposition,absoluteStep:number):Array<{
 instrument:PremidiInstrument;note:PremidiNote;barIndex:number;step:number
}>;
export function wav(doc:PremidiComposition):Promise<Blob>;
export function secondsPerStep(doc:PremidiComposition):number;

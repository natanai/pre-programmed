import type { PremidiComposition, PremidiTrack } from "./premidi-schema.js";
export function audition(track:PremidiTrack,pitch:number):Promise<void>;
export function play(doc:PremidiComposition,options?:{loop?:boolean;onPosition?:(bar:number,step:number)=>void;onStop?:()=>void}):Promise<{stop():void}>;
export function wav(doc:PremidiComposition):Promise<Blob>;
export function secondsPerStep(doc:PremidiComposition):number;

/** Vendored runtime contract from natanai/pre-midi/schema.js, version 1. Keep in sync with upstream. */
export interface PremidiNote { id:string; pitch:number; start:number; duration:number; velocity:number; }
export interface PremidiPattern { id:string; name:string; notes:PremidiNote[]; }
export interface PremidiTrack { id:string; name:string; waveform:"sine"|"triangle"|"square"|"sawtooth"; volume:number; attack:number; release:number; patterns:PremidiPattern[]; arrangement:(string|null)[]; }
export interface PremidiComposition { format:"pre-midi"; version:1; id:string; title:string; bpm:number; beatsPerBar:4; stepsPerBeat:4; bars:number; tracks:PremidiTrack[]; }
export const FORMAT:"pre-midi";
export const VERSION:1;
export const WAVES:readonly string[];
export function validate(value:unknown):string[];
export function parse(raw:string):PremidiComposition;
export function filename(doc:PremidiComposition,extension:string):string;

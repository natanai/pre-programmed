/** Vendored pre-midi v2 contract. Matches natanai/pre-midi/schema.js. */
export interface PremidiNote { id:string; pitch:number; start:number; duration:number; velocity:number; }
export interface PremidiChunk { id:string; name:string; notes:PremidiNote[]; }
export interface PremidiInstrument {
  id:string; name:string; waveform:"sine"|"triangle"|"square"|"sawtooth";
  volume:number; attack:number; release:number;
  chunks:PremidiChunk[]; timeline:(string|null)[];
}
export interface PremidiComposition {
  format:"pre-midi"; version:2; id:string; title:string;
  bpm:number; beatsPerBar:4; stepsPerBeat:4; bars:number;
  instruments:PremidiInstrument[];
}
export const FORMAT:"pre-midi";
export const VERSION:2;
export const WAVES:readonly string[];
export function validate(value:unknown):string[];
export function parse(raw:string):PremidiComposition;
export function filename(doc:PremidiComposition,extension:string):string;
export function clone<T>(value:T):T;
export function makeChunk(name?:string):PremidiChunk;
export function makeInstrument(n?:number,bars?:number):PremidiInstrument;
export function create():PremidiComposition;

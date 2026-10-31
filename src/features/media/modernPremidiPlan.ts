/**
 * Experimental, playback-only pre-midi adapter. Intentionally independent of
 * the game's persisted v2 music contract: it must never rewrite .ppgame data.
 *
 * Studio source contracts: pre-midi schema.js v7 and songModel.js v8,
 * arrangement.js phraseInstances/eventsAtStep, soundModel.js resolveEvent.
 *
 * Unsupported sound features are rejected before ANY voice is scheduled.
 * This is a measured compatibility slice, NOT general sound-fidelity parity.
 */
export type PrototypeOscillator = {
  wave: "sine" | "triangle" | "square" | "sawtooth";
  level: number; octave: number; detune: number;
};
export type PrototypePatch = {
  type:"synth"; version:1; oscillators:PrototypeOscillator[];
  noise:number;
  filter:{type:"lowpass"|"highpass"|"bandpass"|"notch";cutoff:number;resonance:number;sweep?:number};
  envelope:{attack:number;decay:number;sustain:number;release:number};
  pan:number;
};
export type PrototypeEvent = {
  step:number; time:number; duration:number; pitch:number; velocity:number;
  level:number; patch:PrototypePatch;
  beatId:string; trackId:string|null; clipId:string|null;
  instrumentId:string; soundId:string;
};
export type PrototypePlan = {
  version:7|8; kind:"beat"|"song"; title:string; bpm:number;
  durationSteps:number; durationSeconds:number; events:PrototypeEvent[];
  capabilities:readonly string[];
};
const MAX_BEAT_BYTES=1_000_000, MAX_SONG_BYTES=8_000_000;
const MAX_EVENTS=16_384, MAX_DURATION_SECONDS=900;
const object=(v:unknown):v is Record<string,any>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
const finite=(v:unknown,lo:number,hi:number):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=lo&&v<=hi;
const integer=(v:unknown,lo:number,hi:number):v is number=>Number.isInteger(v)&&finite(v,lo,hi);
function requireFeature(condition:unknown,reason:string):asserts condition{
 if(!condition)throw Error("Modern pre-midi preview: "+reason);
}
function name(value:unknown):value is string{return typeof value==="string"&&value.length>0&&value.length<=128;}
function supportedPatch(value:unknown):PrototypePatch{
 requireFeature(object(value)&&value.type==="synth","sample instruments require an Asset resolver (not implemented)");
 requireFeature(value.version===1||value.version===undefined,"v2 sound modulation is not implemented");
 requireFeature(Array.isArray(value.oscillators)&&value.oscillators.length===2,"expected a two-oscillator patch");
 const types=["sine","triangle","square","sawtooth"];
 for(const osc of value.oscillators){
  requireFeature(object(osc)&&types.includes(osc.wave),"harmonic/custom oscillators are not yet supported");
  requireFeature(finite(osc.level,0,1)&&integer(osc.octave,-2,2)&&finite(osc.detune,-100,100),"invalid oscillator settings");
 }
 requireFeature(value.noise===0,"noise synthesis is not yet supported");
 requireFeature(object(value.filter)&&["lowpass","highpass","bandpass","notch"].includes(value.filter.type)&&
  finite(value.filter.cutoff,50,14000)&&finite(value.filter.resonance,.1,16),"invalid or unsupported filter");
 requireFeature((value.filter.sweep??0)===0,"filter sweep is not implemented");
 requireFeature(object(value.envelope)&&finite(value.envelope.attack,0,3)&&finite(value.envelope.decay,0,3)&&
  finite(value.envelope.sustain,0,1)&&finite(value.envelope.release,.01,4),"invalid ADSR envelope");
 requireFeature(finite(value.pan,-1,1),"invalid pan");
 requireFeature(!value.effects||((value.effects.drive??0)===0&&(value.effects.delayMix??0)===0),
  "drive and feedback delay are not yet supported");
 const motion=value.movement;
 requireFeature(!motion||((motion.glide??0)===0&&(motion.depth??0)===0&&
  (motion.tremolo??0)===0&&(motion.tone??0)===0),
  "glide, vibrato, tremolo and tone movement are not yet supported");
 requireFeature(!value.modulation,"modulation routes are not yet supported");
 requireFeature(!value.bend||value.bend.shape==="straight","patch pitch bends are not yet supported");
 return value as PrototypePatch;
}
function prepareBeat(beat:unknown){
 requireFeature(object(beat)&&beat.format==="pre-midi"&&beat.version===7&&!beat.kind,
  "this prototype supports v7 Beats and v8 Songs only");
 requireFeature(name(beat.id)&&name(beat.title)&&integer(beat.bpm,40,240)&&
  integer(beat.bars,1,16)&&beat.beatsPerBar===4&&beat.stepsPerBeat===4,
  "invalid Beat identity, BPM or meter");
 requireFeature(Array.isArray(beat.samples)&&beat.samples.length===0,
  "external recorded sample Assets are not implemented");
 requireFeature(Array.isArray(beat.instruments)&&beat.instruments.length>=1&&beat.instruments.length<=12,
  "invalid Beat instrument count");
 const instruments:{data:any;sounds:Map<string,any>;chunks:Map<string,any>}[]=[];
 for(const inst of beat.instruments){
  requireFeature(object(inst)&&name(inst.id)&&["pitched","rack"].includes(inst.layout)&&
   finite(inst.volume,0,1)&&!inst.automation,"unsupported instrument or automation");
  requireFeature(Array.isArray(inst.sounds)&&inst.sounds.length>0&&inst.sounds.length<=64&&
   (inst.layout!=="pitched"||inst.sounds.length===1),"invalid Sound count");
  const sounds=new Map<string,any>();
  for(const sound of inst.sounds){
   requireFeature(object(sound)&&name(sound.id)&&!sounds.has(sound.id)&&finite(sound.gain,0,1)&&
    integer(sound.referencePitch,0,127)&&sound.trigger===(inst.layout==="rack"?"hit":"pitched"),
    "invalid Sound or Rack identity");
   supportedPatch(sound.patch);sounds.set(sound.id,sound);
  }
  requireFeature(Array.isArray(inst.chunks)&&inst.chunks.length<=32&&inst.chunks.length>0,
   "invalid Chunk count");
  const chunks=new Map<string,any>();
  for(const chunk of inst.chunks){
   requireFeature(object(chunk)&&name(chunk.id)&&!chunks.has(chunk.id)&&
    Array.isArray(chunk.notes)&&chunk.notes.length<=2048,"invalid Chunk identity or length");
   for(const note of chunk.notes){
    requireFeature(object(note)&&name(note.id)&&integer(note.start,0,15)&&
     integer(note.duration,1,16)&&finite(note.velocity,0,1),"invalid Chunk note timing");
    requireFeature(!note.bend,"per-note pitch movement is not yet supported");
    if(inst.layout==="pitched")requireFeature(integer(note.pitch,0,127),"invalid note pitch");
    else requireFeature(sounds.has(note.soundId),"Rack hit refers to an unknown Sound");
   }
   chunks.set(chunk.id,chunk);
  }
  requireFeature(Array.isArray(inst.timeline)&&inst.timeline.length===beat.bars,
   "invalid instrument timeline");
  requireFeature(!inst.timeline.some((id:unknown)=>id!==null&&!chunks.has(id as string)),
   "instrument timeline has a missing Chunk");
  requireFeature(inst.placements===undefined||(Array.isArray(inst.placements)&&inst.placements.length===beat.bars),
   "invalid instrument placements");
  instruments.push({data:inst,sounds,chunks});
 }
 return {data:beat,instruments};
}
type BeatEvent={step:number;instrument:any;sound:any;note:any};
function compileBeatEvents(prepared:ReturnType<typeof prepareBeat>):BeatEvent[]{
 const out:BeatEvent[]=[],beat=prepared.data;
 const maxStep=beat.bars*16;
 // Compile the authored Chunk placements once. The previous per-step scan
 // multiplied work by every Song Clip and by every 16th-step of playback.
 for(const {data:inst,chunks,sounds} of prepared.instruments){
  for(let bar=0;bar<beat.bars;bar++){
   const chunk=chunks.get(inst.timeline[bar]);if(!chunk)continue;
   const p=inst.placements?.[bar];
   const offset=p?.offset??0,length=p?.length??16,every=p?.every??16,repeats=p?.repeats??1;
   requireFeature(integer(offset,0,15)&&integer(length,1,16)&&integer(every,1,256)&&
    integer(repeats,1,32),"invalid Chunk placement");
   for(let repeat=0;repeat<repeats;repeat++){
    const at=bar*16+offset+every*repeat;
    if(at>=maxStep)break;
    for(const note of chunk.notes)if(note.start<length){
     const step=at+note.start;
     if(step>=maxStep)continue;
     const sound=inst.layout==="rack"?sounds.get(note.soundId):inst.sounds[0];
     if(sound)out.push({step,instrument:inst,sound,note});
     requireFeature(out.length<=MAX_EVENTS,"Beat exceeds event budget");
    }
   }
  }
 }
 return out.sort((a,b)=>a.step-b.step);
}
function planInput(input:unknown){
 requireFeature(object(input)&&input.format==="pre-midi","not a pre-midi document");
 if(input.kind==="song"){
  requireFeature(input.version===8,"this prototype supports Song v8 only (not v10/v12/v14)");
  requireFeature(name(input.title)&&integer(input.bpm,40,240)&&Array.isArray(input.beats)&&
   input.beats.length>0&&input.beats.length<=64,"invalid Song metadata");
  requireFeature(Array.isArray(input.recordings)&&input.recordings.length===0,
   "vocal recordings and Assets are not yet supported");
  requireFeature(Array.isArray(input.tracks)&&input.tracks.length>0&&input.tracks.length<=64,
   "invalid Song Tracks");
  const beats=new Map<string,ReturnType<typeof prepareBeat>>();
  for(const b of input.beats){const prepared=prepareBeat(b);
   requireFeature(!beats.has(prepared.data.id),"duplicate Beat identity");
   beats.set(prepared.data.id,prepared);
  }
  let durationSteps=0,clipCount=0;
  for(const track of input.tracks){
   requireFeature(object(track)&&track.kind==="beat"&&name(track.id)&&Array.isArray(track.clips),
    "vocal or invalid Song Track is not supported");
   for(const clip of track.clips){
    clipCount++;
    requireFeature(clipCount<=256,"Song exceeds the 256-Clip preview limit");
    requireFeature(object(clip)&&name(clip.id)&&beats.has(clip.beatId)&&
     integer(clip.startStep,0,4096)&&integer(clip.lengthSteps,1,4096),"invalid Song Beat Clip");
    durationSteps=Math.max(durationSteps,clip.startStep+clip.lengthSteps);
   }
  }
  return {kind:"song" as const,version:8 as const,data:input,beats,durationSteps};
 }
 const beat=prepareBeat(input);
 return {kind:"beat" as const,version:7 as const,data:input,
  beats:new Map([[beat.data.id,beat]]),durationSteps:beat.data.bars*16};
}
export function planModernPremidi(input:unknown):PrototypePlan{
 const source=planInput(input);
 const bpm=source.data.bpm,unit=60/bpm/4;
 requireFeature(source.durationSteps*unit<=MAX_DURATION_SECONDS,"preview exceeds the 15-minute duration bound");
 const events:PrototypeEvent[]=[];
 const compiled=new Map([...source.beats].map(([id,beat])=>[id,compileBeatEvents(beat)]));
 const add=(event:BeatEvent,step:number,beatId:string,trackId:string|null,clipId:string|null)=>{
  const {note,sound,instrument}=event,patch=sound.patch as PrototypePatch;
  const duration=instrument.layout==="rack"?
   Math.max(.015,patch.envelope.attack+patch.envelope.decay):note.duration*unit;
  events.push({step,time:step*unit,duration,pitch:instrument.layout==="rack"?sound.referencePitch:note.pitch,
   velocity:note.velocity,level:instrument.volume*sound.gain,patch,
   beatId,trackId,clipId,instrumentId:instrument.id,soundId:sound.id});
  requireFeature(events.length<=MAX_EVENTS,"score exceeds the 16,384-event preview limit");
 };
 if(source.kind==="beat"){
  for(const event of compiled.values().next().value!)add(event,event.step,source.data.id,null,null);
 }else for(const track of source.data.tracks)for(const clip of track.clips){
  const prepared=source.beats.get(clip.beatId)!;
  const eventsInBeat=compiled.get(clip.beatId)!;
  const beatLength=prepared.data.bars*16;
  for(let offset=0;offset<clip.lengthSteps;offset+=beatLength){
   for(const event of eventsInBeat){
    const step=clip.startStep+offset+event.step;
    if(event.step+offset>=clip.lengthSteps)break;
    add(event,step,clip.beatId,track.id,clip.id);
   }
  }
 }
 events.sort((a,b)=>a.step-b.step);
 return {version:source.version,kind:source.kind,title:source.data.title,bpm,
  durationSteps:source.durationSteps,durationSeconds:source.durationSteps*unit,
  events,capabilities:["v7 synth Beat","v8 Beat Clips","two simple oscillator slots","ADSR","static filter","pan","Chunk placements","synthetic Racks"]};
}
export function parseModernPremidi(raw:string):PrototypePlan{
 requireFeature(typeof raw==="string"&&new TextEncoder().encode(raw).byteLength<=MAX_SONG_BYTES,
  "file exceeds the 8 MB prototype import limit");
 const object=JSON.parse(raw);
 const allowed=object?.kind==="song"?MAX_SONG_BYTES:MAX_BEAT_BYTES;
 requireFeature(new TextEncoder().encode(raw).byteLength<=allowed,"Beat exceeds the 1 MB import limit");
 return planModernPremidi(object);
}

import type {PrototypeEvent,PrototypePlan} from "../modernPremidiPlan";

/**
 * Limited proof of playback and compiled footprint. The studio Web Audio
 * renderer remains the acoustic reference; this host does NOT claim full PCM
 * parity for its static filter and two-oscillator subset.
 *
 * Loaded only when an author explicitly auditions a modern score.
 * The ordinary legacy v2 music engine and persistent Media actions are intact.
 */
export type ModernPreviewSession={stop:()=>void;finished:Promise<void>};
function levelAt(e:PrototypeEvent,peak:number,elapsed:number){
 const {attack,decay,sustain}=e.patch.envelope,a=Math.max(.002,attack);
 if(elapsed<a)return peak*elapsed/a;
 if(decay<=0)return peak*sustain;
 if(elapsed<a+decay)return peak*(1-(1-sustain)*(elapsed-a)/decay);
 return peak*sustain;
}
export async function playModernPremidi(plan:PrototypePlan):Promise<ModernPreviewSession>{
 const context=new AudioContext();
 try{await context.resume();}catch(err){void context.close();throw err;}
 const master=context.createGain();
 master.gain.value=.85;master.connect(context.destination);
 const offset=context.currentTime+.065;
 let cursor=0,finished=false,timer:ReturnType<typeof setInterval>|undefined;
 const sources=new Set<OscillatorNode>();
 let resolveFinished:()=>void=()=>{};
 const done=new Promise<void>(r=>{resolveFinished=r});
 let latestTail=offset+plan.durationSeconds;
 function stop(){
  if(finished)return;finished=true;
  if(timer!==undefined)clearInterval(timer);
  const now=context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(Math.max(0,master.gain.value),now);
  master.gain.linearRampToValueAtTime(0,now+.02);
  for(const oscillator of sources){
   try{oscillator.stop(now+.03);}catch{ /* may already have an end scheduled */ }
  }
  setTimeout(()=>{try{master.disconnect();}catch{}void context.close();},80);
  resolveFinished();
 }
 function schedule(e:PrototypeEvent){
  const start=offset+e.time,off=start+e.duration,release=e.patch.envelope.release;
  latestTail=Math.max(latestTail,off+release+.04);
  const {filter:cutoff,envelope,oscillators}=e.patch;
  const sum=oscillators.reduce((n,o)=>n+o.level,0);
  if(sum===0||e.velocity===0||e.level===0)return;
  const normal=1/Math.max(1,sum),peak=Math.max(.000001,Math.min(.31,e.level*e.velocity*.27)*normal);
  const filter=context.createBiquadFilter();filter.type=cutoff.type;
  filter.frequency.setValueAtTime(Math.min(context.sampleRate/2,cutoff.cutoff),start);
  // Browser low/high pass resonance is expressed in dB, as in the studio.
  filter.Q.value=cutoff.type==="lowpass"||cutoff.type==="highpass"?Math.max(.001,10**(cutoff.resonance/20)):cutoff.resonance;
  const env=context.createGain();env.gain.setValueAtTime(0,start);
  const attackEnd=start+Math.max(.002,envelope.attack),decayEnd=attackEnd+envelope.decay;
  const releaseLevel=levelAt(e,peak,off-start);
  if(off<attackEnd)env.gain.linearRampToValueAtTime(releaseLevel,off);
  else{
   env.gain.linearRampToValueAtTime(peak,attackEnd);
   if(off<decayEnd)env.gain.linearRampToValueAtTime(releaseLevel,off);
   else if(envelope.decay>0)env.gain.linearRampToValueAtTime(peak*envelope.sustain,decayEnd);
   else env.gain.setValueAtTime(peak*envelope.sustain,attackEnd);
  }
  env.gain.setValueAtTime(releaseLevel,off);
  env.gain.linearRampToValueAtTime(.000001,off+release);
  const pan=context.createStereoPanner();pan.pan.value=e.patch.pan;
  filter.connect(env);env.connect(pan);pan.connect(master);
  let alive=0;
  const disconnect=()=>{alive--;if(alive!==0)return;
   filter.disconnect();env.disconnect();pan.disconnect();};
  for(const slot of oscillators){
   if(slot.level===0)continue;
   const osc=context.createOscillator(),volume=context.createGain();
   osc.type=slot.wave;
   osc.frequency.setValueAtTime(Math.min(context.sampleRate/2,440*2**((e.pitch-69)/12+slot.octave)),start);
   osc.detune.setValueAtTime(slot.detune,start);
   volume.gain.value=slot.level;
   osc.connect(volume);volume.connect(filter);
   alive++;sources.add(osc);
   osc.onended=()=>{sources.delete(osc);osc.disconnect();volume.disconnect();disconnect();};
   osc.start(start);osc.stop(off+release+.015);
  }
 }
 function tick(){
  if(finished)return;
  try{
   const ahead=context.currentTime+.14;
   while(cursor<plan.events.length&&offset+plan.events[cursor].time<ahead){
    const e=plan.events[cursor++];
    // Keep this isolated adapter bounded; do not continue with dropped voices.
    if(sources.size>=128)throw Error("Modern preview exceeded 64 simultaneous two-oscillator notes");
    schedule(e);
   }
   if(cursor===plan.events.length&&context.currentTime>latestTail+.08)stop();
  }catch(error){stop();console.error("Modern pre-midi preview failed",error);}
 }
 timer=setInterval(tick,24);tick();
 return {stop,finished:done};
}

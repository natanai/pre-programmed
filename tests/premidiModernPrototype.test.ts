import { describe,expect,it } from "vitest";
import {parse as parseLegacy } from "../src/features/media/vendor/premidi-schema.js";
import { parseModernPremidi,planModernPremidi } from "../src/features/media/modernPremidiPlan";

const patch=()=>({
 format:"pre-midi-patch",type:"synth",version:1,presetId:"init",
 oscillators:[{wave:"triangle",level:.8,octave:0,detune:0},
  {wave:"sine",level:.2,octave:0,detune:0}],
 noise:0,noiseDecay:0,
 filter:{type:"lowpass",cutoff:8000,resonance:.7,sweep:0,sweepTime:.2},
 envelope:{attack:.01,decay:.16,sustain:.65,release:.2},
 movement:{glide:0,glideTime:.18,rate:5,depth:0,delay:0,
  tremolo:0,tremoloRate:5,tone:0,toneRate:2},
 effects:{drive:0,delayMix:0,delayTime:.24,delayFeedback:.26},
 pan:0,bend:{shape:"straight",amount:2,rate:4},
});
const note=(pitch:number,start:number,ref:string)=>({
 id:ref,pitch,start,duration:3,velocity:.8,
});
const createBeat=()=>{
 const ch={id:"phrase-a",name:"Phrase",notes:[note(60,0,"n1"),note(64,4,"n2")]};
 const second={id:"phrase-b",name:"Offset",notes:[note(72,0,"n3")]};
 return {
  format:"pre-midi",version:7,id:"beat-1",title:"Prototype",
  bpm:120,beatsPerBar:4,stepsPerBeat:4,bars:3,samples:[],
  instruments:[
   {id:"i1",name:"Main",volume:.7,layout:"pitched",sounds:[
    {id:"sound-1",name:"Triangle",trigger:"pitched",referencePitch:60,gain:1,patch:patch()}],
    chunks:[ch],timeline:["phrase-a","phrase-a",null],placements:[null,null,null]},
   {id:"i2",name:"Offset",volume:.5,layout:"pitched",sounds:[
    {id:"sound-2",name:"Sine",trigger:"pitched",referencePitch:60,gain:1,patch:patch()}],
    chunks:[second],timeline:["phrase-b",null,null],
    placements:[{offset:8,length:12,every:12,repeats:3},null,null]},
  ],
 };
};
describe("experimental modern pre-midi playback-only boundary",()=>{
 it("preserves exact 16th-step placement offsets, repetitions and active Chunks",()=>{
  const beat=createBeat();
  const plan=planModernPremidi(beat);
  expect(plan.kind).toBe("beat");
  expect(plan.version).toBe(7);
  expect(plan.events.map(e=>e.step)).toEqual([0,4,8,16,20,20,32]);
  expect(plan.events.filter(e=>e.instrumentId==="i2").map(e=>e.step)).toEqual([8,20,32]);
  expect(plan.events[0].time).toBe(0);
  expect(plan.events[1].time).toBe(.5);
  expect(plan.events[0].patch.oscillators[0].wave).toBe("triangle");
 });
 it("preserves Song clip identities, overlap and repeat without rendering audio bytes",()=>{
  const beat=createBeat();
  const song={
   format:"pre-midi",kind:"song",version:8,id:"song-1",title:"Layered",
   bpm:120,recordings:[],beats:[beat],
   tracks:[
    {id:"t1",kind:"beat",name:"Original",clips:[
     {id:"c1",beatId:"beat-1",startStep:0,lengthSteps:48}]},
    {id:"t2",kind:"beat",name:"Repeats",clips:[
     {id:"c2",beatId:"beat-1",startStep:16,lengthSteps:96}]},
   ],
  };
  const plan=parseModernPremidi(JSON.stringify(song));
  expect(plan.version).toBe(8);
  expect(plan.durationSteps).toBe(112);
  const layered=plan.events.filter(e=>e.step===16&&e.instrumentId==="i1");
  expect(layered).toHaveLength(2);
  expect(layered.map(e=>e.clipId).sort()).toEqual(["c1","c2"]);
  expect(plan.events.some(e=>e.step===64&&e.clipId==="c2")).toBe(true);
  expect(JSON.stringify(plan)).not.toMatch(/base64|pcm|audioData/);
 });
 it("explicitly refuses unsupported versions, samples, modulation and movement",()=>{
  const version=createBeat();
  expect(()=>planModernPremidi({...version,version:9})).toThrow(/v7 Beats/);
  const sample=createBeat();sample.instruments[0].sounds[0].patch={
   type:"sample",presetId:"piano",zones:[{assetId:"piano",root:60}]
  } as ReturnType<typeof patch>;
  expect(()=>planModernPremidi(sample)).toThrow(/sample instruments/);
  const moved=createBeat();moved.instruments[0].sounds[0].patch.movement.depth=17;
  expect(()=>planModernPremidi(moved)).toThrow(/vibrato/);
  expect(()=>planModernPremidi({...version,kind:"song",version:14})).toThrow(/v8 only/);
 });
 it("does not reinterpret modern scores as legacy saved v2 documents",()=>{
  expect(()=>parseLegacy(JSON.stringify(createBeat()))).toThrow(/v2/);
  expect(()=>parseModernPremidi(" ".repeat(1_000_001))).toThrow(/1 MB/);
  expect(()=>parseModernPremidi(JSON.stringify(createBeat()))).not.toThrow();
 });
});

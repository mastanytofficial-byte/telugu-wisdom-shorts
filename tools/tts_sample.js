// Builds the full narrated voice track for one curated story (no video, no upload).
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const sr=require('../story_render.js');
const idx=Number(process.env.STORY_INDEX||0);
const q=JSON.parse(fs.readFileSync(path.join(__dirname,'..','curated_quotes.json'),'utf8')).filter(x=>x.story)[idx];
const dir=path.join(__dirname,'..','tts_work');fs.mkdirSync(dir,{recursive:true});
const v=sr.buildVoice([q.hook,...q.story],dir,console.log,['edge:te-IN-ShrutiNeural'],0);
if(!v){console.log('FAILED');process.exit(1)}
fs.mkdirSync(path.join(__dirname,'..','out'),{recursive:true});
execFileSync('ffmpeg',['-y','-i',v.voicePath,path.join(__dirname,'..','out','story_voice.mp3')],{stdio:'pipe'});
console.log('ok',v.durs.map(d=>d.toFixed(1)).join(','),q.title);

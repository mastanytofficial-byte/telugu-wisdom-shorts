// Story-mode renderer: narrated Telugu storytelling Short.
// Each beat = one text page, timed to the Telugu voiceover (edge-tts, then gTTS fallback).
// If no TTS engine works the video is still produced as paced text-only (logged clearly).
const {execFileSync,execSync}=require('child_process');
const fs=require('fs'),path=require('path');

function dur(file){return parseFloat(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'}).trim())}

function synthOne(engine,text,out,log){
  try{
    if(engine.startsWith('sarvam:')){
      const py="import sys,json,base64,urllib.request\nreq=urllib.request.Request('https://api.sarvam.ai/text-to-speech',data=json.dumps({'text':sys.argv[1],'language_code':'te-IN','model':sys.argv[4],'speaker':sys.argv[3],'pace':1.0,'speech_sample_rate':24000,'output_audio_codec':'wav'}).encode(),headers={'Content-Type':'application/json','api-subscription-key':sys.argv[5]})\nr=json.loads(urllib.request.urlopen(req,timeout=60).read())\nopen(sys.argv[2],'wb').write(base64.b64decode(r['audios'][0]))";
      execFileSync('python3',['-c',py,text,out,engine.slice(7),process.env.SARVAM_MODEL||'bulbul:v4-flash',process.env.SARVAM_API_KEY],{stdio:'pipe',timeout:90000});
    }else if(engine.startsWith('edge:')){
      execFileSync('python3',['-m','edge_tts','--voice',engine.slice(5),'--rate=+4%','--text',text,'--write-media',out],{stdio:'pipe',timeout:90000});
    }else{
      execFileSync('python3',['-c','import sys;from gtts import gTTS;gTTS(sys.argv[1],lang="te").save(sys.argv[2])',text,out],{stdio:'pipe',timeout:90000});
    }
    return fs.existsSync(out)&&fs.statSync(out).size>1000;
  }catch(e){log(`${engine} failed: ${String((e.stderr&&e.stderr.toString())||e.message).slice(-300)}`);return false}
}

const ROLE={hook:{rate:'+0%',pitch:'+2Hz'},mid:{rate:'-8%',pitch:'-3Hz'},last:{rate:'-14%',pitch:'-6Hz'}};
function wavOf(src,dst,padSec){execFileSync('ffmpeg',['-y','-i',src,'-ar','24000','-ac','1','-af',`apad=pad_dur=${padSec}`,dst],{stdio:'pipe'})}
// Edge voices: synthesize clause by clause with role-specific rate/pitch and natural pauses.
function synthBeatEdge(voice,text,role,dir,i,log){
  const clauses=text.split(/(?<=[,.!?])\s+/).filter(Boolean),wavs=[],{rate,pitch}=ROLE[role];
  for(let k=0;k<clauses.length;k++){
    const c=clauses[k],mp3=path.join(dir,`b${i}_c${k}.mp3`),wav=path.join(dir,`b${i}_c${k}.wav`);
    try{execFileSync('python3',['-m','edge_tts','--voice',voice,`--rate=${rate}`,`--pitch=${pitch}`,'--text',c,'--write-media',mp3],{stdio:'pipe',timeout:90000})}catch(e){log(`edge clause failed: ${String((e.stderr&&e.stderr.toString())||e.message).slice(-200)}`);return null}
    if(!fs.existsSync(mp3)||fs.statSync(mp3).size<500)return null;
    wavOf(mp3,wav,/[.!?]$/.test(c)?0.45:0.22);wavs.push(wav);
  }
  const list=path.join(dir,`b${i}_list.txt`);fs.writeFileSync(list,wavs.map(w=>`file '${w}'`).join('\n'));
  const out=path.join(dir,`beat${i}_${voice}.wav`);
  execFileSync('ffmpeg',['-y','-f','concat','-safe','0','-i',list,'-c','copy',out],{stdio:'pipe'});return out;
}
function synthAll(texts,dir,log,engines){
  for(const engine of engines){
    const files=[];let ok=true;
    for(let i=0;i<texts.length;i++){const role=i===0?'hook':(i===texts.length-1?'last':'mid');if(engine.startsWith('edge:')){const f=synthBeatEdge(engine.slice(5),texts[i],role,dir,i,log);if(!f){ok=false;break}files.push(f);continue}const f=path.join(dir,`beat${i}_${engine.replace(/[^a-zA-Z0-9]/g,'_')}.mp3`);if(!synthOne(engine,texts[i],f,log)){ok=false;break}files.push(f)}
    if(ok){log(`VOICE engine: ${engine} (${files.length} beats)`);return {engine,files}}
  }
  log('VOICE: no TTS engine worked, falling back to text-only paced video');return null;
}

const POLISH='highpass=f=70,equalizer=f=180:t=h:w=200:g=3,equalizer=f=3500:t=q:w=1:g=-2,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5,aecho=0.8:0.85:25:0.12';
function buildVoice(beats,WORK_DIR,log,engines,tailSec){
  const voice=synthAll(beats,WORK_DIR,log,engines);if(!voice)return null;
  const wavs=[],durs=[];
  voice.files.forEach((f,i)=>{const w=path.join(WORK_DIR,`pad${i}.wav`);execFileSync('ffmpeg',['-y','-i',f,'-af','apad=pad_dur=0.3','-ar','44100','-ac','2',w],{stdio:'pipe'});wavs.push(w);durs.push(dur(w))});
  if(tailSec){const sil=path.join(WORK_DIR,'sil.wav');execFileSync('ffmpeg',['-y','-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t',String(tailSec),sil],{stdio:'pipe'});wavs.push(sil)}
  const vl=path.join(WORK_DIR,'voice_list.txt');fs.writeFileSync(vl,wavs.map(w=>`file '${w}'`).join('\n'));
  const raw=path.join(WORK_DIR,'voice_raw.wav');execFileSync('ffmpeg',['-y','-f','concat','-safe','0','-i',vl,'-c','copy',raw],{stdio:'pipe'});
  const vo=path.join(WORK_DIR,'voice.wav');
  try{execFileSync('ffmpeg',['-y','-i',raw,'-af',POLISH,'-ar','44100','-ac','2',vo],{stdio:'pipe'})}catch(e){log('polish failed, using raw voice');fs.copyFileSync(raw,vo)}
  return {engine:voice.engine,durs,voicePath:vo};
}
async function renderStory({bg,bgIsVideo,q,top,deps}){
  const {puppeteer,CHROME_PATH,FRAMES_DIR,WORK_DIR,pageHtml,pickBgm,log,escapeHtml}=deps;
  const engines=deps.engines||[...(process.env.SARVAM_API_KEY?['sarvam:'+(process.env.SARVAM_SPEAKER||'kavitha_te_narration')]:[]),...(process.env.STORY_VOICE?['edge:'+process.env.STORY_VOICE]:[]),'edge:te-IN-ShrutiNeural','edge:te-IN-MohanNeural','gtts'];
  fs.mkdirSync(FRAMES_DIR,{recursive:true});
  const beats=[q.hook,...q.story];
  const voice=buildVoice(beats,WORK_DIR,log,engines,2.6);
  const durs=beats.map((b,i)=>voice?voice.durs[i]:Math.max(2.5,b.length*0.075));
  const fsFor=(t,isHook)=>isHook?(t.length<=22?128:t.length<=34?112:t.length<=48?96:82):(t.length<=70?76:t.length<=110?66:t.length<=150?58:52);
  const browser=await puppeteer.launch({headless:'new',executablePath:CHROME_PATH,args:['--no-sandbox','--disable-setuid-sandbox']});
  const timeline=[];let ctaPath,lastBody='';
  try{
    const page=await browser.newPage();await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});
    for(let i=0;i<beats.length;i++){
      const t=beats[i];let body;
      if(i===0)body=`<div class="hookPill"><span class="hookTxt" style="font-size:${fsFor(t,true)}px">${escapeHtml(t)}</span></div>`;
      else if(i===beats.length-1)body=`<span style="font-size:${fsFor(t,false)}px;line-height:1.4;color:#ffd21f">${escapeHtml(t)}</span>`;
      else body=`<span style="font-size:${fsFor(t,false)}px;line-height:1.4">${escapeHtml(t)}</span>`;
      lastBody=body;
      await page.setContent(pageHtml(body,top,'','boxClear'),{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
      const p=path.join(FRAMES_DIR,`story_${i}.png`);await page.screenshot({path:p,omitBackground:true});
      timeline.push({path:p,duration:durs[i]});
    }
    const cta=`<div class="cta"><div class="ctaBox">రోజూ ఒక కొత్త కథ కావాలా?<span class="ctaSub">Subscribe 🔔</span></div></div>`;
    await page.setContent(pageHtml(lastBody,top,cta,'boxClear'),{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    ctaPath=path.join(FRAMES_DIR,'story_cta.png');await page.screenshot({path:ctaPath,omitBackground:true});
    timeline.push({path:ctaPath,duration:2.6});
  }finally{await browser.close()}
  const lines=[];for(const f of timeline){lines.push(`file '${f.path}'`);lines.push(`duration ${f.duration.toFixed(3)}`)}lines.push(`file '${timeline.at(-1).path}'`);
  const listFile=path.join(FRAMES_DIR,'story_list.txt');fs.writeFileSync(listFile,lines.join('\n'));
  const totalSeconds=timeline.reduce((s,f)=>s+f.duration,0);
  const voiceInput=voice?`-i "${voice.voicePath}"`:'';
  const out=path.join(WORK_DIR,'output.mp4'),bgmFile=pickBgm();
  const fade=`afade=t=out:st=${Math.max(totalSeconds-0.6,0).toFixed(2)}:d=0.6`;
  const aud=voice?`[1:a]volume=-21dB[mus];[3:a]volume=1.5[vox];[mus][vox]amix=inputs=2:duration=longest:normalize=0,${fade}[a]`:`[1:a]volume=-10dB,${fade}[a]`;
  let bgArgs,vf;
  if(bgIsVideo){bgArgs=`-stream_loop -1 -i "${bg}"`;vf=`[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=-0.22:contrast=1.1:saturation=1.0,fps=25,setsar=1[bg]`}
  else{const fc=Math.round(totalSeconds*25),zs=(.06/fc).toFixed(6);bgArgs=`-loop 1 -i "${bg}"`;vf=`[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+${zs},1.06)':d=${fc}:s=1080x1920:fps=25[bg]`}
  const fc=`${vf};[bg][2:v]overlay=0:0:format=auto[v];${aud}`;
  log(`STORY render: ${beats.length} beats, ${totalSeconds.toFixed(1)}s, voice=${voice?voice.engine:'none'}, BGM: ${path.basename(bgmFile)}`);
  execSync(`ffmpeg -y ${bgArgs} -stream_loop -1 -i "${bgmFile}" -f concat -safe 0 -i "${listFile}" ${voiceInput} -filter_complex "${fc}" -map "[v]" -map "[a]" -t ${totalSeconds.toFixed(2)} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k "${out}"`,{stdio:'inherit'});
  return out;
}
module.exports={renderStory,synthAll,buildVoice,dur};

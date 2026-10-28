// Story-mode renderer: narrated Telugu storytelling Short.
// Each beat = one text page, timed to the Telugu voiceover (edge-tts, then gTTS fallback).
// If no TTS engine works the video is still produced as paced text-only (logged clearly).
const {execFileSync,execSync}=require('child_process');
const fs=require('fs'),path=require('path');

function dur(file){return parseFloat(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'}).trim())}

function synthOne(engine,text,out,log){
  try{
    if(engine.startsWith('edge:')){
      execFileSync('python3',['-m','edge_tts','--voice',engine.slice(5),'--rate=+4%','--text',text,'--write-media',out],{stdio:'pipe',timeout:90000});
    }else{
      execFileSync('python3',['-c','import sys;from gtts import gTTS;gTTS(sys.argv[1],lang="te").save(sys.argv[2])',text,out],{stdio:'pipe',timeout:90000});
    }
    return fs.existsSync(out)&&fs.statSync(out).size>1000;
  }catch(e){log(`${engine} failed: ${String((e.stderr&&e.stderr.toString())||e.message).slice(-300)}`);return false}
}

function synthAll(texts,dir,log,engines){
  for(const engine of engines){
    const files=[];let ok=true;
    for(let i=0;i<texts.length;i++){const f=path.join(dir,`beat${i}_${engine}.mp3`);if(!synthOne(engine,texts[i],f,log)){ok=false;break}files.push(f)}
    if(ok){log(`VOICE engine: ${engine} (${files.length} beats)`);return {engine,files}}
  }
  log('VOICE: no TTS engine worked, falling back to text-only paced video');return null;
}

async function renderStory({bg,bgIsVideo,q,top,deps}){
  const {puppeteer,CHROME_PATH,FRAMES_DIR,WORK_DIR,pageHtml,pickBgm,log,escapeHtml}=deps;
  const engines=deps.engines||[...(process.env.STORY_VOICE?['edge:'+process.env.STORY_VOICE]:[]),'edge:te-IN-ShrutiNeural','edge:te-IN-MohanNeural','gtts'];
  fs.mkdirSync(FRAMES_DIR,{recursive:true});
  const beats=[q.hook,...q.story];
  const voice=synthAll(beats,WORK_DIR,log,engines);
  const durs=beats.map((b,i)=>voice?dur(voice.files[i])+0.3:Math.max(2.5,b.length*0.075));
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
  let voiceInput='';
  if(voice){
    const wavs=[];
    voice.files.forEach((f,i)=>{const w=path.join(WORK_DIR,`beat${i}.wav`);execFileSync('ffmpeg',['-y','-i',f,'-af','apad=pad_dur=0.3','-ar','44100','-ac','2',w],{stdio:'pipe'});wavs.push(w)});
    const sil=path.join(WORK_DIR,'sil.wav');execFileSync('ffmpeg',['-y','-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t','2.6',sil],{stdio:'pipe'});wavs.push(sil);
    const vl=path.join(WORK_DIR,'voice_list.txt');fs.writeFileSync(vl,wavs.map(w=>`file '${w}'`).join('\n'));
    const vo=path.join(WORK_DIR,'voice.wav');execFileSync('ffmpeg',['-y','-f','concat','-safe','0','-i',vl,'-c','copy',vo],{stdio:'pipe'});
    voiceInput=`-i "${vo}"`;
  }
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
module.exports={renderStory,synthAll,dur};

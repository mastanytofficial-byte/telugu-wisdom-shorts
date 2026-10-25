// Decides whether a scheduled run should publish. Several cron triggers exist as backups
// because GitHub drops/delays schedules; this guard allows at most ONE upload per slot per day.
// Slots are judged on the ACTUAL start time (IST), not on which cron fired:
//   Slot A = 12:00-17:59 IST, Slot B = 18:00-03:59 IST (late runs after midnight still count for B).
// Manual (workflow_dispatch) runs always go through.
const fs=require('fs');
const out=(run,why)=>{console.log(`guard: run=${run} (${why})`);if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`run=${run}\n`)};
const IST_MS=5.5*3600e3,SHIFT_MS=4*3600e3;
function slotOf(ms){const t=new Date(ms+IST_MS-SHIFT_MS),h=t.getUTCHours();return{day:t.toISOString().slice(0,10),slot:h>=8&&h<14?'A':h>=14?'B':null}}
function decide(event,nowMs,lastMs){
  if(event!=='schedule')return{run:true,why:'manual trigger'};
  const n=slotOf(nowMs);
  if(!n.slot)return{run:false,why:'outside slot windows (04:00-11:59 IST)'};
  if(lastMs){const l=slotOf(lastMs);if(l.day===n.day&&l.slot===n.slot)return{run:false,why:`slot ${n.slot} of ${n.day} already published`}}
  return{run:true,why:`slot ${n.slot} of ${n.day} not yet published`}
}
module.exports={decide,slotOf};
if(require.main===module){
  let last=0;try{last=Date.parse(JSON.parse(fs.readFileSync('last-article.json','utf8')).lastDate)||0}catch(e){}
  const now=process.env.NOW_ISO?Date.parse(process.env.NOW_ISO):Date.now();
  const d=decide(process.env.EVENT_NAME||'',now,last);out(d.run?'true':'false',d.why)
}

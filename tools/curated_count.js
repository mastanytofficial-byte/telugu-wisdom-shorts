// Prints/sets output refill=true when unused curated quotes <= THRESHOLD.
const fs=require('fs');const list=JSON.parse(fs.readFileSync('curated_quotes.json','utf8'));
const st=JSON.parse(fs.readFileSync('last-article.json','utf8'));const used=st.used||[];
const free=list.filter(c=>!used.some(u=>u&&(u.title===c.title||u.screen===c.screen||u.image===c.image||u.hook===c.hook))).length;
const th=Number(process.env.THRESHOLD||30);const go=free<=th||process.env.FORCE==='true';
console.log(`unused curated: ${free}, threshold ${th}, refill=${go}`);
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`refill=${go}\n`);

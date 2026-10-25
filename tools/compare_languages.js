// No-upload experiment: same Groq models, same request, English vs Telugu output quality.
const KEY=process.env.GROQ_API_KEY;
const MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
const EN='Write 3 different original motivational life-wisdom quotes, 16-30 words each, each one coherent single thought with clear cause and effect, based on everyday situations (e.g. a failed exam, waiting for results, comparing yourself online). Output only the 3 quotes, numbered.';
const TE='Write 3 different original motivational life-wisdom quotes in natural modern spoken Telugu, 16-30 words each, each one coherent single thought with clear cause and effect, based on everyday situations (e.g. a failed exam, waiting for results, comparing yourself online). Output only the 3 quotes, numbered.';
async function ask(model,prompt,maxTok=4000){const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+KEY},body:JSON.stringify({model,temperature:.5,max_tokens:maxTok,messages:[{role:'user',content:prompt}]})});const d=await r.json();return d.choices?.[0]?.message?.content||('ERROR '+r.status+' '+JSON.stringify(d.error||{}).slice(0,200))}
(async()=>{for(const m of MODELS){for(const [lang,p] of [['ENGLISH',EN],['TELUGU',TE]]){console.log(`\n===== ${m} / ${lang} =====`);console.log(await ask(m,p))}}})();

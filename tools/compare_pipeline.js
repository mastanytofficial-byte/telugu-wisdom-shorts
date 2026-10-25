// No-upload experiment: direct Telugu generation vs "think in English, then write Telugu" (two-step).
const KEY=process.env.GROQ_API_KEY,MODEL='openai/gpt-oss-120b';
const CONCEPTS=['a small daily habit that looks pointless today','comparing yourself with someone on social media','how you speak to yourself after a mistake','saying no politely without guilt','waiting for the right time that never comes','handling criticism from people who have done nothing themselves'];
async function ask(prompt,maxTok=3500){for(let a=0;a<3;a++){const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+KEY},body:JSON.stringify({model:MODEL,temperature:.5,max_tokens:maxTok,messages:[{role:'user',content:prompt}]})});const d=await r.json();const t=d.choices?.[0]?.message?.content;if(t)return t.trim();await new Promise(x=>setTimeout(x,3000))}return 'ERROR'}
(async()=>{for(const c of CONCEPTS){
 console.log('\n##### CONCEPT: '+c);
 const A=await ask('Write ONE original motivational life-wisdom quote in natural modern spoken Telugu, 16-30 words, one coherent thought with clear cause and effect, about this everyday situation: "'+c+'". Use a plain direct statement, not a forced metaphor. Output only the Telugu quote.');
 console.log('A (direct Telugu):\n'+A);
 const E=await ask('Write ONE original motivational life-wisdom quote in clear natural English, 16-30 words, one coherent thought with clear cause and effect, about this everyday situation: "'+c+'". Plain direct statement, no forced metaphor. Output only the quote.');
 console.log('B1 (English idea):\n'+E);
 const T=await ask('Rewrite this quote in natural modern SPOKEN Telugu exactly as a native Telugu speaker would say it - NOT word-for-word. Keep the meaning exactly. Use simple common everyday words, short clauses, and correct grammar: objects take the right accusative (nouns ending in ం drop the ం and add ాన్ని, e.g. బలం->బలాన్ని; nouns ending in ి add ని, e.g. శాంతి->శాంతిని), verbs use correct irregular forms (మారుస్తుంది not మార్చుతుంది), no gender-specific first-person forms. 16-30 Telugu words. Output only the Telugu quote.\n\nQuote: '+E);
 console.log('B2 (Telugu from English):\n'+T)}})();

import time, torch, soundfile as sf
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
t0 = time.time()
name = "ai4bharat/indic-parler-tts"
model = ParlerTTSForConditionalGeneration.from_pretrained(name).to("cpu")
tok = AutoTokenizer.from_pretrained(name)
dtok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
print("loaded in", round(time.time() - t0), "s", flush=True)
text = "ఇద్దరు అన్నదమ్ములు ఒక చిన్న సైకిల్ దుకాణం నడుపుతూ, గాలిలో ఎగరాలని కలలు కన్నారు. వాళ్లకు పెద్ద చదువులు లేవు, డబ్బు లేదు, అందరూ నవ్వారు."
for sp in ["Lalitha", "Prakash"]:
    desc = f"{sp}'s voice is warm, expressive and calm, like a storyteller narrating, with clear audio and no background noise, moderate speed."
    t1 = time.time()
    d = dtok(desc, return_tensors="pt")
    p = tok(text, return_tensors="pt")
    with torch.no_grad():
        g = model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask, prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
    a = g.cpu().numpy().squeeze()
    sf.write(f"out/parler_{sp}.wav", a, model.config.sampling_rate)
    print(sp, "generated", round(len(a) / model.config.sampling_rate, 1), "s audio in", round(time.time() - t1), "s", flush=True)

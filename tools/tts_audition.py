import sys, json, base64, urllib.request, os
text = "ఇద్దరు అన్నదమ్ములు ఒక చిన్న సైకిల్ దుకాణం నడుపుతూ, గాలిలో ఎగరాలని కలలు కన్నారు. వాళ్లకు పెద్ద చదువులు లేవు, డబ్బు లేదు, అందరూ నవ్వారు."
key = os.environ.get('SARVAM_API_KEY')
if not key:
    print('no SARVAM_API_KEY set'); sys.exit(0)
for sp in ['kavitha_te_narration', 'tarun_te_narration', 'pooja_te_conversation', 'kavitha_te_conversation']:
    body = {'text': text, 'language_code': 'te-IN', 'model': 'bulbul:v4-flash', 'speaker': sp, 'pace': 1.0, 'speech_sample_rate': 24000, 'output_audio_codec': 'wav'}
    req = urllib.request.Request('https://api.sarvam.ai/text-to-speech', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'api-subscription-key': key})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=60).read())
        open('out/sarvam_' + sp + '.wav', 'wb').write(base64.b64decode(r['audios'][0]))
        print(sp, 'ok')
    except Exception as e:
        print(sp, 'ERR', e, (e.read()[:300] if hasattr(e, 'read') else ''))

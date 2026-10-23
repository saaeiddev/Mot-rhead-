from pathlib import Path
import wave,math,struct,random
root=Path(__file__).resolve().parents[1]/"public"
# Original deterministic instrumental: 16 seconds, 120 BPM, mono 22050 Hz.
random.seed(84);sr=22050;length=16;out=[]
for n in range(sr*length):
 t=n/sr;beat=t%.5;kick=math.sin(2*math.pi*(44*beat+8*(1-math.exp(-beat*25))))*math.exp(-beat*18)*.55
 snaretime=(t-.5)%1;snare=(random.random()*2-1)*math.exp(-snaretime*35)*.22 if snaretime<.14 else 0
 hat=(random.random()*2-1)*math.exp(-(t%.25)*100)*.09
 note=[55,55,65.406,49][int(t//2)%4];env=min(1,(t%.5)*35)*math.exp(-(t%.5)*3)
 bass=(math.sin(2*math.pi*note*t)+.16*math.sin(2*math.pi*note*2*t))*.16*env
 chord=0
 for f in [220,261.626,329.628]: chord+=math.sin(2*math.pi*f*t)*.014*(.6+.4*math.sin(t*.7))
 fade=min(1,t*10,(length-t)*5);v=(kick+snare+hat+bass+chord)*fade;out.append(struct.pack('<h',int(max(-.95,min(.95,v))*32767)))
with wave.open(str(root/'assets'/'demo-beat.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(b''.join(out))

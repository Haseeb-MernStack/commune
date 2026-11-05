"""Synthesises Commune's two notification sounds. Deterministic (seeded) so they can be rebuilt exactly."""
import numpy as np, wave, sys
SR = 44100
rng = np.random.default_rng(7)

def bell(freq, dur, amp=1.0):
    t = np.arange(int(SR*dur))/SR
    # glass-bell partials: (ratio, level, decay seconds)
    parts = [(1.0,1.00,0.55),(2.0,0.34,0.38),(2.76,0.16,0.22),(4.07,0.07,0.14),(5.4,0.03,0.09)]
    y = np.zeros_like(t)
    for r,l,d in parts:
        y += l*np.sin(2*np.pi*freq*r*t + 0.0)*np.exp(-t/d)
    y += 0.22*np.sin(2*np.pi*freq*0.5*t)*np.exp(-t/0.30)   # warm sub body
    atk = np.minimum(1, t/0.004)                            # 4 ms soft attack, no click
    return amp*y*atk

def place(buf, sig, start, pan):
    i = int(start*SR); n = min(len(sig), len(buf)-i)
    l = np.cos((pan+1)*np.pi/4); r = np.sin((pan+1)*np.pi/4)
    buf[i:i+n,0] += sig[:n]*l; buf[i:i+n,1] += sig[:n]*r

def reverb(x, secs=0.9, wet=0.22):
    n = int(SR*secs); t = np.arange(n)/SR
    out = np.zeros_like(x)
    for c in range(2):
        ir = rng.standard_normal(n)*np.exp(-t/0.22)
        ir[:int(.012*SR)] *= np.linspace(0,1,int(.012*SR))
        # damp highs: simple moving-average lowpass
        k = np.ones(6)/6; ir = np.convolve(ir,k,mode="same")
        ir /= np.sqrt((ir**2).sum())
        w = np.convolve(x[:,c], ir)[:len(x)]
        out[:,c] = w
    return x*(1-wet*0.5) + out*wet

def finish(x, tail=0.25, peak_db=-6.0):
    x = np.vstack([x, np.zeros((int(tail*SR),2))])
    # gentle high shelf-ish smoothing + dc removal
    x -= x.mean(0)
    n = len(x); fade = int(0.18*SR)
    x[-fade:] *= np.linspace(1,0,fade)[:,None]**2
    x *= 10**(peak_db/20)/np.abs(x).max()
    return x

def save(name, x):
    pcm = (np.clip(x,-1,1)*32767).astype("<i2")
    with wave.open(name,"wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

# message: two soft rising bells (G5 -> D6), warm and short
m = np.zeros((int(SR*1.4),2))
place(m, bell(783.99,1.2,0.9), 0.00, -0.15)
place(m, bell(1174.66,1.1,1.0), 0.12, 0.15)
save("message.wav", finish(reverb(m)))

# notification: three-note shimmer arpeggio (C6 E6 G6) plus a faint octave sparkle
n = np.zeros((int(SR*1.7),2))
place(n, bell(1046.50,1.3,0.85), 0.00, -0.3)
place(n, bell(1318.51,1.3,0.90), 0.10, 0.0)
place(n, bell(1567.98,1.4,1.00), 0.20, 0.3)
place(n, bell(3135.96,0.8,0.18), 0.20, 0.0)
save("notification.wav", finish(reverb(n, 1.1, 0.26)))

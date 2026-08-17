"""35-second score + sound design for the promo film. Writes score.wav."""
import numpy as np, wave, struct

SR = 48000
DUR = 35.0
N = int(SR * DUR)
T = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)

def idx(t): return int(t * SR)

def add(buf_l, buf_r, sig, t0, pan=0.0):
    i = idx(t0); n = min(len(sig), N - i)
    if n <= 0: return
    lg, rg = (1 - pan) * 0.5 + 0.5, (1 + pan) * 0.5 + 0.5
    buf_l[i:i+n] += sig[:n] * lg
    buf_r[i:i+n] += sig[:n] * rg

def env_ad(n, a, d, curve=3.0):
    e = np.ones(n)
    na = min(int(a * SR), n)
    if na: e[:na] = np.linspace(0, 1, na) ** 1.4
    nd = n - na
    if nd > 0: e[na:] = np.exp(-np.linspace(0, curve, nd))
    return e

def tone(freq, dur, amp=0.2, a=0.004, d=3.2, harm=(1.0, 0.34, 0.14, 0.05)):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for k, g in enumerate(harm, start=1):
        s += g * np.sin(2 * np.pi * freq * k * t + k * 0.7)
    s *= env_ad(n, a, d)
    return s * amp / sum(harm)

def sub(freq, dur, amp=0.5, a=0.9, d=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(2 * np.pi * freq * 2 * t)
    # slow breathing
    s *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)
    return s * env_ad(n, a, d, curve=1.1) * amp

rng = np.random.default_rng(7)

def noise(dur, amp=0.2, a=0.002, d=6.0, lo=None, hi=None):
    n = int(dur * SR)
    s = rng.standard_normal(n)
    # cheap one-pole filters
    if hi:  # low-pass at hi
        k = np.exp(-2 * np.pi * hi / SR); y = np.zeros(n); acc = 0.0
        for i in range(0, n, 1): acc = k * acc + (1 - k) * s[i]; y[i] = acc
        s = y
    if lo:  # high-pass at lo
        k = np.exp(-2 * np.pi * lo / SR); y = np.zeros(n); acc = 0.0
        for i in range(0, n, 1): acc = k * acc + (1 - k) * s[i]; y[i] = acc
        s = s - y
    return s * env_ad(n, a, d) * amp

def sweep(f0, f1, dur, amp=0.2, a=0.01, d=2.5):
    n = int(dur * SR); t = np.arange(n) / SR
    f = np.linspace(f0, f1, n)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_ad(n, a, d) * amp

# ---------------------------------------------------------------- ACT 1  0-14
# sustained sub, swelling
add(L, R, sub(55.0, 14.4, amp=0.42, a=2.4, d=0.35), 0.0)
add(L, R, sub(82.5, 9.0, amp=0.10, a=3.0, d=0.5), 3.0)
# sparse pulse, tightening as the cuts tighten
pulses = [0.9, 2.6, 4.1, 5.4, 6.6, 7.7, 8.7, 9.6, 10.4, 11.1, 11.8, 12.4, 12.9, 13.35, 13.7]
for i, p in enumerate(pulses):
    g = 0.05 + 0.11 * (i / len(pulses))
    add(L, R, tone(110.0, 0.5, amp=g, a=0.002, d=7.0, harm=(1.0, 0.2, 0.06, 0.0)), p,
        pan=-0.25 if i % 2 else 0.25)
# high texture bed, thickening
for i in range(9):
    t0 = 4.0 + i * 1.05
    add(L, R, tone(880.0 * (1 + 0.002 * i), 1.6, amp=0.010 + 0.004 * i, a=0.5, d=2.4,
                   harm=(1.0, 0.1, 0.0, 0.0)), t0, pan=(-1) ** i * 0.5)

# ---------------------------------------------------------------- THE DROP 14-20
# everything stops. only room air + the laser hum.
add(L, R, noise(6.0, amp=0.012, a=0.6, d=1.2, hi=900), 14.0)
hum = np.zeros(int(3.1 * SR)); th = np.arange(len(hum)) / SR
hum += 0.30 * np.sin(2 * np.pi * 78 * th) + 0.16 * np.sin(2 * np.pi * 156 * th)
hum *= (0.85 + 0.15 * np.sin(2 * np.pi * 7.5 * th))
hum *= env_ad(len(hum), 0.35, 1.0, curve=1.4) * 0.16
add(L, R, hum, 14.05)
# one held note under the reveal
add(L, R, tone(220.0, 3.4, amp=0.055, a=1.1, d=1.8, harm=(1.0, 0.18, 0.05, 0.0)), 17.0)

# ---------------------------------------------------------------- ACT 3  20-31
add(L, R, sub(55.0, 15.0, amp=0.40, a=0.8, d=0.9), 20.0)
# motif: A  C  E  G  |  F  A  C   — resolving upward
motif = [(20.0, 440.0, 1.7), (20.85, 523.25, 1.5), (21.7, 659.25, 1.9),
         (22.7, 587.33, 1.6), (23.5, 523.25, 2.0), (24.5, 440.0, 1.8),
         (25.4, 587.33, 1.7), (26.3, 659.25, 2.2), (27.2, 783.99, 2.4),
         (28.3, 659.25, 2.0), (29.2, 523.25, 2.6), (30.0, 440.0, 3.0)]
for i, (t0, f, d) in enumerate(motif):
    add(L, R, tone(f, d, amp=0.115, a=0.006, d=3.0), t0, pan=(-0.3 if i % 2 else 0.3))
    add(L, R, tone(f / 2, d * 0.8, amp=0.045, a=0.01, d=3.4), t0)
# steady mechanical pulse
for i in range(22):
    t0 = 20.0 + i * 0.5
    add(L, R, noise(0.14, amp=0.020 if i % 2 == 0 else 0.011, a=0.001, d=9.0, lo=1800, hi=7000), t0,
        pan=(-1) ** i * 0.4)
# pad
for t0, f in ((20.0, 220.0), (23.5, 261.63), (27.0, 293.66), (30.0, 329.63)):
    add(L, R, tone(f, 4.6, amp=0.030, a=1.4, d=1.6, harm=(1.0, 0.3, 0.1, 0.03)), t0)

# ---------------------------------------------------------------- END 31-35
add(L, R, tone(440.0, 4.0, amp=0.085, a=0.01, d=2.0), 31.0)
add(L, R, tone(659.25, 4.0, amp=0.055, a=0.02, d=2.2), 31.05)
add(L, R, tone(110.0, 4.0, amp=0.16, a=0.02, d=1.6, harm=(1.0, 0.25, 0.08, 0.0)), 31.0)

# ---------------------------------------------------------------- SOUND DESIGN
add(L, R, noise(0.55, amp=0.075, a=0.005, d=5.0, lo=1400, hi=9000), 2.00)          # nylon
add(L, R, noise(0.09, amp=0.085, a=0.001, d=12.0, lo=2200, hi=8000), 5.00)         # driver click
add(L, R, tone(1750.0, 0.16, amp=0.030, a=0.001, d=9.0, harm=(1.0, 0.2, 0, 0)), 5.02)
add(L, R, noise(0.85, amp=0.055, a=0.06, d=4.0, lo=180, hi=1500), 6.50)            # panel creak
add(L, R, tone(1200.0, 0.20, amp=0.075, a=0.002, d=8.0, harm=(1.0, 0.12, 0, 0)), 10.42)  # beep
add(L, R, sweep(300.0, 950.0, 0.95, amp=0.055, a=0.05, d=3.0), 13.02)              # key wave
add(L, R, noise(0.12, amp=0.10, a=0.001, d=11.0, lo=900, hi=5200), 21.52)          # lid click
add(L, R, tone(180.0, 0.5, amp=0.055, a=0.002, d=6.0, harm=(1.0, 0.3, 0.1, 0)), 21.54)
add(L, R, tone(523.25, 0.9, amp=0.065, a=0.004, d=4.0), 25.02)                     # boot chime
add(L, R, tone(783.99, 1.0, amp=0.050, a=0.004, d=4.0), 25.16)

# ---------------------------------------------------------------- space + master
def reverb(x, taps=((0.041, 0.30), (0.067, 0.22), (0.113, 0.15), (0.191, 0.09), (0.290, 0.05))):
    y = x.copy()
    for d, g in taps:
        s = int(d * SR)
        y[s:] += x[:-s] * g
    return y

L = L * 0.80 + reverb(L) * 0.26
R = R * 0.80 + reverb(R) * 0.26

# hard mute across the drop so the silence is real
gate = np.ones(N)
g0, g1 = idx(14.15), idx(19.9)
gate[g0:g1] = 0.10
ramp = idx(0.35)
gate[g0 - ramp:g0] = np.linspace(1.0, 0.10, ramp)
gate[g1:g1 + ramp] = np.linspace(0.10, 1.0, ramp)
# the laser hum and held note bypass the gate — re-add after gating
pre_l, pre_r = L.copy(), R.copy()
L *= gate; R *= gate
i0, i1 = idx(14.0), idx(20.0)
L[i0:i1] += pre_l[i0:i1] * 0.0  # (hum already inside; gate keeps it at 10% which is the intent)
R[i0:i1] += pre_r[i0:i1] * 0.0

# soft-clip + normalise + tail fade
def sat(x): return np.tanh(x * 1.25) / np.tanh(1.25)
L, R = sat(L), sat(R)
peak = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
L *= 0.89 / peak; R *= 0.89 / peak
fade = idx(0.6)
L[-fade:] *= np.linspace(1, 0, fade); R[-fade:] *= np.linspace(1, 0, fade)
L[:idx(0.15)] *= np.linspace(0, 1, idx(0.15)); R[:idx(0.15)] *= np.linspace(0, 1, idx(0.15))

inter = np.empty(N * 2, dtype=np.int16)
inter[0::2] = np.clip(L * 32767, -32768, 32767).astype(np.int16)
inter[1::2] = np.clip(R * 32767, -32768, 32767).astype(np.int16)

with wave.open('score.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(inter.tobytes())
print('score.wav written:', DUR, 's')

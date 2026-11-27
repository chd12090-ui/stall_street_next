"""Render the seated prelude, wooden pickup, three dance phrases and quiet return."""
from pathlib import Path
import json
import subprocess

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 48000
# The frame sheet is also the score for cuts, wood strikes and the last footfall.
score = """
    import {ritualPreludeMs, ritualIntroMs, ritualWoodKnockMs, ritualTakeoffMs, ritualFinaleStartMs,
            ritualFinalHitMs, ritualOutroStartMs, ritualDanceMs, RITUAL_PHRASES} from './src/game/ritual-choreography.mjs';
    import {jackpotRiseNotes, chimeParts} from './src/game/game-audio.mjs';
    let time = ritualIntroMs;
    const bars = RITUAL_PHRASES.map(phrase => {
        const start = time / 1000;
        time += phrase.reduce((sum, [,ms]) => sum + ms, 0);
        return start;
    });
    const notes = jackpotRiseNotes.slice(0,3).map(hz => chimeParts(hz / 2, 1, 1));
    process.stdout.write(JSON.stringify({bars, notes, prelude:ritualPreludeMs / 1000, knock:ritualWoodKnockMs / 1000,
        takeoff:ritualTakeoffMs / 1000, finale:ritualFinaleStartMs / 1000,
        impact:ritualFinalHitMs / 1000, outro:ritualOutroStartMs / 1000, end:ritualDanceMs / 1000}));
"""
cues = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', score], cwd=ROOT))
FINALE, IMPACT, DURATION = cues['finale'], cues['impact'], cues['end']
TAU = 2 * np.pi
rng = np.random.default_rng(704)
wood_rng = np.random.default_rng(116)
mix = np.zeros(round(RATE * DURATION))


def times(seconds):
    return np.arange(round(RATE * seconds)) / RATE


def place(at, sound, level):
    start = round(at * RATE)
    count = min(len(sound), len(mix) - start)
    if count > 0:
        mix[start:start + count] += level * sound[:count]


def wood(at, pitch, decay, level):
    t = times(5 * decay)
    grain = np.convolve(wood_rng.normal(size=len(t)), [.2, .38, .28, .14], mode='same')
    sound = grain * np.exp(-t / .006) * .46
    for ratio, gain, tail in [(1, 1, 1), (1.84, .38, .61), (3.23, .25, .39), (5.47, .13, .21)]:
        phase = TAU * pitch * ratio * (t + .00065 * (1 - np.exp(-t / .009)))
        sound += gain * np.sin(phase) * np.exp(-t / (decay * tail))
    place(at, sound * np.minimum(1, t / .0015), level)


def drum(at, level, bass):
    t = times(.48 if bass else .23)
    root = (111 if bass else 271) * rng.uniform(.96, 1.04)
    phase = TAU * root * (t + .013 * (1 - np.exp(-t / .029)))
    skin = (np.sin(phase) * np.exp(-t / (.12 if bass else .063))
            + .49 * np.sin(phase * 1.61) * np.exp(-t / .056)
            + .2 * np.sin(phase * 2.26) * np.exp(-t / .038))
    stick = np.convolve(rng.normal(0, 1, len(t)), np.ones(7) / 7, mode='same')
    attack = np.minimum(1, t / .0015)
    place(at, attack * (skin + stick * (1 if bass else 2.2) * np.exp(-t / .012)), level)


def brass_bell(at, pitch, level):
    t = times(.54)
    # The separate bells have slightly beating, inharmonic shell resonances.
    strike = np.zeros(len(t))
    for ratio, gain, decay in [(1, .58, .13), (1.44, .31, .095), (2.61, .59, .083),
                               (3.82, .31, .057), (5.21, .14, .038)]:
        frequency = pitch * ratio
        strike += (gain * np.exp(-t / decay) * np.sin(TAU * frequency * t)
                   * (.78 + .22 * np.cos(TAU * (4 + ratio) * t)))
    attack = np.minimum(1, t / .001)
    place(at, attack * strike, level)


def staff(at, level, reverse):
    # Clappers hit in succession as the wrist changes direction.
    bells = [1039, 1297, 1537, 1789]
    if reverse:
        bells.reverse()
    delay = 0
    for pitch in bells:
        brass_bell(at + delay, pitch * rng.uniform(.988, 1.012), level * rng.uniform(.78, 1.05))
        delay += rng.uniform(.009, .020)


def gong(at, level):
    t = times(1.65)
    shell = np.zeros(len(t))
    for pitch, weight, decay in [(156, .73, .72), (226, .42, .68), (389, .29, .53),
                                 (487, .22, .39), (693, .24, .37), (1108, .14, .28)]:
        phase = TAU * pitch * (t + .003 * np.expm1(-t / .16))
        shell += weight * np.sin(phase) * (.83 + .17 * np.cos(TAU * 4.1 * t)) * np.exp(-t / decay)
    place(at, shell * (1 - np.exp(-t / .007)), level)


def low_string(at, pitch, strength, length):
    t = times(length)
    # A short bend at the bridge opens into the pitched body of the note.
    phase = TAU * pitch * (t + .005 * (1 - np.exp(-t / .18)))
    body = (np.sin(phase) * np.exp(-t / .63)
            + .59 * np.sin(2 * phase + .08) * np.exp(-t / .41)
            + .29 * np.sin(3 * phase) * np.exp(-t / .25)
            + .12 * np.sin(5.008 * phase) * np.exp(-t / .13))
    fade = np.minimum(1, (length - t) / .09)
    place(at, body * (1 - np.exp(-t / .021)) * fade, strength)


def recorded_laugh(at):
    # Two close chuckles, then a softer reply from the same take. The source
    # excerpt keeps the performer's timing and leaves out the sharp second cry.
    sound = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(ROOT / 'scripts/audio/ritual-giggle.flac'),
        '-af', 'highpass=f=145,lowpass=f=2850', '-ar', str(RATE),
        '-ac', '1', '-f', 'f32le', 'pipe:1'])
    take = np.frombuffer(sound, dtype='<f4').astype(float)
    for start, stop, rate, delay, level in [(0, .346, .96, 0, .52),
                                            (.346, .720, .89, .442, .57)]:
        phrase = take[round(start * RATE):round(stop * RATE)]
        index = np.arange(0, len(phrase) - 1, rate)
        voice = np.interp(index, np.arange(len(phrase)), phrase)
        voice = np.tanh(voice * 1.8)
        t = np.arange(len(voice)) / RATE
        fade = np.clip(t / .014, 0, 1) * np.clip((t[-1] - t) / .065, 0, 1)
        voice *= .5 - .5 * np.cos(np.pi * fade)
        place(at + delay, voice, level)
        place(at + delay + .057, voice, level * .09)


def low_jackpot(at):
    for parts, (offset, length, level) in zip(cues['notes'], [(0, .47, .28), (.156, .47, .30),
                                                              (.352, .59, .40)]):
        for pitch, duration_ratio, waveform, level_ratio in parts:
            duration = length * duration_ratio
            t = times(duration)
            wave = np.sin(TAU * pitch * t)
            if waveform == 'triangle':
                wave = (2 / np.pi) * np.arcsin(wave)
            envelope = np.exp(np.interp(t, [0, .008, duration],
                                        np.log([.0001, level * level_ratio, .0001])))
            place(at + offset, envelope * wave, 1)


# The seated call is A–D–C. Keep its initial spacing and let C ring under the first knock.
prelude = cues['prelude']
A, C, D, G = 110.0, 130.81, 146.83, 98.0
low_string(.012, A, .135, 1.24)
gong(.060, .038)
low_string(.46 * prelude, D, .12, 1.03)
low_string(.90 * prelude, C, .155, 1.08)
brass_bell(1.06 * prelude, 735, .037)

# A hollow low board resonance, then a short, hard click as the paws leave the floor.
wood(cues['knock'], 192, .084, .52)
wood(cues['takeoff'], 479, .040, .55)
first, second, third = cues['bars']
wood(first - .250, 271, .047, .16)

# Answer before takeoff, cross the first downbeat, then tighten the same figure as the cat turns.
# Overlapping releases connect the plucks; the drums can still articulate the feet independently.
string_phrases = [
    (cues['knock'], [(-.125, A, .148, .94), (.29, D, .148, .84), (.65, C, .157, .84)]),
    (first, [(.25, A, .155, .88), (.67, D, .155, .75), (1.06, C, .172, .74)]),
    (second, [(-.055, A, .164, .78), (.33, D, .17, .62), (.66, C, .173, .60),
              (.98, G, .127, .50), (1.18, A, .155, .62)]),
    (third, [(-.025, D, .177, .77), (.28, 2*A, .123, .34), (.455, 2*C, .126, .33),
             (.65, 2*D, .166, .65), (1.02, 2*C, .14, .42), (1.23, A, .157, .63)]),
    (FINALE, [(-.03, A, .17, .68), (.275, D, .17, .55), (.535, C, .155, .47),
              (.805, D, .122, .55)]),
]
for start, phrase in string_phrases:
    for offset, pitch, level, length in phrase:
        low_string(start + offset, pitch, level, length)

# A single bell becomes a short shake on the way up; the whole staff enters on the bar.
brass_bell(cues['takeoff'] + .155, 1039, .035)
brass_bell(first - .17, 1039, .050)
brass_bell(first - .15, 1297, .036)


def ensemble_level(at):
    rise = min(1., max(0., (at - first) / (second + .65 - first)))
    return .43 + .57 * rise * (2 - rise)


# Two footfalls at .405 and 1.070 within each bar.
shakes = [(0, .46), (.155, .65), (.270, 1), (.445, .58), (.640, .70),
          (.820, 1.12), (1.003, .48), (1.175, .72), (1.331, .55)]
for bar, start in enumerate(cues['bars']):
    for index, (offset, accent) in enumerate(shakes):
        staff(start + offset, .097 * accent * ensemble_level(start + offset), index % 2 == 0)
    for offset, strength in [(0, .67), (.405, 1), (.820, .52), (1.070, .9)]:
        drum(start + offset, .42 * strength * ensemble_level(start + offset), bass=True)
    for offset, strength in [(.155, .53), (.290, .69), (.56, .47), (.685, .56),
                              (.929, .83), (1.213, .58), (1.344, .64)]:
        drum(start + offset, .34 * strength * ensemble_level(start + offset), bass=False)
    if bar == 1:
        drum(start + .512, .125, bass=False)
        staff(start + 1.247, .043, False)
    gong_time = start + (.018 if bar == 0 else .820)
    gong(gong_time, (.17 if bar == 1 else .21) * ensemble_level(gong_time))

# Gather the dancers' rhythm into a tightening drum roll and a high bell lift.
for offset, strength in [(0, .50), (.21, .57), (.405, .62), (.57, .68),
                         (.695, .72), (.795, .76), (.87, .69), (.93, .61)]:
    drum(FINALE + offset, .35 * strength, bass=False)
drum(FINALE + .10, .27, bass=True)
drum(FINALE + .54, .35, bass=True)
for offset, strength, reverse in [(.025, .74, False), (.275, .62, True),
                                  (.575, .79, False), (.83, 1.05, True)]:
    staff(FINALE + offset, .105 * strength, reverse)

# Leave space for the recorded laugh and low triad on the last footfall.
drum(IMPACT, .38, bass=True)
drum(IMPACT + .009, .12, bass=False)
gong(IMPACT + .004, .15)
recorded_laugh(IMPACT - .32)
low_jackpot(IMPACT - .13)
# The step down and the quiet brush of the folded robe close the scene.
low_string(cues['outro'] + .115, G, .065, .73)
wood(cues['outro'] + .425, 154, .065, .108)
t = times(.51)
cloth = np.convolve(wood_rng.normal(size=len(t)), np.ones(27) / 27, mode='same')
place(cues['outro'] + .57, cloth * np.sin(np.pi * t / .51) ** 2 * np.exp(-t / .22), .105)
dry = mix.copy()
for delay, amount in [(.027, .115), (.045, .082), (.076, .064), (.112, .039)]:
    samples = round(delay * RATE)
    mix[samples:] += dry[:-samples] * amount
release = np.clip((DURATION - times(DURATION)) / .16, 0, 1)
mix *= .5 - .5 * np.cos(np.pi * release)
mix = .84 * np.tanh(mix * 1.52)
pcm = np.round(32767 * mix).astype('<i2')
output = ROOT / 'public/audio/ritual.mp3'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(RATE),
                '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-q:a', '5',
                '-map_metadata', '-1', '-id3v2_version', '0', str(output)], input=pcm.tobytes(), check=True)

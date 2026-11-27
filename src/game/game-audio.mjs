import {ritualDanceMs,ritualFinalHitMs} from './ritual-choreography.mjs';
import {rehabilitationPaperImpactMs,rehabilitationSlapImpactMs} from './rehabilitation-motion.mjs';

let context, master, grain, resumePending, muted = false;
let muteVersion = 0;

function audio() {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return null;
  if (!context) {
    context = new Audio();
    master = context.createGain();
    master.gain.value = muted ? 0 : .58;
    master.connect(context.destination);
  }
  return context;
}

function pulse(at, duration, level, attack = .008) {
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(.0001, at);
  envelope.gain.exponentialRampToValueAtTime(level, at + attack);
  envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
  envelope.connect(master);
  return envelope;
}

function tone(at, note, duration, type = 'triangle', level = .09, end = note) {
  const source = context.createOscillator();
  source.type = type;
  source.frequency.setValueAtTime(note, at);
  if (end !== note) source.frequency.exponentialRampToValueAtTime(end, at + duration);
  source.connect(pulse(at, duration, level));
  source.start(at);
  source.stop(at + duration);
  return source;
}

function noise() {
  if (!grain) {
    grain = context.createBuffer(1, Math.ceil(context.sampleRate * 1.6), context.sampleRate);
    const samples = grain.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = grain;
  source.loop = true;
  return source;
}

function rattle(at, duration, frequency, level = .10, {end = frequency, attack = .008} = {}) {
  const source = noise(), filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, at);
  if (end !== frequency) filter.frequency.exponentialRampToValueAtTime(end, at + duration);
  filter.Q.value = .85;
  source.connect(filter);
  filter.connect(pulse(at, duration, level, attack));
  source.start(at);
  source.stop(at + duration);
  return source;
}

function melody(at, notes, beat, duration = .18, type = 'triangle', level = .065) {
  notes.forEach((note, i) => tone(at + i * beat, note, duration, type, level));
}

// The score renderer uses the same two oscillators for the shrine's low jackpot cue.
export function chimeParts(note, duration, level) {
  return [
    [note, duration, 'triangle', level],
    [note * 2.76, duration * .53, 'sine', level * .28],
  ];
}

function chime(at, note, duration, level) {
  return chimeParts(note, duration, level).map(parts => tone(at, ...parts));
}

export const jackpotRiseNotes = Object.freeze([392,494,587,784,988,1175,1568]);

// Recordings live in public/audio and are served from the site root. Resolve them
// against the page URL: bundlers rewrite module URLs to build-time file paths.
const assetUrl = path => new URL(path, globalThis.document?.baseURI ?? globalThis.location?.href ?? 'http://localhost/');

// Before the first gesture, fetch the recording without opening an audio context.
function recording(path) {
  let file, decoded;
  return function load(ctx) {
    if (decoded) return decoded;
    file ??= fetch(assetUrl(path)).then(response => {
      if (!response.ok) throw new Error('Audio recording unavailable');
      return response.arrayBuffer();
    }).catch(error => { file = null; throw error; });
    if (!ctx) return file;
    decoded = file.then(bytes => ctx.decodeAudioData(bytes))
      .catch(error => { decoded = null; throw error; })
      .finally(() => { file = null; });
    return decoded;
  };
}

const paperSample = recording('/audio/page-turn.mp3');
let paperVersion = 0, paperVoice;

export function preparePaperAudio() {
  if (!muted && !globalThis.document?.hidden) void paperSample(context).catch(() => {});
}

export function stopPaperAudio() {
  paperVersion++;
  if (!paperVoice) return;
  paperVoice.onended = null;
  paperVoice.stop();
  paperVoice.disconnect();
  paperVoice = null;
}

function paperTurn(at) {
  if (paperVoice || globalThis.document?.hidden) return;
  const version = ++paperVersion;
  void paperSample(context).then(sample => {
    if (muted || version !== paperVersion || globalThis.document?.hidden) return;
    const source = context.createBufferSource();
    source.buffer = sample;
    source.connect(master);
    source.onended = () => { source.disconnect(); paperVoice = null; };
    source.start(Math.max(at, context.currentTime));
    paperVoice = source;
  }).catch(() => {});
}

const diceMaterials = [
  [[168,.37,.020],[281,.44,.018],[471,.34,.013],[761,.23,.009],[1351,.12,.005],[2347,.08,.003]],
  [[192,.35,.019],[327,.43,.016],[537,.35,.012],[879,.21,.008],[1583,.13,.005],[2821,.09,.003]],
];
const diceSamples = [];

function diceSample(die) {
  const rate = context.sampleRate;
  const duration = .1;
  const buffer = context.createBuffer(1, Math.ceil(rate * duration), rate);
  const samples = buffer.getChannelData(0);
  // Most of the strike comes from the tray's low mids. The edge click dies away first.
  const modes = diceMaterials[die].filter(([frequency]) => frequency < rate * .48);
  const bodySmoothing = 1 - Math.exp(-2 * Math.PI * 2200 / rate);
  const rumbleSmoothing = 1 - Math.exp(-2 * Math.PI * 140 / rate);
  let bodyNoise = 0, rumble = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / rate;
    const noise = Math.random() * 2 - 1;
    bodyNoise += (noise - bodyNoise) * bodySmoothing;
    rumble += (bodyNoise - rumble) * rumbleSmoothing;
    let sample = (bodyNoise - rumble) * .44 * Math.exp(-time / .006);
    for (const [frequency, volume, decay] of modes) {
      sample += volume * Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time / decay);
    }
    sample *= Math.min(1, time / .0005, (duration - time) / .009);
    samples[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  for (let i = 0; i < samples.length; i++) samples[i] *= .72 / peak;
  return buffer;
}

function diceLand(at, detail) {
  const {die, strength = 1} = typeof detail === 'number' ? {die: detail} : detail || {};
  const material = Number(die === 1);
  const source = context.createBufferSource();
  source.buffer = diceSamples[material] ??= diceSample(material);
  source.playbackRate.value = .98 + Math.random() * .035;
  const level = context.createGain();
  level.gain.value = .71 * Math.pow(strength, 1.35);
  source.connect(level);
  level.connect(master);
  source.start(at);
}

const maxPatVoices = 8;
const patVoices = new Set();
let patFile, patSample, patDecode, patRequest = 0;

function loadPatFile() {
  if (!patFile) {
    patFile = fetch(assetUrl('/audio/pat.wav'))
      .then(response => {
        if (!response.ok) throw new Error('Pet sample unavailable');
        return response.arrayBuffer();
      }).catch(error => { patFile = null; throw error; });
  }
  return patFile;
}

function releasePat(source) {
  if (!patVoices.delete(source)) return;
  source.onended = null;
  source.disconnect();
}
function stopPat(source) {
  source.stop();
  releasePat(source);
}

function startPat(at) {
  if (patVoices.size >= maxPatVoices) stopPat(patVoices.values().next().value);
  const source = context.createBufferSource();
  source.buffer = patSample;
  source.connect(master);
  source.onended = () => releasePat(source);
  // The recorded impact follows the first consonant by about 20ms.
  source.start(Math.max(context.currentTime, at + .029));
  patVoices.add(source);
}

function playPat(at) {
  if (patSample) {
    startPat(at);
    return;
  }
  const request = ++patRequest;
  // When decode is still pending, keep only the latest tap so there is no delayed burst.
  patDecode ??= loadPatFile().then(file => context.decodeAudioData(file))
    .then(sample => { patSample = sample; })
    .finally(() => { patFile = null; patDecode = null; });
  void patDecode.then(() => {
    if (!muted && request === patRequest) startPat(at);
  }).catch(() => {});
}

const slotVoices = new Set();
const slotCues = new Set(['lever','reels','reelStop','noBingo','fortune','doubleBingo','jackpot']);
const reelNotes = [392,494,587];
let slotVersion = 0;

function trackSlotVoices(...sources) {
  for (const source of sources) {
    slotVoices.add(source);
    source.onended = () => {
      slotVoices.delete(source);
      source.disconnect();
    };
  }
}

export function stopFortuneAudio() {
  slotVersion++;
  for (const voice of slotVoices) {
    voice.onended = null;
    voice.stop();
    voice.disconnect();
  }
  slotVoices.clear();
}

const ritualSample = recording('/audio/ritual.mp3');
let ritualVoice, ritualVersion = 0;

export function prepareRitualAudio() {
  if (!muted && !globalThis.document?.hidden) void ritualSample(context).catch(() => {});
}

export function stopRitualAudio() {
  ritualVersion++;
  if (!ritualVoice) return;
  ritualVoice.source.stop();
  ritualVoice.release();
}

export async function playRitualAudio(started, reducedMotion = false) {
  stopRitualAudio();
  if (muted || globalThis.document?.hidden) return;
  const version = ritualVersion;
  try {
    const ctx = audio();
    if (!ctx) return;
    const [sample] = await Promise.all([ritualSample(ctx), ctx.state === 'running' || resumeAudio(ctx)]);
    if (version !== ritualVersion || muted || globalThis.document?.hidden) return;
    // Include the lead-in to the chuckle and the whole three-note release.
    const cueStart = reducedMotion ? (ritualFinalHitMs - 395) / 1000 : 0;
    const end = Math.min(ritualDanceMs / 1000, sample.duration);
    const offset = cueStart + Math.max(0, (Date.now() - started) / 1000);
    if (offset >= end) return;
    const source = ctx.createBufferSource(), fade = reducedMotion ? ctx.createGain() : null;
    source.buffer = sample;
    source.connect(fade ?? master);
    if (fade) {
      fade.connect(master);
      fade.gain.value = 0;
      fade.gain.setTargetAtTime(1, ctx.currentTime, .006);
    }
    const release = () => {
      source.onended = null;
      source.disconnect();
      fade?.disconnect();
      if (ritualVoice?.source === source) ritualVoice = null;
    };
    source.onended = release;
    source.start(ctx.currentTime, offset, end - offset);
    ritualVoice = {source,release};
  } catch { /* The dance and its receipt remain usable without audio output. */ }
}

let sliderSample, lastSliderClick = -Infinity;

function makeSliderSample(rate) {
  const sample = context.createBuffer(1, Math.round(rate * .03), rate);
  const frames = sample.getChannelData(0);
  for (let i = 0; i < frames.length; i++) {
    const time = i / rate;
    const remaining = (frames.length - 1 - i) / rate;
    // A short, rounded contact followed by two decaying resonances of the switch.
    const fade = Math.sin(Math.PI / 2 * Math.min(1, time / .002, remaining / .005)) ** 2;
    const phase = 2 * Math.PI * time;
    frames[i] = fade * (.155 * Math.sin(840 * phase) * Math.exp(-time / .0065)
      + .072 * Math.sin(1490 * phase) * Math.exp(-time / .004));
  }
  return sample;
}

function sliderClick(at) {
  // Input callbacks released in the same audio quantum should make one contact.
  if (at - lastSliderClick < .006) return;
  lastSliderClick = at;
  const source = context.createBufferSource();
  source.buffer = sliderSample ??= makeSliderSample(context.sampleRate);
  source.connect(master);
  source.start(at);
}

const cues = {
  pet: playPat,
  petRecovery: at => {
    chime(at+.07,659,.14,.07);
    chime(at+.15,880,.17,.08);
    chime(at+.24,1175,.42,.09);
  },
  menu: at => {
    tone(at, 166, .12, 'sine', .22, 86);
    tone(at, 264, .075, 'triangle', .047, 154);
    rattle(at, .039, 510, .08, {end:285});
  },
  salaryTick: sliderClick,
  diceToss: at => {
    diceLand(at, {die: 0, strength: .16});
    diceLand(at + .023, {die: 1, strength: .12});
  },
  diceLand,
  lever: (at, latchDelay = .15) => {
    const latch = at + latchDelay;
    if (latchDelay) trackSlotVoices(
      tone(at + .022, 220, .069, 'triangle', .071, 262),
      rattle(at + .035, .022, 1240, .079, {attack:.002})
    );
    trackSlotVoices(
      tone(latch, 216, .093, 'triangle', .175, 153),
      tone(latch + .004, 557, .054, 'sine', .058),
      rattle(latch, .037, 1460, .116, {end:970,attack:.002})
    );
  },
  reels: (at, seconds = 1.3) => {
    const count = Math.max(2, Math.round(seconds * 12));
    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);
      const tick = at + (.48 * progress + .52 * progress ** 2) * (seconds - .08);
      trackSlotVoices(
        tone(tick, (i%2 === 0 ? 403 : 350) - 36*progress, .034, 'triangle', .072 - .036*progress),
        rattle(tick, .018, 1320 + (i%2)*140, .056 - .029*progress, {attack:.002})
      );
    }
  },
  reelStop: (at, reel = 0) => {
    trackSlotVoices(
      tone(at, 185 + 24*reel, .072, 'triangle', reel === 2 ? .167 : .127, 143 + 12*reel),
      rattle(at, .027, 1640 + 150*reel, .111, {end:1020,attack:.002}),
      tone(at + .016, reelNotes[reel], .10, 'triangle', .078)
    );
  },
  noBingo: at => {
    trackSlotVoices(
      tone(at, 277, .12, 'triangle', .10, 247),
      tone(at + .11, 185, .21, 'triangle', .128, 126),
      rattle(at + .11, .048, 820, .072, {end:510,attack:.003})
    );
  },
  fortune: at => {
    trackSlotVoices(
      tone(at, 196, .24, 'triangle', .135),
      ...chime(at, 494, .27, .132),
      ...chime(at + .10, 659, .26, .127),
      ...chime(at + .20, 784, .52, .165),
      tone(at + .20, 392, .34, 'sine', .049),
    );
  },
  doubleBingo: at => {
    trackSlotVoices(
      tone(at, 147, .28, 'triangle', .17, 105),
      ...[392,494,587,784,988].flatMap((note,i)=>chime(at+i*.082,note,.37,.125)),
      ...[196,294,392,494].map(note=>tone(at+.35,note,.60,'triangle',.065)),
      ...chime(at + .45, 1175, .65, .10),
    );
  },
  jackpot: at => {
    trackSlotVoices(
      tone(at, 196, .26, 'triangle', .18, 116),
      ...jackpotRiseNotes.flatMap((note,i)=>chime(at+.085+i*.059,note,.34,.13)),
    );
    for (const [offset, note] of [[.52,392],[.67,440],[.80,494],[1.02,784]]) {
      trackSlotVoices(
        ...chime(at + offset, note, .36, .15),
        tone(at + offset, note * .5, .31, 'triangle', .059),
      );
    }
    trackSlotVoices(
      ...[196,294,392,494,587].map(note=>tone(at+1.02,note,.74,'triangle',.063)),
      ...chime(at + 1.08, 1568, .72, .11),
    );
  },
  morning: at => melody(at, [330,440,554], .09),
  paper: paperTurn,
  ballotStamp: at => {
    const impact = at + .075;
    rattle(impact, .056, 1420, .22, {end:610,attack:.003});
    tone(impact, 196, .16, 'triangle', .25, 106);
    tone(impact + .006, 328, .09, 'sine', .12, 236);
  },
  receipt: at => {
    rattle(at, .15, 2400, .09);
    rattle(at + .15, .12, 1800, .09);
    tone(at + .26, 260, .13, 'triangle', .10, 96);
  },
  order: at => melody(at, [420,613], .055, .11, 'triangle', .058),
  fill: at => melody(at, [587,880,1175], .051, .15),
  guideWrong: at => melody(at, [330,220], .085, .12, 'triangle', .062),
  money: at => {
    rattle(at, .10, 2700, .10);
    melody(at + .022, [659,988], .07, .27, 'sine', .10);
  },
  ddakji: (at, {outcome, reducedMotion}) => {
    const impact = at + (reducedMotion ? 0 : rehabilitationPaperImpactMs / 1000);
    // The broad high crack and lower concrete thud are both noise transients.
    rattle(impact, .027, 3560, .49, {end:2370,attack:.0007});
    rattle(impact + .0008, .051, 1080, .42, {end:730,attack:.0012});
    rattle(impact + .0028, .064, 420, .34, {end:302,attack:.0016});
    const feedback = impact + .1;
    if (outcome === 'won') {
      melody(feedback, [523,659,880], .065, .19, 'triangle', .098);
    } else {
      melody(feedback, [349,233], .076, .126, 'triangle', .094);
    }
    if (outcome === 'lastChance' || outcome === 'exhausted') {
      const contact = impact + (rehabilitationSlapImpactMs - rehabilitationPaperImpactMs) / 1000;
      rattle(contact - .031, .025, 1390, .10, {end:980,attack:.004});
      rattle(contact, .038, 2140, .57, {end:1430,attack:.00055});
      rattle(contact + .0014, .052, 625, .54, {end:395,attack:.0013});
      rattle(contact + .004, .053, 285, .27, {end:195,attack:.0018});
    }
  },
  bankDraw: at => melody(at, [196,247,330], .075, .14, 'triangle', .065),
  bankOffers: at => melody(at, [392,523,659], .09, .19),
  friend: (at, reaction) => {
    const notes = reaction==='tease'?[523,392,587]:reaction==='clap'?[523,659,784,1047]:[440,587,740];
    melody(at, notes, .065, .17, 'triangle', .080);
    if (reaction==='clap') rattle(at, .055, 2110, .095);
  },
  soundOn: at => melody(at, [523,784], .065),
};

export function muteGame(value) {
  if (muted !== value) {
    muted = value;
    muteVersion++;
    if (muted) {
      patRequest++;
      for (const source of patVoices) stopPat(source);
      stopPaperAudio();
      stopRitualAudio();
      stopFortuneAudio();
    }
    if (master) master.gain.setTargetAtTime(muted ? 0 : .58, context.currentTime, .012);
  }
  if (!muted && typeof window !== 'undefined' && !patSample && !patFile) {
    void loadPatFile().catch(() => {});
  }
}

function resumeAudio(ctx, fromGesture = false) {
  if (resumePending && !fromGesture) return resumePending;
  const request = ctx.resume();
  resumePending = request;
  const clear = () => { if (resumePending === request) resumePending = null; };
  void request.then(clear, clear);
  return request;
}

export function prepareGameAudio({unmuting = false} = {}) {
  if (muted && !unmuting) return;
  try {
    const ctx = audio();
    if (ctx && ctx.state !== 'running') void resumeAudio(ctx, true).catch(() => {});
  } catch { /* Audio can be unavailable until the next user gesture. */ }
}

export function playGameSound(name, detail) {
  const play = cues[name];
  const slot = slotCues.has(name);
  if (!play || muted || (slot && globalThis.document?.hidden)) return;
  try {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'running') play(ctx.currentTime + .02, detail);
    else {
      const requestedAt = performance.now();
      const effectVersion = muteVersion, spin = slotVersion, page = paperVersion;
      void resumeAudio(ctx).then(() => {
        if (muteVersion !== effectVersion || performance.now() - requestedAt > 300) return;
        if (slot && (slotVersion !== spin || globalThis.document?.hidden)) return;
        if (name === 'paper' && page !== paperVersion) return;
        play(ctx.currentTime + .02, detail);
      }).catch(() => {});
    }
  } catch { /* Audio can be unavailable until the next user gesture. */ }
}

export function bindSelectionAudio(root, enabled) {
  const controller = new AbortController();
  const options = {capture: true, signal: controller.signal};
  // The native picker can stay open past the gesture that unlocked audio.
  function prepare(event) {
    if (event.target.matches?.('select') && enabled()) prepareGameAudio();
  }
  root.addEventListener('pointerdown', prepare, options);
  root.addEventListener('pointerup', prepare, options);
  root.addEventListener('keydown', prepare, options);
  root.addEventListener('change', event => {
    if (event.target.matches?.('select, input[type="checkbox"], input[type="radio"]') && enabled()) playGameSound('menu');
  }, options);
  return () => controller.abort();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the recorded page turn caches the first flip and cancels pending or playing audio on exit and mute', async t => {
  const recording = new URL('../public/audio/page-turn.mp3', import.meta.url);
  const recordingURL = new URL('/audio/page-turn.mp3', 'http://localhost/');
  const bytes = await readFile(recording);
  const request = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.href, recordingURL.href);
    return new Response(bytes);
  });
  const decoded = Promise.withResolvers();
  const decode = t.mock.fn(buffer => {
    assert.deepEqual(new Uint8Array(buffer), new Uint8Array(bytes));
    return decoded.promise;
  });
  const voices = [];
  class Audio {
    state = 'running';
    currentTime = 0;
    createGain() { return {gain:{setTargetAtTime(){}},connect(){}}; }
    decodeAudioData = decode;
    createBufferSource() {
      return {connect(){},disconnect(){},start(){voices.push(this);},stop(){this.stopped=true;}};
    }
  }
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = Audio;
  t.after(() => { if (previous) globalThis.AudioContext = previous; else delete globalThis.AudioContext; });
  const {preparePaperAudio, playGameSound, stopPaperAudio, muteGame} = await import('../src/game/game-audio.mjs');
  const settle = () => new Promise(resolve => setImmediate(resolve));
  preparePaperAudio();
  playGameSound('paper');
  await settle();
  stopPaperAudio();
  decoded.resolve({duration:.565});
  await settle();
  assert.equal(voices.length, 0);

  playGameSound('paper');
  playGameSound('paper');
  await settle();
  assert.equal(voices.length, 1);
  stopPaperAudio();
  assert.equal(voices[0].stopped, true);
  playGameSound('paper');
  await settle();
  assert.equal(voices.length, 2);
  muteGame(true);
  assert.equal(voices[1].stopped, true);
  playGameSound('paper');
  await settle();
  assert.equal(voices.length, 2);
  assert.equal(request.mock.callCount(), 1);
  assert.equal(decode.mock.callCount(), 1);
});

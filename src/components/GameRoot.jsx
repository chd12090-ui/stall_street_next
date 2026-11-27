'use client';

// Hosts the game. The server renders the static frame (loading screen included);
// after hydration the landing screen and, once a room is chosen, the game engine
// are loaded on the client and take over the DOM inside #game-viewport.
import { useEffect, useRef } from 'react';
import { gameFrameMarkup } from './game-frame-markup.mjs';

const bootFlag = '__stallStreetBooted';

// In development, Fast Refresh re-runs this module after edits to game code. The
// running game cannot be swapped in place (it owns timers and the DOM), so reload.
if (typeof window !== 'undefined' && window[bootFlag]) window.location.reload();

function showLoadFailure(error) {
  console.error('[stall-street] failed to start the game', error);
  const frame = document.getElementById('frame');
  const root = document.getElementById('room-root');
  if (!frame || !root) return;
  frame.dataset.roomGate = 'lobby';
  root.innerHTML = '<div class="room-actions" role="alert"><p>게임을 불러오지 못했어.</p>'
    + '<button type="button" class="ui-control ui-primary full">다시 시도</button></div>';
  root.querySelector('button').addEventListener('click', () => window.location.reload());
}

export default function GameRoot() {
  const viewport = useRef(null);
  useEffect(() => {
    const booted = window[bootFlag];
    // React Strict Mode runs effects twice on the same element in development.
    if (booted === viewport.current) return;
    // The game starts once per page load; a fresh mount (e.g. after a client-side
    // navigation back to this page) needs a full load.
    if (booted) {
      window.location.reload();
      return;
    }
    window[bootFlag] = viewport.current;
    import('@/storage/game-api-client.mjs')
      .then(({ warmUpGameApi }) => warmUpGameApi())
      .catch(error => console.warn('[stall-street] local game database is not ready yet', error));
    import('@/ui/landing.jsx')
      .then(({ mountLanding }) => mountLanding())
      .catch(showLoadFailure);
  }, []);

  return <div id="game-viewport" ref={viewport} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: gameFrameMarkup }} />;
}

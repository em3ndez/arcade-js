// SPDX-License-Identifier: GPL-3.0-only
/** advanceAttractTowardGameStart — guarded tail of the phase-3 image step: bail while play is active, else reset the
 * sub-step/phase on a pending flag, or on free-play + two input bits hide the sprites and start a game. LIVE-OUT: memory + stack. */
import { hideAllSprites } from "./hideAllSprites.js";
import { startGameOnFreePlay } from "./startGameOnFreePlay.js";

export function advanceAttractTowardGameStart(m) {
  const { mem8 } = m;

  if (mem8[0xad30] !== 0) return;

  if (mem8[0xa986] !== 0) {
    mem8[0xa9ac] = 0;
    mem8[0xa9ab] = mem8[0x1736];
    return;
  }

  if (mem8[0xa9c0] === 0) return;
  if ((mem8[0xa9ae] & 0x18) === 0) return;

  // the park is the dissolved sprite-hide call's return slot; the first ret pops it, the last the caller's.
  m.push16(0x0f6d);
  hideAllSprites(m);
  m.ret();
  startGameOnFreePlay(m);
  return m.ret();
}

// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3829, SHARED_PHASE_GATE, SHARED_PHASE_COUNTDOWN } from "./names.js";
/**
 * advanceEnemyActorToDescentStateOnDelay — run one actor's phase countdown, advancing the phase when it expires.
 *
 * Does nothing while the shared gate flag is clear. While the shared countdown is still
 * live it decrements it and waits. When the countdown reaches zero it reloads it, bumps the
 * actor's phase field (rec+2), clears rec+3/rec+5, seats rec+4/rec+6, points the record at
 * its animation sequence, and stores the tile id into rec+9.
 *
 * LIVE-OUT: memory only — the shared countdown, and on expiry the actor record fields
 * (rec+2..rec+6, rec+9) plus the animation-pointer bytes (rec+0x0C..rec+0x0E).
 */

const COUNTDOWN_RELOAD = 0x12; // reload value when the countdown expires
const PHASE_TILE_ID = 0x2c; // tile id stored into rec+9 on phase advance

export function advanceEnemyActorToDescentStateOnDelay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[SHARED_PHASE_GATE] === 0) return; // gate clear -> idle

  if (mem8[SHARED_PHASE_COUNTDOWN] !== 0) {
    mem8[SHARED_PHASE_COUNTDOWN] = mem8[SHARED_PHASE_COUNTDOWN] - 1;
    return; // still counting
  }

  // Countdown expired: reload and advance the actor's phase.
  mem8[SHARED_PHASE_COUNTDOWN] = COUNTDOWN_RELOAD;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x04] = 0x15;
  mem8[rec + 0x06] = 0x02;
  setActorAnimation(m, rec, ANIM_TABLE_3829);
  mem8[rec + 0x09] = PHASE_TILE_ID;
}

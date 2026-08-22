// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_0f97 } from "./loc_0f97.js";
import {
  ANIM_TABLE_3838,
  SHARED_FRAME_DELAY_TIMER,
  WAVE_NUMBER,
  WAVE_ARRIVAL_COUNTER,
  WAVE_COUNT_HUD_HI,
  WAVE_SPAWN_DISPLAY_CMD_A,
  WAVE_SPAWN_DISPLAY_CMD_B,
} from "./names.js";

const RESPAWN_DELAY = 0x10; //     reseeded into the shared delay timer after a spawn
const HUD_COLUMN_STRIDE = 0x20; // the low digit tile sits one column below the high digit

// packed-BCD increment with a mod-100 wrap (0x99 -> 0x00)
function bcdInc(v) {
  let lo = (v & 0x0f) + 1;
  let hi = v >> 4;
  if (lo > 9) {
    lo = 0;
    hi += 1;
  }
  if (hi > 9) hi = 0;
  return ((hi << 4) | lo) & 0xff;
}

/**
 * loc_6931 — per-record spawn/init for one enemy record pair (dissolved caller-skip).
 *
 * An already-active pair (bit 0 of the first two enemy-record bytes set) is left untouched and
 * returns true, so the caller keeps sweeping. An empty pair is spawned: both records are
 * activated and their fields seeded, the actor animation is armed, and the shared respawn delay
 * is set. On the first spawn of a wave (WAVE_NUMBER still zero) it also queues two wave display
 * commands and paints the arrival count to the HUD as two BCD digits. WAVE_NUMBER is then bumped
 * and the module returns false, so the caller aborts its sweep.
 *
 * The count -> BCD conversion counts decimal-adjust increments and is faithful to the frozen
 * loop's djnz semantics: a zero count runs the full 256-step wrap (BCD 0x56), not a no-op.
 *
 * LIVE-OUT: none in registers — the caller protects its own loop counter/stride and advances the
 * record pointers itself, so nothing the spawn leaves in registers is read back. Memory: the two
 * records' fields, the respawn delay, and (first spawn only) the display ring, the HUD digits,
 * and WAVE_NUMBER.
 */
export function loc_6931(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  if (((mem8[ix] | mem8[ix + 1]) & 0x01) !== 0) return true; // already active -> keep sweeping

  mem8[ix + 0x03] = 0x00;
  mem8[ix + 0x05] = 0x00;
  mem8[ix + 0x00] = 0x01; // activate the enemy record
  mem8[iy + 0x00] = 0x01; // activate the paired state record
  mem8[ix + 0x04] = 0x15;
  mem8[ix + 0x06] = 0x1e;
  mem8[iy + 0x03] = 0x80;
  mem8[iy + 0x05] = 0xa0;
  mem8[iy + 0x04] = 0x14;
  mem8[iy + 0x06] = 0x1e;
  mem8[iy + 0x0f] = 0x03;
  mem8[iy + 0x10] = 0x40;
  mem8[ix + 0x09] = 0x24;
  mem8[iy + 0x09] = 0x24;
  setActorAnimation(m, ix, ANIM_TABLE_3838);
  mem8[SHARED_FRAME_DELAY_TIMER] = RESPAWN_DELAY;

  if (mem8[WAVE_NUMBER] === 0) { // first spawn of the wave
    loc_0038(m, WAVE_SPAWN_DISPLAY_CMD_A);
    loc_0038(m, WAVE_SPAWN_DISPLAY_CMD_B);

    let bcd = 0x00;
    let steps = mem8[WAVE_ARRIVAL_COUNTER];
    do {
      bcd = bcdInc(bcd);
      steps = (steps - 1) & 0xff;
    } while (steps !== 0);
    mem8[WAVE_COUNT_HUD_HI] = (bcd & 0xf0) >> 4; //          high digit
    mem8[WAVE_COUNT_HUD_HI - HUD_COLUMN_STRIDE] = bcd & 0x0f; // low digit

    loc_0f97(m);
  }

  mem8[WAVE_NUMBER] = mem8[WAVE_NUMBER] + 1;
  return false; // spawned -> caller aborts its sweep
}

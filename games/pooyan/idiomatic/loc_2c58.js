// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
import { loc_2c85 } from "./loc_2c85.js";
import { queueSoundCommand12 } from "./queueSoundCommand12.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * loc_2c58 — hunter dispatch state 0. Steps the record's animation, then advances its 16-bit
 * vertical position (+0x05 low / +0x06 high) by the per-frame step (+0x09). While the high byte
 * stays below the top row it keeps climbing; once it reaches the top it sweeps every hunter
 * record through the transition helper and queues the arrival sound.
 *
 * Returns true on the normal (climbing) path, false on the reached-top path — the boolean is the
 * whole contract, a caller-skip boolean. Every other effect is memory; no
 * register survives as a consumed output.
 */

const POS_LO = 0x05; //   vertical position low / high / per-frame step
const POS_HI = 0x06;
const POS_STEP = 0x09;
const TOP_ROW = 0x12; //  high byte at/above which the hunter has reached the top
const RECORD_STRIDE = 0x18;
const HUNTER_RECORD_COUNT = 0x11;

export function loc_2c58(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // step this record's animation frame

  let low = mem8[rec + POS_LO] + mem8[rec + POS_STEP];
  if (low > 0xff) mem8[rec + POS_HI] = mem8[rec + POS_HI] + 1; // carry into the high byte
  mem8[rec + POS_LO] = low;

  if (mem8[rec + POS_HI] < TOP_ROW) return true; // still climbing

  let sweep = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < HUNTER_RECORD_COUNT; i++) {
    loc_2c85(m, sweep);
    sweep += RECORD_STRIDE;
  }
  queueSoundCommand12(m); // queue the arrival sound
  return false; // caller-skip: abort the dispatch loop
}

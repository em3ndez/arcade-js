// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SUBPHASE_TICK,
  FORMATION_SLOT_TABLE,
  HUD_INTEGRITY_STRIP_A,
  HUD_INTEGRITY_STRIP_B,
  SELFTEST_DISPATCH_STATE,
} from "./names.js";
import { loc_4381 } from "./loc_4381.js";
import { loc_0fb2 } from "./loc_0fb2.js";
/**
 * loc_7517 — display dispatch state 1.
 *
 * Runs the display-list interpreter, then ticks a mod counter and returns until it reaches its
 * period; on that tick it steps a one-shot sub-phase and returns on the first pass. Otherwise it
 * column-sums two fixed video-RAM strips (walking upward a row at a time) and requires the total to
 * equal the intact-screen value exactly — any other total is a hard integrity trap — then advances
 * to state 2 and queues two sound commands.
 *
 * LIVE-OUT: none — the state dispatcher reads no result register.
 */

const TICK_PERIOD = 0x1c;
const STRIP_TILES = 0x0e;
const ROW_STRIDE = 0x20;
const SUM_LOW = 0x4f;
const SUM_HIGH = 0x01;

export function loc_7517(m) {
  const { mem8 } = m;

  loc_4381(m);

  mem8[SUBPHASE_TICK] = mem8[SUBPHASE_TICK] + 1;
  if (mem8[SUBPHASE_TICK] !== TICK_PERIOD) return;

  const preInc = mem8[FORMATION_SLOT_TABLE];
  mem8[FORMATION_SLOT_TABLE] = mem8[FORMATION_SLOT_TABLE] + 1;
  mem8[SUBPHASE_TICK] = preInc;
  if (preInc === 0) return; // first pass: skip the strip check

  let sum = 0;
  for (const base of [HUD_INTEGRITY_STRIP_A, HUD_INTEGRITY_STRIP_B]) {
    let cell = base;
    for (let i = 0; i < STRIP_TILES; i++) {
      sum = u16(sum + mem8[cell]);
      cell = u16(cell - ROW_STRIDE);
    }
  }
  if ((sum & 0xff) !== SUM_LOW) throw new Error("loc_7517: HUD strip integrity trap (unreachable with an intact screen)");
  if ((sum >> 8) !== SUM_HIGH) throw new Error("loc_7517: HUD strip integrity trap (unreachable with an intact screen)");

  mem8[SELFTEST_DISPATCH_STATE] = mem8[SELFTEST_DISPATCH_STATE] + 1;
  loc_0fb2(m);
}

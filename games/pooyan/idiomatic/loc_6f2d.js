// SPDX-License-Identifier: GPL-3.0-only
import { loc_3536 } from "./loc_3536.js";
import { loc_4006 } from "./loc_4006.js";
import { loc_3e69 } from "./loc_3e69.js";
import { loc_3e9c } from "./loc_3e9c.js";
/**
 * loc_6f2d — per-record state handler for the enemy-actor table, record based at IX.
 *
 * Reads the record's state byte (rec+0x02) and routes on it: state 2 tails into the frame-hold
 * tick; any state below 0x0b runs the generic animation mover and returns; state 0x0b or 0x0c
 * dispatch into the object state-5 / state-6 handlers respectively (a two-entry dispatch table
 * indexed by state minus the dispatch base).
 *
 * LIVE-OUT: none — the scan loop parks its own loop registers across the call and reads no result
 * back; every effect is in the record's memory.
 */
const STATE_HOLD_TICK = 0x02; //   state that tails into the frame-hold tick
const DISPATCH_BASE = 0x0b; //     first dispatched state; index = state - 0x0b

export function loc_6f2d(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const state = mem8[rec + 0x02];
  if (state === STATE_HOLD_TICK) return loc_3536(m, rec);
  if (state < DISPATCH_BASE) { //                     generic animation mover, then return
    loc_4006(m, rec);
    return;
  }

  switch ((state - DISPATCH_BASE) & 0xff) {
    case 0: return loc_3e69(m, rec); //               state 0x0b -> object state-5 handler
    case 1: return loc_3e9c(m, rec); //               state 0x0c -> object state-6 handler
  }
}

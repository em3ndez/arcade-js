// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickFireTimerAndRerollDirection — tick one fire's periodic timer; on expiry reload it and re-roll
 * the object's travel direction on a random bit.
 *
 * Called against a single object record, whose pointer arrives in a register. Every dispatch ends by
 * ticking the object's countdown field (+0x16) down by one:
 *
 *   • While that timer is still counting, the decrement is the whole routine.
 *   • On the pass that finds it already at zero, the timer is first reloaded and the object's state
 *     field (+0x0d) is reset to 0; then, ONLY when the pseudo-random accumulator's low bit is set,
 *     the state is advanced to 1. The shared decrement then runs on the freshly-reloaded value, so
 *     an expiry leaves the timer at 42 and the cycle repeats every 43 passes.
 *
 * DEAD ARM, faithfully absent. The original also carries a branch that would set the state to 2,
 * guarded by "state == 1". The reset to 0 happens immediately BEFORE that test, so it can never
 * match — the state here is only ever 0 or 1 — and the arm produces no memory effect at all. It is
 * therefore not reproduced.
 *
 * WHAT THE NAME CLAIMS. Derivable here: a periodic timer on a 43-pass cycle, and a coin flip at each
 * expiry that moves the state field between its only two values — the erratic half of the object's
 * motion, as opposed to any deterministic reversal a mover applies elsewhere. That the state field
 * is a TRAVEL DIRECTION, and that the record belongs to a fire, are both carried with the name from
 * outside this file: this body cannot tell a direction from any other two-valued flag.
 *
 * Reads: the record's timer field, and RANDOM. Writes: the record's timer and state fields.
 * LIVE-OUT: memory-only. The record pointer is unchanged and nothing consumes a return value.
 */

import { RANDOM } from "./names.js";

const TIMER = 0x16; // object-record field: periodic countdown
const STATE = 0x0d; // object-record field: 0/1 phase, advanced on a random beat
const RELOAD = 43;  // timer reload on expiry; the shared decrement then leaves 42

/**
 * @param {object} m  the machine; the object record is the register live-in (uses m.mem).
 * @returns {void}
 */
export function tickFireTimerAndRerollDirection(m) {
  const { regs, mem } = m;

  // The object record to service — the register live-in from the caller.
  const record = regs.ix;
  const timerAddr = (record + TIMER) & 0xffff;
  const stateAddr = (record + STATE) & 0xffff;

  // Expired: reload the timer, reset the state, and advance it only on a random beat.
  if (mem.read8(timerAddr) === 0) {
    mem.write8(timerAddr, RELOAD);
    mem.write8(stateAddr, 0);
    if ((mem.read8(RANDOM) & 0x01) !== 0) {
      mem.write8(stateAddr, 1);
    }
  }

  // Every path converges here: tick the (possibly reloaded) timer down by one.
  mem.write8(timerAddr, mem.read8(timerAddr) - 1);
}

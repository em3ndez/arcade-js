// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickFireTimerAndRerollDirection — tick one fire's periodic timer; on expiry reload it and re-roll
 * the object's travel direction on a random bit.  ROM 0x330F.
 *
 * Called against a single object record (the record pointer is the register
 * live-in). Every dispatch ends by ticking the object's countdown field (+0x16)
 * down by one:
 *
 *   • While that timer is still counting, the decrement is the whole routine.
 *   • On the pass that finds it already at zero, the timer is first reloaded and
 *     the object's state field (+0x0d) is reset to 0; then, ONLY when the
 *     pseudo-random accumulator's low bit is set, the state is advanced to 1.
 *     The shared decrement then runs on the freshly-reloaded value, so an expiry
 *     leaves the timer at 42 and the cycle repeats every 43 passes.
 *
 * In attract this drives the record at the 0x6400 hazard-object array, whose
 * timer visibly free-runs 42→0 while the state field toggles between 0 and 1.
 *
 * DEAD ROM ARM (faithfully absent): the original also carries a branch that would
 * set the state to 2, guarded by "state == 1". But the reset-to-0 happens just
 * before that test, so it can never match — the state here is only ever 0 or 1,
 * and the 2-arm produces no memory effect. It is therefore not reproduced, and
 * the gate pins that a 2 is never written.
 *
 * The object pointer is not modified, and nothing consumes a return value, so
 * this is void.
 *
 * NAME — WHY "FIRE". OBJ_ARRAY_64 (0x6400) was grounded as the FIRES on the real ROM under
 * MAME 0.288, on a NATURAL zero-poke 25m run (scratchpad/grounding-object-arrays.md): zeroing
 * the five records' +0 erases the fireball from the screen completely (0 of 40 sampled frames)
 * while the barrels are statistically untouched, the tight A/B's first differing frame is a
 * single blob at this array's logged record position to the pixel, and boxes drawn at the
 * logged positions land on a fireball and nothing else on all four boards. HONEST FLOOR: the
 * X-pin POSITIVE control on this array is a NO-OP — the ROM recomputes +3 each frame — so the
 * identity rests on the kill control plus positional correlation, not on a coordinate command.
 * The direction reading comes from the movement side, in other files: loc_3202 describes the
 * low-side step as "loc_33ad steps the working X one pixel the way OBJ_STATE points", with
 * loc_298c reversing at the band edges. This routine supplies the RANDOM half of that — a coin
 * flip once every 43 passes — which is the object's erratic wandering as opposed to the
 * deterministic edge reversals. The reroll itself was not separated in the MAME capture, so the
 * entry stays cert "code": the subject is grounded, the behaviour is understood from code.
 *
 * Memory-equivalent to the frozen oracle — equivalence-330f.test.js.
 * GATE:     crafted-exhaustive + captured. The whole memory effect is a function
 *           of the timer byte and the random low bit, so the sweep runs every
 *           timer value 0..255 crossed with random bytes covering both parities
 *           (and noise in the ignored state input / record base), plus real
 *           captured 0x330F dispatches from an attract run. Teeth: a dropped
 *           final decrement, an inverted random-bit gate, and a wrong reload value.
 * LIVE-OUT: memory-only (the object's timer +0x16 and state +0x0d). The oracle's
 *           residual registers/flags and its terminal return are dead — the
 *           caller issues its next work without reading them; the record pointer
 *           is unchanged.
 * NAMES:    RANDOM (0x6018) from names.js. The two touched cells are object-record
 *           fields at pointer+0x16 (timer) and pointer+0x0d (state); neither has a
 *           names.js name (the record layout is not yet named) — reported for the lead.
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

  // The object record to service — the register live-in from the still-oracle caller.
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

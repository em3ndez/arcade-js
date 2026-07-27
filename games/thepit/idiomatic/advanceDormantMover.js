// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDormantMover — mover housekeeping: advance two cadence counters each call.  ROM 0x34da.
 *
 * Called once per mover update to keep two counters ticking:
 *   - A free-running tick counter is bumped every call. Once every 256 calls it
 *     wraps back to zero, and on that single beat the routine hands off to the
 *     periodic refresh (reseed the random/animation byte, re-arm the actor state
 *     byte) and is done for this call.
 *   - On every other call the routine acts only on every 4th tick: it advances a
 *     second, slower counter — holding that counter's bit 3 clear so it can never
 *     set — and otherwise does nothing.
 *
 * The name stays neutral. Of the two counters it drives, the free-running tick counter
 * is now MOVER_STATE (0x8090); the slower second counter (0x8085) still has no confirmed
 * game role — the timer/cadence question it sits under is still open — so an English name
 * for the routine would claim more than the evidence supports; the sibling refresh it
 * delegates to stays neutral for the same reason.
 *
 * Memory-equivalent to the frozen oracle — equivalence-34da.test.js.
 * GATE:     exhaustive — over all 65,536 (tick, second-counter) pairs the touched
 *           work RAM matches the oracle, exercising all three paths (the every-4th
 *           advance, the do-nothing tick, and the wrap→refresh), plus a spread of
 *           generator states on the wrap beat and real captured attract states,
 *           plus teeth. Never dispatched in attract (its caller's tick housekeeping
 *           is a gameplay path), so it is gated as a near-leaf sweep rather than a
 *           natural dispatch — like the refresh it calls.
 * LIVE-OUT: memory-only. The accumulator the oracle leaves behind is path-dependent
 *           (the refresh's value on a wrap, the low tick bits on a skipped tick, the
 *           new second-counter value on the 4th) and dead: the caller reaches here
 *           only by tail-jump, threading this return on out, and reads it as no
 *           pixel state — the whole-machine/pixel gate backstops any live register.
 * NAMES:    MOVER_STATE (0x8090) from ram.js is the free-running tick counter; the
 *           slower second counter (0x8085) has no ram.js name yet, so it stays hex;
 *           the periodic refresh owns the bytes it writes.
 */

import { loc_34f0 } from "./loc_34f0.js";
import { MOVER_STATE } from "./ram.js";


export function advanceDormantMover(m) {
  const { mem8 } = m;

  // Bump the free-running tick counter every call.
  const tick = (mem8[MOVER_STATE] + 1) % 256;
  mem8[MOVER_STATE] = tick;

  // Once every 256 calls the counter wraps back to zero; on that beat, run the
  // periodic refresh and stop for this call.
  if (tick === 0) {
    loc_34f0(m);
    return;
  }

  // Otherwise act only on every 4th tick; the other three do nothing.
  if (tick % 4 !== 0) return;

  // On the 4th tick, advance the slower second counter, holding its bit 3 clear.
  const second = (mem8[0x8085] + 1) & 0xf7;
  mem8[0x8085] = second;
}

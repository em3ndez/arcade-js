// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b1c — run the descent probe against Mario's context block; on a normal probe result run
 * the 0x29AF object-collision follow-up and hand back a zeroed result pair.  ROM 0x2B1C.
 *
 * Three steps, and the middle one decides whether the third happens:
 *
 *  1. Point the object pointer at Mario's context block (MARIO_ACTIVE, 0x6200). Everything below
 *     inherits it: probeMarioDescentLanding passes it through to the tile classifier, whose tail
 *     (resolveAirborneTileLanding) reads the block's +5 field — Mario's Y — to measure how far the
 *     descent has come.
 *
 *  2. Run probeMarioDescentLanding. It is a CALLER-SKIP: its false return is the ROM's two-frame
 *     unwind, which abandons the probe and returns past this routine to its own caller. Propagate
 *     it by returning early — the follow-up and the result pair below are exactly the code that
 *     unwind skips, so on that path the probe's own result pair is what the caller reads.
 *
 *  3. Normal probe result: run 0x29AF, then report a zeroed result pair. 0x29AF opens with an
 *     rst-0x30 that rotates a constant 0x04 right BOARD times and runs its body only if the bit
 *     rotated out is set, so only BOARD 3 opens it; on every other board it returns having done
 *     nothing. Corroborated outside this file by the MAME grounding recorded in loc_2a22's header
 *     (0x29AF's body-only callee ran 146x on a 75m run and 0x on boards 2 and 4, where 0x29AF
 *     itself ran thousands of times).
 *
 * ONLY CALLER: loc_1c05 (ROM 0x1C05, still frozen), the airborne per-frame handler, which reads
 * the result pair back as `dec a` and — on the arm that takes — `dec b`. Both bytes are live-out.
 *
 * THE FROZEN ORACLE DISCARDS 0x29AF's CALLER-SKIP, AND THIS FILE REPRODUCES THAT. 0x29AF has two
 * exits (ROM 0x29ED and 0x2A1A) that discard their return address and return one level further up,
 * so on the real hardware they skip the result-pair store below and leave 1 in the first result
 * byte. `translated/loc_29af.js` reports those exits as a `false` return, `translated/loc_2b1c.js`
 * ignores it and stores the zeroed pair regardless, and the memory-equivalence contract is against
 * that oracle — so this routine ignores it too, and the gate pins the behaviour on crafted BOARD-3
 * entries that reach both skip exits. The difference is register-only inside this routine, but it
 * is NOT dead: loc_1c05 branches on the first result byte. Nothing in this file settles whether
 * the oracle or the hardware is right; it is an open question for whoever decompiles 0x29AF and
 * loc_1c05.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b1c.test.js.
 * GATE:     captured + crafted. 0x2B1C IS naturally reached — 443 real dispatches in an 8000-frame
 *           attract run (loc_1c05 -> here) — but attract plays 25m only, where the probe ALWAYS
 *           takes its unwind, so those 443 cover the early-return path and NONE of them reaches
 *           0x29AF. The 0x29AF arm is carried entirely by crafted entries on a real attract base:
 *           BOARD 2 and 4 (the rst-0x30 gate closed), and BOARD 3 driving all four of 0x29AF's
 *           terminal paths, three of which write work RAM. Compared on RAM minus STACK_SCRATCH plus
 *           both result bytes plus the return value; pc and SP are excluded (see LIVE-OUT).
 * LIVE-OUT: the two result bytes loc_1c05 reads, and the return value (always undefined — this
 *           routine is not itself a caller-skip; both of its paths land its caller at the same
 *           continuation). It writes no memory of its own; the memory in the contract is what the
 *           probe cascade and 0x29AF write. pc and SP are NOT in the contract: on 0x29AF's two skip
 *           exits the oracle pops one word too many and ends at whatever address that word held
 *           (0x03A6 on the gate's staged stack), an artifact of the discarded skip above rather
 *           than a property to reproduce.
 * NAMES:    MARIO_ACTIVE (0x6200) from names.js, used as the base of Mario's context block, not read.
 *           probeMarioDescentLanding (ROM 0x2B29) is direct-called. 0x29AF is not in the ROUTINES
 *           registry, so it stays an oracle call; dissolving it into a direct call is a coordinated
 *           follow-up for whoever wires its idiomatic form.
 */

import { probeMarioDescentLanding } from "./probeMarioDescentLanding.js"; // ROM 0x2B29
import { MARIO_ACTIVE } from "./names.js";

/**
 * @param {object} m  the machine. No register live-in. Live-out: the two result bytes.
 * @returns {undefined} always — both paths return to the caller's single continuation.
 */
export function loc_2b1c(m) {
  const { regs } = m;

  // The probe and everything under it works off Mario's context block.
  regs.ix = MARIO_ACTIVE; // 0x6200 — base of Mario's context block

  // The probe's unwind abandons the rest of this routine; the caller reads the probe's own
  // result pair on that path.
  if (!probeMarioDescentLanding(m)) return;

  // Normal probe result: the board-gated object-collision follow-up, then a zeroed result pair.
  // Its caller-skip return is deliberately discarded, matching the oracle — see the header.
  m.call(0x29af);
  regs.a = 0;
  regs.b = 0;
}

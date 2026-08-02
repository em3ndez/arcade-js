// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2901 — run one bounding-box collision sweep over the 0x6400 object array.  ROM 0x2901.
 *
 * A single-sweep sibling of the three-sweep loc_28b0. A dispatch table (base 0x3E8D)
 * jumps here having pushed the per-axis search tolerances on the stack; this routine
 * recovers them, records the sweep's object count where the found-handler reads it back,
 * points the shared collision search findCollidingObject at the OBJ_ARRAY_64 record array, and runs
 * one scan for the first record whose box overlaps the reference point.
 *
 * The scan reports its result in registers (findCollidingObject's ABI): a hit sets the result byte
 * to 1 and leaves the count-minus-index residue behind so the found-handler can recover
 * the matched record's index; an exhausted scan leaves the result byte 0. On a hit the
 * search takes its caller-skip return, which here only skips this routine's own trivial
 * tail — both outcomes hand control back to the dispatch site the same way — so this
 * routine always completes as a normal return.
 *
 * BOUNDARY MARSHALLING (dissolves once the dispatcher is decompiled): the tolerances
 * arrive on the stack (the dispatcher pushed them) and the collision search still reads
 * its inputs from registers, so this routine recovers the pushed pair into the tolerance
 * registers and loads the record base / stride / count exactly as the oracle does before
 * handing off to findCollidingObject. The reference coordinate and reference pointer are set by the
 * dispatcher and passed through untouched.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2901.test.js.
 * GATE:     crafted entries (0x2901 is never dispatched in attract — its table arm is
 *           reached only through the untranslated 0x3E88 dispatcher) driving a hit at the
 *           first record, a hit at a later record (the count-minus-index recovery), an
 *           exhausted scan, and varied stack-passed tolerances (proving the tolerance
 *           marshalling is live). The RAM diff excludes the dead STACK_SCRATCH the oracle's
 *           dissolved call/return bracket writes; every live cell is kept. Teeth: a twin
 *           that stores the wrong object count and a twin that scans the wrong record count.
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory, plus the search result the dispatch caller consumes
 *           — result byte in the accumulator and the count-minus-index residue (findCollidingObject's
 *           live-out registers). The oracle's dissolved push/return bracket is stack-only.
 * NAMES:    OBJ_SEARCH_COUNT (0x63B9), OBJ_ARRAY_64 (0x6400) from ram.js; findCollidingObject (ROM
 *           0x2913) direct-called.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64 } from "./ram.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP_COUNT = 7;   // records this sweep scans
const RECORD_STRIDE = 32; // 0x20-byte record stride of OBJ_ARRAY_64

export function loc_2901(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the dispatcher pushed (the collision search
  // reads the axis-1 tolerance from the low byte and the axis-2 tolerance from the high).
  regs.hl = m.pop16();

  // Record how many records this sweep covers, where the found-handler reads it back.
  mem.write8(OBJ_SEARCH_COUNT, SWEEP_COUNT);

  // Aim the shared collision search at the object array and run one sweep. It reports its
  // result in registers; the reference coordinate and reference pointer come in from the
  // dispatcher untouched.
  regs.b = SWEEP_COUNT;
  regs.de = RECORD_STRIDE;
  regs.ix = OBJ_ARRAY_64;
  findCollidingObject(m);

  // A hit's caller-skip only skips this routine's own tail, so control returns to the
  // dispatch site the same way on both outcomes — always a normal return.
  return true;
}

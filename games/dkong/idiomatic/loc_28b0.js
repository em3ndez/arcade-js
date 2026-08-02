// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_28b0 — run three bounding-box collision sweeps over three object arrays in order.  ROM 0x28B0.
 *
 * The three-sweep sibling of the single-sweep loc_2901. A dispatch table jumps here having
 * pushed the per-axis search tolerances on the stack; this routine recovers them and then runs
 * three back-to-back collision sweeps, each pointing the shared search findCollidingObject at a different
 * object array and staging that sweep's record count where the found-handler reads it back:
 *
 *   sweep 1 — OBJ_ARRAY_64   (0x6400), stride 0x20, 5 records
 *   sweep 2 — OBJ_ARRAY_65A0 (0x65A0), stride 0x10, 6 records
 *   sweep 3 — OBJ_RECORD_66A0(0x66A0), stride 0x00, 1 record (the single record, scanned once)
 *
 * The sweeps run in order and stop at the FIRST hit: on a hit the search takes its caller-skip
 * return, which splices control back up to the dispatch site and abandons the remaining sweeps,
 * so OBJ_SEARCH_COUNT is left holding the count of whichever sweep terminated the routine (5, 6,
 * or 1 on a hit; 1 when all three exhaust, its last write). The count word is loaded into DE once
 * for sweep 1 (0x0020); sweeps 2 and 3 reload only the low byte E (0x10, then 0x00) — the high
 * byte stays 0x00 from sweep 1 (findCollidingObject preserves DE), so the three strides are 0x0020/0x0010/0x0000.
 *
 * BOUNDARY MARSHALLING (dissolves once the dispatcher is decompiled): the tolerances arrive on the
 * stack (the dispatcher pushed them) and the collision search still reads its inputs from registers,
 * so this routine recovers the pushed pair into the tolerance registers (H/L) and loads each sweep's
 * record base / stride / count before handing off to findCollidingObject. The reference coordinate (C) and
 * reference pointer (IY) are set by the dispatcher and passed through untouched.
 *
 * Memory-equivalent to the frozen oracle — equivalence-28b0.test.js.
 * GATE:     crafted entries (0x28B0 is never dispatched in attract — measured 0 over 1500 frames;
 *           its collision-handler table arm is reached only through the untranslated dispatcher)
 *           driving a hit terminating each of the three sweeps (proving the per-sweep OBJ_SEARCH_COUNT
 *           and the early-return-on-hit), a full exhaustion, a hit at a later record within a sweep
 *           (the count-minus-index residue), and varied stack-passed tolerances that flip the decision
 *           (proving the tolerance marshalling is live). The RAM diff excludes the dead STACK_SCRATCH
 *           the oracle's dissolved pop/call/return bracket churns; every live cell is kept. Teeth: a
 *           twin that stores the wrong count and a twin that drops the early-return-on-hit.
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory, plus the search result the dispatch caller consumes — result
 *           byte in the accumulator and the count-minus-index residue in B (findCollidingObject's live-out
 *           registers), left by whichever sweep ran last. The oracle's pop/call/return bracket is
 *           stack-only (lands in STACK_SCRATCH).
 * NAMES:    OBJ_SEARCH_COUNT (0x63B9), OBJ_ARRAY_64 (0x6400), OBJ_ARRAY_65A0 (0x65A0),
 *           OBJ_RECORD_66A0 (0x66A0) from ram.js; findCollidingObject (ROM 0x2913) direct-called.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_RECORD_66A0 } from "./ram.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function loc_28b0(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the dispatcher pushed (findCollidingObject reads the axis-1
  // tolerance from the low byte L and the axis-2 tolerance from the high byte H).
  regs.hl = m.pop16();

  // Sweep 1 — OBJ_ARRAY_64, stride 0x20, 5 records. Loads the full stride word.
  mem.write8(OBJ_SEARCH_COUNT, 0x05);
  regs.b = 0x05;
  regs.de = 0x0020;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true; // a hit takes the caller-skip -> skip the remaining sweeps

  // Sweep 2 — OBJ_ARRAY_65A0, stride 0x10, 6 records. Only E is reloaded; D stays 0x00.
  mem.write8(OBJ_SEARCH_COUNT, 0x06);
  regs.b = 0x06;
  regs.e = 0x10;
  regs.ix = OBJ_ARRAY_65A0;
  if (!findCollidingObject(m)) return true;

  // Sweep 3 — OBJ_RECORD_66A0, stride 0x00, 1 record. Stride 0 rescans the same record; count 1
  // makes it a single look. Only E is reloaded; D stays 0x00.
  mem.write8(OBJ_SEARCH_COUNT, 0x01);
  regs.b = 0x01;
  regs.e = 0x00;
  regs.ix = OBJ_RECORD_66A0;
  if (!findCollidingObject(m)) return true;

  // All three sweeps exhausted with no hit — a normal return to the dispatch site.
  return true;
}

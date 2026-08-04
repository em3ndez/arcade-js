// SPDX-License-Identifier: GPL-3.0-only
/**
 * search25mObjectOverlap — run the current board's three bounding-box collision sweeps, stopping at the
 * first overlap.  ROM 0x2880.
 *
 * NAME PROVENANCE (why "25m"): the rst-0x28 dispatch table at ROM 0x2874 reads
 * `00 00 | 80 28 | b0 28 | e0 28 | 01 29 | 00 00`, so BOARD index 1 vectors here — 25m. Cross-checked
 * against the array it sweeps: this is the only arm touching OBJ_ARRAY_67, and against grounding, which
 * saw its OBJ_SEARCH_COUNT signature 10.5.1 on board 1 only (1218x attract / 2136x in a 1P game).
 *
 * The three-sweep sibling of the single-sweep search100mObjectOverlap. The board collision dispatcher
 * dispatchBoardCollision (0x286F) reaches it through its rst-0x28 board table, having pushed
 * the per-axis search tolerances (HL) on the stack first; this routine recovers that pair and
 * runs the shared collision search findCollidingObject over three object arrays in turn:
 *   sweep 1 — OBJ_ARRAY_67 (0x6700), 10 records, 0x20-byte stride;
 *   sweep 2 — OBJ_ARRAY_64 (0x6400), 5 records, same 0x20 stride;
 *   sweep 3 — the single OBJ_RECORD_66A0 (0x66A0), stride 0.
 * Before each sweep it stamps that sweep's record count into OBJ_SEARCH_COUNT (0x63B9), where
 * the found-handler reads it back to recover the matched record's index (count − B), and aims
 * findCollidingObject at the array. The reference coordinate (C) and reference pointer (IY) are set by the
 * dispatcher and pass through untouched. The DE stride is loaded once as 0x0020 for sweep 1;
 * sweeps 2 and 3 reload only E (0x20 then 0x00), so the high byte D stays 0x00 throughout.
 *
 * The FIRST sweep to find an overlapping record is a hit: the search takes its caller-skip
 * return, which here stops the remaining sweeps and hands control back to the dispatch site;
 * if all three sweeps come up empty the routine returns to that same site the normal way. The
 * result is left in registers for the dispatch caller — A = 1 on a hit / 0 on a miss, and B =
 * the count-minus-index residue (findCollidingObject's ABI).
 *
 * CALLER-SKIP / RETURN. dispatchBoardCollision is a pure dispatch trampoline with no tail, so a
 * hit's two-level caller-skip and the all-miss normal return both unwind to exactly the same
 * place with the same pc + SP — this routine always completes as a normal return to the
 * dispatch site (same reasoning as search100mObjectOverlap). The idiomatic form therefore returns `true` on
 * every path; the load-bearing effect of the caller-skip is the early STOP of the later
 * sweeps, expressed as the `if (!findCollidingObject(m)) return true;` early return. (The frozen oracle's
 * literal `return false` on a hit is a translation artifact of propagating findCollidingObject's boolean;
 * the identical terminal structure — proven by the pc + SP match in the gate — makes it
 * vacuous.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-2880.test.js.
 * GATE:     crafted entries pinning each arm (a hit in sweep 1 / 2 / 3, a hit at a nonzero
 *           index for the count-minus-B recovery, an all-miss, and a stack-passed tolerance
 *           that flips the decision — proving the `pop hl` marshalling is live) plus real
 *           captured 0x2880 dispatches from 25m attract (both hit and exhausted outcomes
 *           occur). Every case compares RAM (minus the dead STACK_SCRATCH the oracle's
 *           dissolved pop/call/return churn writes), pc, SP and the live register file.
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory (the last executed sweep's count), plus the search
 *           result the dispatch caller consumes — result byte in A and the count-minus-index
 *           residue in B (findCollidingObject's live-out registers). The oracle's dissolved
 *           pop/push/return bracket is stack-only.
 * NAMES:    OBJ_SEARCH_COUNT (0x63B9), OBJ_ARRAY_67 (0x6700), OBJ_ARRAY_64 (0x6400),
 *           OBJ_RECORD_66A0 (0x66A0) from names.js; findCollidingObject (ROM 0x2913) direct-called.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 0x0a;    // records the 0x6700 sweep scans
const SWEEP2_COUNT = 0x05;    // records the 0x6400 sweep scans
const SWEEP3_COUNT = 0x01;    // the single 0x66a0 record
const RECORD_STRIDE = 0x0020; // 0x20-byte stride of the stride-0x20 arrays (D=0x00, E=0x20)

export function search25mObjectOverlap(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the board dispatcher pushed (findCollidingObject reads the
  // axis-1 tolerance from L and the axis-2 tolerance from H).
  regs.hl = m.pop16();

  // -- sweep 1: the 0x6700 object array, 10 records, 0x20-byte stride --
  mem.write8(OBJ_SEARCH_COUNT, SWEEP1_COUNT);
  regs.b = SWEEP1_COUNT;
  regs.de = RECORD_STRIDE; // D=0x00 stays live across all three sweeps; only E is reloaded below
  regs.ix = OBJ_ARRAY_67;
  if (!findCollidingObject(m)) return true; // hit -> stop; control unwinds to the dispatch site

  // -- sweep 2: the 0x6400 object array, 5 records, same 0x20 stride (reload E only) --
  mem.write8(OBJ_SEARCH_COUNT, SWEEP2_COUNT);
  regs.b = SWEEP2_COUNT;
  regs.e = 0x20; // DE = 0x0020 (D still 0x00)
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true; // hit -> stop

  // -- sweep 3: the single 0x66a0 record, stride 0 (reload E to 0) --
  mem.write8(OBJ_SEARCH_COUNT, SWEEP3_COUNT);
  regs.b = SWEEP3_COUNT;
  regs.e = 0x00; // DE = 0x0000
  regs.ix = OBJ_RECORD_66A0;
  if (!findCollidingObject(m)) return true; // hit -> stop

  // All three sweeps missed -> normal return to the dispatch site.
  return true;
}

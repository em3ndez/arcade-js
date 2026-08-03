// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a22 — collision check: does Mario overlap any object in the 0x6600 array?  ROM 0x2A22.
 *
 * A thin parameter-binding wrapper over the generic object-list bounding-box search
 * findCollidingObject. It pins that search to the six-record array at OBJ_ARRAY_66 (0x6600, stride
 * 0x10) — B = 6 records, DE = 0x10 stride, IX = 0x6600 base — and delegates. The caller
 * (loc_29af) has already loaded the reference point and per-axis tolerances findCollidingObject reads
 * from registers (C = Mario's Y from 0x6205, IY = 0x6200 so IY+3 = Mario's X at 0x6203, and
 * HL = 0x0408 → axis-1 base tolerance L = 8, axis-2 base tolerance H = 4). The search
 * outcome — A = 1 on a hit / 0 on exhaustion, plus B = count-minus-index the caller recovers
 * the matched record from — is loc_2a22's whole output; it writes no work RAM.
 *
 * CALLER-SKIP: in the raw Z80 findCollidingObject takes a two-level return on a hit, splicing past this
 * wrapper's `ret`; but this wrapper's ONLY post-call instruction IS that `ret`, so both the
 * hit (skip) and the exhausted (normal) path land loc_29af at the same continuation (0x29C0)
 * with the same A/B. The wrapper therefore neither propagates nor absorbs a skip of its own —
 * it is a plain void routine (the oracle returns undefined on both arms). The idiomatic form
 * drops the stack dance and simply calls findCollidingObject directly, discarding its boolean return
 * (loc_29af reads the result from A, which findCollidingObject leaves set on either arm).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2a22.test.js.
 * GATE:     crafted-entry + fuzz. The search parameters are fixed constants, so the gate
 *           crafts object pages at 0x6600 pinning each arm (hit at index 0, hit at a nonzero
 *           index for the B recovery, exhausted, inactive slots, both extra-span arms) and
 *           fuzzes record layouts / reference coordinates; each compares RAM − STACK_SCRATCH
 *           and the live register file against the oracle. There are NO captured dispatches
 *           to replay: 0x2A22 is not on the attract path. The test hooks 0x2A22 in a real
 *           attract run and asserts that the capture count is ZERO — that assertion is the
 *           reachability record, and the crafted + fuzz entries carry the whole gate.
 *           Grounding on the real dkong ROM under MAME 0.288 (understanding pass 12) agrees
 *           and sharpens it: 0 dispatches over 18789 attract frames, and the only dispatches
 *           observed anywhere are on BOARD 3 (146 fetches in a 75m run, its caller loc_29af
 *           146; on boards 2 and 4 loc_29af ran 3700 / 2329× and this wrapper 0×, so the
 *           caller gates it to the board whose 0x6600 array is live). Teeth pin all three
 *           bound constants.
 * LIVE-OUT: registers A (1 hit / 0 exhausted) and B (count − matched index), per loc_29af,
 *           which reads A with `and a` and B with `ld a,0x06 / sub b`. No work RAM is written;
 *           the oracle's push/call/ret churn lands in STACK_SCRATCH and is excluded.
 * NAMES:    OBJ_ARRAY_66 (0x6600) — the object array this collision search is bound to.
 */

import { findCollidingObject } from "./findCollidingObject.js";
import { OBJ_ARRAY_66 } from "./ram.js";

export function loc_2a22(m) {
  const { regs } = m;

  // Bind the generic bounding-box search to the six-record 0x6600 object array and run it.
  regs.b = 0x06; // record / loop count
  regs.de = 0x0010; // record stride
  regs.ix = OBJ_ARRAY_66; // record base (0x6600)
  findCollidingObject(m); // leaves A = hit/miss and B = count − matched index for loc_29af
}

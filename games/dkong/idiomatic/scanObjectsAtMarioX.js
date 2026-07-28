// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanObjectsAtMarioX — broad-phase X test of the per-frame object-collision scan.
 * ROM 0x19DA.
 *
 * Called once per frame from the loc_197a update cascade (ROM 0x19B0). It walks the
 * 3-entry, stride-4 object table at 0x6A0C — each entry a 4-byte record (+0 X, +1
 * flags, +2 attr, +3 Y) — comparing every record's X byte (+0) against Mario's X
 * (MARIO_X). It is the X broad-phase; confirmObjectHit (ROM 0x19ED) is the narrow
 * phase that finishes the test:
 *
 *   - On the FIRST record whose X equals Mario's X, it hands that record off to
 *     confirmObjectHit (with the record base as HL live-in), which checks Y
 *     alignment + eligibility and, if both pass, registers the hit. That routine's
 *     return goes straight to OUR caller (the oracle jp-z's into it — a tail
 *     hand-off), so once a record matches we stop scanning and return.
 *   - If no record's X matches, we return having touched nothing.
 *
 * The oracle walks the table with `inc l` (8-bit, H fixed at 0x6A) so the record
 * bases are 0x6A0C, 0x6A10, 0x6A14 — three records, stride 4, no page cross. Setting
 * HL to that base before the call is the one register the callee consumes; every
 * other residual register/flag is dead ABI.
 *
 * Memory-equivalent to the frozen oracle — equivalence-19da.test.js.
 * GATE:     crafted + captured. Attract dispatches 0x19DA ~1532x but the 0x6A0C
 *           table is empty there, so no X-match ever fires the confirm arm — so per
 *           docs/decompiler-pipeline the match arm is gated CRAFTED (real attract state + a surgical
 *           table poke), EXHAUSTIVELY over the scan's deciding input (Mario's X) with
 *           a match placed at each of the 3 slots, oracle-vs-idiomatic on fresh clones
 *           (this routine writes RAM via the callee — never a shared clone); the
 *           no-match arm is gated by every real captured dispatch. Three teeth twins
 *           (wrong stride, wrong loop count, wrong hand-off pointer).
 * LIVE-OUT: memory-only. Nothing on the no-match arm; on an X-match, whatever
 *           confirmObjectHit writes (the 0x6343 / 0x6342 / 0x6340 hit trio, and only
 *           when the record is Y-aligned + eligible). No live registers/flags: the
 *           caller's next act (loc_197a → call 0x03FB) is a self-contained call, and
 *           the oracle's residual A/B/HL/F plus its ret's SP/pc are dead ABI — this
 *           routine models neither SP nor pc.
 * NAMES:    MARIO_X (0x6203) from ram.js; confirmObjectHit (ROM 0x19ED) from the
 *           idiomatic layer. 0x6A0C object table kept hex — unnamed in ram.js.
 */
import { MARIO_X } from "../optimized/ram.js";
import { confirmObjectHit } from "./confirmObjectHit.js";

const OBJECT_TABLE = 0x6a0c; // 3 records, 4 bytes each; base X at +0
const RECORD_COUNT = 3;
const RECORD_STRIDE = 4;

export function scanObjectsAtMarioX(m) {
  const { regs, mem } = m;
  const marioX = mem.read8(MARIO_X);

  for (let i = 0; i < RECORD_COUNT; i++) {
    const record = OBJECT_TABLE + i * RECORD_STRIDE; // 0x6A0C, 0x6A10, 0x6A14
    if (marioX === mem.read8(record)) {
      // X-match: hand the record to the confirm half. HL is its only live-in;
      // its return goes to our caller, so we stop scanning.
      regs.hl = record;
      confirmObjectHit(m);
      return;
    }
  }
  // No record shares Mario's X — return having touched nothing.
}

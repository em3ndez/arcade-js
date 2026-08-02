// SPDX-License-Identifier: GPL-3.0-only
/**
 * findHammerOverlappingMario — test whether Mario overlaps either of the two objects in the 0x6680
 * pair, and report which one.  ROM 0x2974.
 *
 * A thin front end over the object-list bounding-box search findCollidingObject. It fixes the
 * search parameters for this particular query and runs it once:
 *   • the record base is the two-record object pair at 0x6680 (OBJ_PAIR_6680), stride
 *     0x10, count 2;
 *   • the reference point is Mario: the axis-1 reference is Mario's Y coordinate, and
 *     the axis-2 reference is Mario's X — reached by pointing the reference pointer at
 *     Mario's live block base (0x6200) so that its +3 byte is Mario's X (0x6203);
 *   • the per-axis base tolerances are 8 (axis 1) and 4 (axis 2).
 * The search stops at the first active record whose box overlaps Mario on both axes.
 *
 * In the ROM this is `call 0x2913 / ret` — a tail call. findCollidingObject uses the shared
 * caller-skip convention (on a hit it returns one level further up, skipping this
 * routine's own `ret`), but the observable effect toward THIS routine's caller is the
 * same on both outcomes: control resumes right after the call, with the result left in
 * the register file. So this is a plain call that always returns normally to its caller.
 *
 * LIVE-OUT: registers, left exactly as findCollidingObject leaves them — A is 1 on a hit / 0 when
 *   the pair is exhausted, and B on a hit is the count minus the matched record's index
 *   (so the caller recovers the index as 2 − B). The caller (ROM 0x2954) reads both A
 *   and B straight back. No work RAM is written (findCollidingObject is a leaf that only reads the
 *   records and Mario's position). This routine therefore returns nothing.
 *
 * REGISTER-ABI MARSHALLING (dissolves once findCollidingObject takes honest args): findCollidingObject still
 * reads its inputs from registers, so this routine loads exactly what the ROM's `call`
 * site loads before it — the reference-point pointer, the axis-1 reference coordinate,
 * the two tolerances, the record count, the record stride, and the record base.
 *
 * OFFSET NAMESPACE: every record offset in this query is an OBJECT-record field. Axis 1 compares
 * against a record's +5 (OBJ_Y) with the extra span +0x0A (OBJ_HIT_EXTENT_Y); axis 2 against +3
 * (OBJ_X) with +0x09 (OBJ_HIT_EXTENT_X). No sprite-record offset is involved — SPRITE_BUFFER does
 * not begin until 0x6900.
 *
 * NAME (promoted from loc_2974, DK understanding pass 13 — independent proposer ≠ confirmer,
 * confidence MEDIUM-HIGH). The mechanism is certain from the code; the word "hammer" rides on
 * corroboration established entirely OUTSIDE this routine and its caller:
 *   - MARIO_HAMMER_PENDING (0x6218, [seen]) calls itself "a touched-but-not-yet-held hammer" and
 *     names ROM 0x295A — inside latchHammerTouch, this routine's sole caller, which consumes this
 *     search's A and B directly.
 *   - driveHammerSprite (promoted pass 10) drives this same pair as THE HAMMER, choosing between
 *     0x6680 and 0x6690 on bit0 of the first record's HAMMER_IN_PLAY flag.
 *   - seedSpriteObjectPair, which activates the pair, is called from seed25mBoardObjects,
 *     seed50mBoardObjects and seed100mBoardObjects and from no other board setup — so the pair
 *     exists on exactly the hammer boards and never on 75m, DK's one hammer-free board. The board
 *     mask the caller gates on (0x0B) is that same three-board set, reached a different way.
 *   - An independent real-MAME audio trace (audio/sounds.js latch bit 5, confidence CONFIRMED)
 *     ties the caller's sound trigger to a hammer grab.
 * WHAT THE NAME DOES NOT CLAIM: not that anything is picked up — this routine writes no RAM at all
 * and only reports an overlap; not which of DK's hammers is which; and not how many hammers a
 * board shows (the pair is always two records, seeded from three different ROM position tables
 * that nobody has read).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2974.test.js.
 * GATE:     real captured 0x2974 dispatches from an attract run, plus crafted entries
 *           that pin every outcome by poking the two records at 0x6680/0x6690 and
 *           Mario's X/Y — a hit at index 0, a hit at index 1 (the count−index residue
 *           in B), and an exhausted pair. Each compared over RAM − STACK_SCRATCH, pc,
 *           SP and the live register file against the oracle; STACK_SCRATCH is excluded
 *           because the oracle's `call`/`ret` bracket (its pushed 0x298B return address
 *           and findCollidingObject's saved base) is churn this routine dissolves. Teeth: a twin
 *           that takes the axis-1 reference from Mario's X instead of Mario's Y, and a
 *           twin that scans only one record instead of both.
 * NAMES:    MARIO_ACTIVE (0x6200, used here as Mario's live-block base — its +3 byte is
 *           MARIO_X, the axis-2 reference), MARIO_Y (0x6205), OBJ_PAIR_6680 (0x6680) —
 *           all from ram.js. The tolerances (0x0408), record count (2) and stride
 *           (0x10) are immediates, not addresses, so they stay literal with role
 *           comments. findCollidingObject is direct-called.
 */

import { MARIO_ACTIVE, MARIO_Y, OBJ_PAIR_6680 } from "./ram.js";
import { findCollidingObject } from "./findCollidingObject.js"; // ROM 0x2913 — object-list bounding-box search

export function findHammerOverlappingMario(m) {
  const { regs, mem } = m;

  // Reference-point pointer: Mario's live-block base, so its +3 byte (0x6203 = Mario's
  // X) is the axis-2 reference the search reads.
  regs.iy = MARIO_ACTIVE;

  // Axis-1 reference coordinate: Mario's Y.
  regs.a = mem.read8(MARIO_Y);
  regs.c = regs.a;

  // Per-axis base tolerances: axis-1 = 0x08, axis-2 = 0x04.
  regs.hl = 0x0408;

  // Scan the two-record pair at 0x6680, stride 0x10.
  regs.b = 0x02;
  regs.de = 0x0010;
  regs.ix = OBJ_PAIR_6680;

  // Run the search once. It leaves the hit flag in A and the count−index residue in B
  // (the ROM ignores its caller-skip return here — both outcomes resume the caller).
  findCollidingObject(m);
}

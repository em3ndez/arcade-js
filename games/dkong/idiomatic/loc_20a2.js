// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20a2 — on the first frame an airborne object's fall is arrested, decide whether the object
 *            also turns round, then hand its record on to the tail that bounces it.  ROM 0x20A2.
 *
 * Three bytes are read and none is written here: the record's kind index (+0x15), the record's
 * OBJ_Y, and MARIO_Y. Both exits are jumps into still-frozen code, so everything that actually
 * happens to the object happens below this routine:
 *   ROM 0x20B5 — give the record a horizontal step of exactly one whole pixel per frame, in the
 *                direction opposite to the one it is carrying, and continue into ROM 0x20C3.
 *   ROM 0x20C3 — the bounce: replace the record's launch speed, restart its arc counter and clear
 *                the two position fractions, so the arc starts again going the other way.
 * The whole decision made here is whether the object turns round. It bounces on every arm.
 *
 * WHERE IT SITS. The per-frame walk over the 25m OBJ_ARRAY_67 records (ROM 0x1F72) reaches an
 * object's movement branch at ROM 0x2053, which advances the object one frame along its arc
 * (stepBallisticMotion) and then asks loc_2a2f — "probe the tile 4 px below a moving object and
 * … report the contact", per its names.js entry — whether it has reached a girder. On the
 * frames that says yes, ROM 0x2083 counts them into the record's +0x0E and routes the FIRST one
 * here; the second goes straight to the bounce tail and the rest go elsewhere.
 *
 * WHAT THE ROLE LINE RESTS ON, and it is not this body: three reads and a jump can say which tail
 * runs, never what a tail does. It rests on the record's horizontal step, watched across every
 * dispatch of a plain attract run on the real ROM. Over 12000 frames, all 68 of them:
 *   the two turn paths (64)  the step goes −96 → +256, or +96 → −256, in 1/256 px per frame —
 *                            reversed, and set to exactly one whole pixel
 *   the no-turn path (4)     the step is left exactly as it was, +96 → +96
 * and the launch speed is replaced on all 68. A turn path that had left the step alone, or a
 * no-turn path that had changed it, would have killed the role line; the gate carries that
 * measurement as a test of its own, so the numbers here have a producing line.
 *
 * WHAT THIS DOES NOT CLAIM. Why an object well below Mario is left to carry on the way it was
 * going. All 4 of the no-turn dispatches attract produces land on the lowest rows this routine is
 * reached at (235 and 236, against 104/137/170/203 for the rest), with Mario above the object every
 * time — so what the arm is FOR, and whether the clearance means anything beyond "not on this row",
 * is not established here. Nor does anything here say the kind index's values are the two barrel
 * kinds names.js grounds at BARREL_CLAIM_MODE: this routine only separates zero from non-zero.
 *
 * AN EDGE THE ROM HAS THAT ATTRACT NEVER REACHES: the clearance comes off OBJ_Y as a byte, so an
 * object within 22 rows of the top of the screen wraps to a large value and takes the no-turn arm
 * regardless of where Mario is. Attract only ever arrives here at OBJ_Y 104, 137, 170, 203, 235 or
 * 236, so the wrap is crafted in the gate rather than left undescribed.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the machine's record pointer rather than
 * becoming a named argument, because both frozen tails re-read that pointer to reach the rest of
 * the same record. A caller passing a different record would be obeyed by the three reads here and
 * ignored one call later. It becomes an honest parameter once those tails are decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-20a2.test.js.
 * GATE:     captured + crafted + live, ATTRACT ONLY. All THREE code paths are reached naturally —
 *           68 dispatches in a 12000-frame attract run, 60 turning on the compare, 4 turning on the
 *           kind index and 4 not turning, across 8 OBJ_ARRAY_67 record bases — and EVERY one of them
 *           is replayed, inline at the dispatch, with no sampling. On top of them 18 crafted
 *           entries, each a real captured state with one surgical poke applied identically to both
 *           sides, cover the clearance boundary and either side of it, the byte wrap above, kind
 *           values attract never delivers, Mario at both extremes of a byte and a nudged record
 *           base. Because both sides run the identical frozen tail, the comparison is stronger than
 *           the usual contract: RAM INCLUDING STACK_SCRATCH, the whole ordered write sequence, the
 *           entire exit register file with SP, and the return value. The live arm runs 12000
 *           attract frames under the cycle-free engine with this routine wired at 0x20A2 and diffs
 *           the whole per-frame trace against a baseline that differs in ONE thing — the body
 *           behind the same override. Teeth: seven broken twins plus a live-wired twin, of which
 *           three are caught ONLY by a crafted entry.
 *           NOT COVERED: gameplay, and every board but 25m — the walk at ROM 0x1F72 returns at
 *           once unless BOARD is 1, so 25m is the only board this cluster has.
 *           The entropy pin is deliberately NOT installed: pinned, attract dispatches this routine
 *           ZERO times in 4000 frames, and the gate asserts the unpinned count instead.
 * LIVE-OUT: memory, plus the propagated return value — and nothing of this routine's own. It
 *           writes no register and no flag; every register visible at the exit belongs to the
 *           frozen tail, which both sides run identically, so there is no dead-register claim to
 *           defend and the gate asserts the whole exit register file outright.
 *           DERIVED: the values the oracle leaves in a register before its jumps are all dead
 *           before anything reads them. Both tails reload the accumulator from the record on their
 *           first instruction; every path through them reaches ROM 0x20C3, which calls loc_2407 —
 *           that routine builds its 16-bit result from the record and takes its borrow from a mask
 *           it performs itself, so neither the incoming 16-bit pointer pair nor any incoming flag
 *           survives — and then clears the accumulator before the shared sprite tail at ROM 0x21BA
 *           swaps the whole register set anyway.
 *           MEASURED: the gate compares the FULL exit register file on all 68 captured and all 18
 *           crafted entries, which is what turns that derivation into an observation, and the live
 *           run then covers what one call at a time cannot see.
 * NAMES:    MARIO_Y and OBJ_Y from names.js. The record's +0x15 has no names.js name of its own — the
 *           registry names BARREL_CLAIM_MODE, the cell a claim's kind bit is set in, not the
 *           per-record index stamped from it — so it stays a file-local offset. Both exits are
 *           still frozen and are reached through the registry: ROM 0x20B5 and ROM 0x20C3 belong to
 *           the same mutually-recursive object-walk cluster as this routine and are being
 *           decompiled alongside it, so dissolving those is a later coordinated step.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, OBJ_Y } from "./names.js";

/**
 * The object record's kind index (+0x15). Zero and non-zero are the only distinction drawn here;
 * names.js grounds the cell the kind is claimed in, but not this per-record copy, so it has no
 * registry name to import.
 */
const OBJ_KIND = 0x15;

/** How far below Mario the object must have come to rest for the turn to be skipped, in pixels. */
const CLEARANCE_BELOW_MARIO = 22;

export function loc_20a2(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  const at = (offset) => (record + offset) & 0xffff;

  // An object of the alternate kind turns round without being asked where Mario is.
  if (mem8[at(OBJ_KIND)] !== 0) return m.call(0x20b5);

  // Otherwise it keeps going the way it was only if it has come to rest well below him. The
  // subtraction is a byte, so an object near the top of the screen wraps past every Mario position
  // and lands on this arm too.
  if (u8(mem8[at(OBJ_Y)] - CLEARANCE_BELOW_MARIO) >= mem8[MARIO_Y]) return m.call(0x20c3);

  return m.call(0x20b5);
}

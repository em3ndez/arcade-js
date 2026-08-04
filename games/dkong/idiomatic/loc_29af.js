// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29af — board-gated resolution of Mario's airborne contact with the 0x6600 objects.  ROM 0x29AF.
 *
 * Reached only while Mario is airborne, from the airborne handler's collision cascade
 * (ROM 0x1C05 -> 0x2B1C). A board gate opens it on one board only — the board whose bit is
 * bit 2 of the mask, i.e. board 3; everywhere else the whole routine is skipped and the caller
 * resumes untouched.
 *
 * When the gate opens it asks the object search (loc_2a22 -> findCollidingObject) whether Mario
 * overlaps any of the six OBJ_ARRAY_66 records, with a vertical span of 8 and a horizontal span
 * of 4 around his current position. No overlap: nothing happens and the caller resumes.
 *
 * On an overlap it resolves the contact from where Mario was BEFORE this frame's motion —
 * MARIO_AIR_PREV_Y, the pre-motion snapshot the airborne handler takes each frame — against the
 * matched object's own Y, less 4. That gives three outcomes:
 *
 *   - Mario was clearly ABOVE that line: he lands on the object. MARIO_Y is placed 8 above the
 *     line and EDGE_REPOSITION_FLAG is raised (the one-shot "Mario Y was just repositioned"
 *     gate that the ride/footing code reads).
 *   - Mario was clearly BELOW it: MARIO_ACTIVE is cleared — he dies.
 *   - Neither: he met the object side-on, and his X is snapped to the middle of the 8-pixel cell
 *     he is in, written to both MARIO_X and his hardware sprite record.
 *
 * The two acting outcomes SKIP THE CALLER: control resumes two levels up, in the airborne
 * handler, which reads the outcome and either lands Mario (the on-top case) or keeps him
 * airborne with his velocity record cleared (the side case). See LIVE-OUT.
 *
 * ONE ROM BRANCH IS COLLAPSED HERE, and it is worth stating because the collapse is not
 * obvious. The side-on case selects between two X computations on whether the airborne
 * horizontal velocity's high byte is zero: "(X - 8), set the low 3 bits, add 4" versus "set the
 * low 3 bits, subtract 4". Those are the SAME function of X — both are 8*floor(X/8) + 3 — for
 * all 256 inputs, including the wrapping ones, so the velocity test cannot change the stored
 * value and only one expression survives. The gate pins this exhaustively over all 256 X values
 * on both sides of that test, rather than leaving it as an assertion.
 *
 * NAME: kept the neutral loc_. Which objects the 0x6600 array holds on this board is not
 * established to the routine-naming bar here — OBJ_ARRAY_66's names.js entry grounds the array as
 * six live records on board 3 with Y sweeping and X pinned to two columns, but naming this
 * routine for them would import an identity this file did not derive. What IS corroborated from
 * outside the routine: MARIO_AIR_PREV_Y's names.js entry independently names ROM 0x29D6/0x29EE —
 * the two reads below — as its collision readers, and EDGE_REPOSITION_FLAG's entry independently
 * names ROM 0x29AF as the writer that sets it right after writing MARIO_Y, which is exactly the
 * on-top arm here. Both would have come out otherwise if the arms were read wrong.
 *
 * Memory-equivalent to the frozen oracle — equivalence-29af.test.js.
 * GATE:     captured + crafted. The natural attract demo dispatches 0x29AF ZERO times in 3000
 *           frames (its caller's own gate never lets it through on board 1), so there is no
 *           natural capture to replay and that test records the zero rather than implying
 *           coverage. Real dispatches come from attract runs with BOARD poked to 2 / 3 / 4,
 *           which reach it 81 / 6 / 175 times; 15 of those 262 are replayed (every 20th plus
 *           the first of each arm, with the sample asserted to cover every arm seen). Those runs
 *           produce only the closed gate and the no-overlap arm — the THREE ACTING ARMS OCCUR IN
 *           NO CAPTURE and are carried entirely by crafted entries on a real attract base
 *           (closed gate, no overlap, on-top, kill, side-on, a touch accepted only through a
 *           record's own extra spans, the decision's three 8-bit wraps, and a touch at each of
 *           the six record indices), plus the exhaustive 1024-entry sweep pinning the collapse.
 *           Four further entries straddle the vertical decision band one pixel either side of
 *           BOTH edges (derived by sweeping the oracle: it lands at 90 and goes side-on at 91;
 *           it goes side-on at 109 and kills at 110), each pair asserted to take DIFFERENT arms
 *           so the straddle cannot go vacuous. These exist because a one-pixel change to the
 *           lower clearance — which decides whether Mario lives or dies — passed every other
 *           block in this gate; the upper edge was already pinned incidentally by two of the
 *           wrap entries, and the gate now asserts which CLASS of entry catches each of the four
 *           one-pixel twins rather than stating it in prose.
 * LIVE-OUT: memory (see NAMES) plus the boolean skip-flag return, and — on the two skipping
 *           returns only — registers A and B, which are a genuine oracle boundary: the frozen
 *           airborne handler resumes at ROM 0x1C08 and reads A (`dec a`), then loc_1c3a reads B
 *           (`dec b`) to choose between landing Mario (ROM 0x1C4F) and clearing his velocity
 *           record. A = 1 on both skips; B = 1 for on-top, 0 for side-on. On the three plain
 *           returns A and B are dead — the sole caller loc_2b1c overwrites both (`xor a; ld b,a`)
 *           before returning — and so are the flags on every path, since both continuations
 *           begin with an arithmetic op. IX is left at the matched record as the oracle leaves
 *           it; it is dead on both skip arms (traced through 0x1C08 -> 0x1C3A -> 0x1C4F/0x1D95/
 *           0x1DA6, none of which reads it), but the kill arm's continuation was not traced to a
 *           close, so it is preserved rather than dropped. D is NOT preserved: on a touch the
 *           oracle parks the contact line in it as scratch, and none of the caller or that same
 *           closed set of continuation code reads it, so the value is dropped and the gate says
 *           so rather than comparing it.
 * NAMES:    reads MARIO_Y, MARIO_AIR_PREV_Y, MARIO_X and the matched record's OBJ_Y; writes
 *           MARIO_Y (on-top), EDGE_REPOSITION_FLAG (on-top), MARIO_ACTIVE (kill), MARIO_X and
 *           MARIO_SPRITE_RECORD + SPRITE_X (side-on). MARIO_ACTIVE doubles as the base of Mario's
 *           object record, which is what the search reads its horizontal reference (+3 = MARIO_X)
 *           through. The cell the collapsed branch tested is MARIO_AIR_VX_HI; it is not read here
 *           because neither arm's result depends on it. boardBitGate (ROM 0x0030) and loc_2a22
 *           (ROM 0x2A22) are direct-called.
 */

import { u8 } from "../../../core/int.js";
import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30)
import { loc_2a22 } from "./loc_2a22.js"; // ROM 0x2A22 — the 0x6600 overlap search
import {
  EDGE_REPOSITION_FLAG,
  MARIO_ACTIVE,
  MARIO_AIR_PREV_Y,
  MARIO_SPRITE_RECORD,
  MARIO_X,
  MARIO_Y,
  OBJ_ARRAY_66,
  OBJ_Y,
  SPRITE_X,
} from "./names.js";

// Board applicability mask: bit2 selects board 3, so the contact check runs only there.
const BOARD_MASK = 0x04;

// Overlap spans handed to the object search: how far from Mario's position a record's own
// position may sit and still count as touching him, before the record's per-object extra spans.
const CONTACT_SPAN_Y = 8;
const CONTACT_SPAN_X = 4;

// The 0x6600 array the search is bound to: six records, 16 bytes apart.
const RECORD_COUNT = 6;
const RECORD_STRIDE = 16;

// The object's contact line sits 4 above its own Y, and Mario stands 8 above that line.
const CONTACT_LINE_RISE = 4;
const STANDING_HEIGHT = 8;

// How far Mario's pre-motion position must clear the contact line to count as unambiguously
// above it (he lands) or unambiguously below it (he dies). Between the two he met the object
// side-on. Larger Y is LOWER on screen, so "above" is the smaller number.
const ABOVE_CLEARANCE = 5;
const BELOW_CLEARANCE = 14;

// Snapping X side-on: set the low 3 bits to reach the right edge of the 8-pixel cell Mario is
// in, then step back 4 to its middle.
const CELL_LOW_BITS = 0x07;
const CELL_HALF = 4;

/**
 * @param {object} m  the machine.
 * @returns {boolean} true when control reached OUR CALLER (the gate was closed, or one of the
 *   two non-acting outcomes); false when the caller is skipped and the airborne handler two
 *   levels up resumes instead.
 */
export function loc_29af(m) {
  const { regs, mem8 } = m;

  // Board gate: this contact check belongs to one board only.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return true; // gate closed elsewhere -> our caller resumes

  // Does Mario overlap any of the six records? The search takes its reference point and spans
  // through registers (it is still a raw primitive), so they are marshalled here.
  regs.iy = MARIO_ACTIVE; // Mario's object-record base; the search reads its +3 as the X reference
  regs.c = mem8[MARIO_Y];
  regs.l = CONTACT_SPAN_Y;
  regs.h = CONTACT_SPAN_X;
  loc_2a22(m);
  if (regs.a === 0) return true; // no overlap -> nothing to resolve

  // The search reports which record matched as the count minus its index; recover the record.
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;
  regs.ix = record; // published to the frozen continuation (see LIVE-OUT)

  const contactLine = u8(mem8[record + OBJ_Y] - CONTACT_LINE_RISE);
  const previousY = mem8[MARIO_AIR_PREV_Y];

  // Clearly above the line before this frame's motion -> Mario lands on the object.
  if (u8(previousY + ABOVE_CLEARANCE) < contactLine) {
    mem8[MARIO_Y] = contactLine - STANDING_HEIGHT;
    mem8[EDGE_REPOSITION_FLAG] = 1;
    regs.a = 1;
    regs.b = 1; // the handler two levels up reads this as "land him"
    return false; // skip the caller
  }

  // Clearly below it -> Mario is killed.
  if (u8(previousY - BELOW_CLEARANCE) >= contactLine) {
    mem8[MARIO_ACTIVE] = 0;
    regs.a = 0;
    return true;
  }

  // Side-on contact -> snap Mario to the middle of his 8-pixel cell, in both the position he
  // moves from and the sprite record that draws him. (The ROM picks this expression through a
  // test on the airborne horizontal velocity; both of its arms compute this same value.)
  const snappedX = (mem8[MARIO_X] | CELL_LOW_BITS) - CELL_HALF;
  mem8[MARIO_X] = snappedX;
  mem8[MARIO_SPRITE_RECORD + SPRITE_X] = snappedX;
  regs.a = 1;
  regs.b = 0; // the handler two levels up reads this as "keep him airborne"
  return false; // skip the caller
}

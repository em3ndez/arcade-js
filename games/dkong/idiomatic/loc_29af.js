// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29af — resolve what happens when an airborne Mario meets one of the moving objects on the
 * board this check belongs to: he lands on it, he dies under it, or he is nudged aside.
 *
 * It runs only while Mario is airborne, and only on one board — a board gate closes it
 * everywhere else, and when it is closed the caller carries on completely untouched.
 *
 * With the gate open it asks the overlap search whether Mario is touching any of the six records
 * in the object array, allowing 8 pixels vertically and 4 horizontally around his position before
 * each record's own extents are considered. No overlap and again nothing happens.
 *
 * On an overlap the contact is judged from where Mario was BEFORE this frame's motion, against a
 * line 4 above the matched object's own position. That gives three outcomes:
 *
 *   - clearly ABOVE the line: he LANDS on the object. His Y is placed a standing height above
 *     the line and the just-repositioned flag is raised, which is the one-shot the footing and
 *     ride code reads.
 *   - clearly BELOW it: he DIES — the flag that keeps him active is cleared.
 *   - in between: he met the object SIDE-ON, and his X is snapped to the middle of the 8-pixel
 *     cell he is standing in, written both to his position and to the sprite record that draws
 *     him.
 *
 * The two acting outcomes take control away from the caller: the airborne handler two levels up
 * resumes instead, and it reads what happened here to either finish landing Mario or keep him
 * airborne with his velocity cleared. The plain returns let the caller carry on.
 *
 * ONE BRANCH IS COLLAPSED HERE, and it is worth saying because the collapse is not obvious. The
 * side-on case originally chooses between two ways of computing the snapped X depending on
 * whether the horizontal airborne velocity's high byte is zero: take X minus 8, set the low three
 * bits, add 4; or set the low three bits and subtract 4. Those are the SAME function of X for all
 * 256 inputs, wrapping ones included — both come to 8 times floor(X/8), plus 3 — so the velocity
 * cannot change the value that gets stored, and only one expression is left below.
 *
 * NOT CLAIMED: what the objects in this array actually are on this board. Naming this routine
 * for them would import an identity nothing here derives, which is why the name stays
 * address-shaped.
 *
 * LIVE-OUT: Mario's Y and the just-repositioned flag on the landing arm; his active flag on the
 * kill arm; his X and his sprite record's X on the side-on arm. Plus the answer that says whether
 * the caller resumes, and — on the two arms that skip it — the two values the airborne handler
 * reads to tell landing from a side contact. The matched record is left in the index register for
 * that same handler.
 */

import { u8 } from "../../../core/int.js";
import { boardBitGate } from "./boardBitGate.js";
import { loc_2a22 } from "./loc_2a22.js";
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

// The object array the search is bound to: six records, 16 bytes apart.
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

  // Does Mario overlap any of the six records? The search takes its reference point and its
  // spans through registers, so they are staged here.
  regs.iy = MARIO_ACTIVE; // Mario's object-record base; the search reads its X out of that
  regs.c = mem8[MARIO_Y];
  regs.l = CONTACT_SPAN_Y;
  regs.h = CONTACT_SPAN_X;
  loc_2a22(m);
  if (regs.a === 0) return true; // no overlap -> nothing to resolve

  // The search reports which record matched as the count minus its index; recover the record.
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;
  regs.ix = record; // left for the handler two levels up

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
  // moves from and the sprite record that draws him. (This is the collapsed branch: the
  // velocity test picks between two expressions that compute the same value.)
  const snappedX = (mem8[MARIO_X] | CELL_LOW_BITS) - CELL_HALF;
  mem8[MARIO_X] = snappedX;
  mem8[MARIO_SPRITE_RECORD + SPRITE_X] = snappedX;
  regs.a = 1;
  regs.b = 0; // the handler two levels up reads this as "keep him airborne"
  return false; // skip the caller
}

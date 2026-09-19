// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29af — resolve what happens when an airborne Mario meets a moving object in this board's
 * object array: he lands on it, he dies under it, or he is nudged aside. Runs only while Mario is
 * airborne and only on board 3 — a board gate closes it elsewhere, leaving the caller untouched.
 * With the gate open the overlap search is asked whether Mario touches any of the six records,
 * allowing 8px vertically and 4px horizontally around his position. On an overlap the contact is
 * judged from where Mario was BEFORE this frame's motion, against a line 4 above the object's Y:
 *   - clearly above -> he LANDS: Y set a standing height above the line, just-repositioned flag raised.
 *   - clearly below -> he DIES: the flag that keeps him active is cleared.
 *   - between      -> SIDE-ON: X snapped to the middle of his 8px cell, written to position and sprite.
 *
 * ONE BRANCH IS COLLAPSED: the side-on case originally picked between two ways of computing the
 * snapped X on the horizontal-velocity high byte, but both equal 8*floor(X/8)+3 for all 256 inputs
 * (wraps included), so the velocity cannot change the stored value and only one expression remains.
 * NOT CLAIMED: what the objects in this array are on this board — hence the address-shaped name.
 *
 * LIVE-OUT: Mario's Y and just-repositioned flag (land arm); his active flag (kill arm); his X and
 * his sprite record's X (side-on arm); plus the answer that says whether the caller resumes and the
 * two values the airborne handler reads. The matched record is left in the index register.
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

// Board applicability mask: bit2 selects board 3.
const BOARD_MASK = 0x04;

const CONTACT_SPAN_Y = 8; // overlap spans handed to the search, before per-record extras
const CONTACT_SPAN_X = 4;

// The object array: six records, 16 bytes apart.
const RECORD_COUNT = 6;
const RECORD_STRIDE = 16;

// Contact line sits 4 above the object's Y; Mario stands 8 above that line.
const CONTACT_LINE_RISE = 4;
const STANDING_HEIGHT = 8;

// Clearance the pre-motion Y needs to read as above (lands) or below (dies); larger Y is LOWER.
const ABOVE_CLEARANCE = 5;
const BELOW_CLEARANCE = 14;

// Side-on X snap: set the low 3 bits to the cell's right edge, then step back 4 to its middle.
const CELL_LOW_BITS = 0x07;
const CELL_HALF = 4;

// Returns true when control reached OUR CALLER (gate closed, or a non-acting outcome); false when
// the caller is skipped and the airborne handler two levels up resumes instead.
export function loc_29af(m) {
  const { regs, mem8 } = m;

  // Board gate: this contact check belongs to one board only.
  if (!boardBitGate(m, BOARD_MASK)) return true;

  // Stage the search's reference point and spans in registers (iy is Mario's record base).
  regs.iy = MARIO_ACTIVE;
  regs.c = mem8[MARIO_Y];
  regs.l = CONTACT_SPAN_Y;
  regs.h = CONTACT_SPAN_X;
  loc_2a22(m);
  if (regs.a === 0) return true;

  // Match is reported as count minus index; recover the record, left in ix for the handler.
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;
  regs.ix = record;

  const contactLine = u8(mem8[record + OBJ_Y] - CONTACT_LINE_RISE);
  const previousY = mem8[MARIO_AIR_PREV_Y];

  // Clearly above the line before this frame's motion -> Mario lands on the object.
  if (u8(previousY + ABOVE_CLEARANCE) < contactLine) {
    mem8[MARIO_Y] = contactLine - STANDING_HEIGHT;
    mem8[EDGE_REPOSITION_FLAG] = 1;
    regs.a = 1;
    regs.b = 1;
    return false;
  }

  // Clearly below it -> Mario is killed.
  if (u8(previousY - BELOW_CLEARANCE) >= contactLine) {
    mem8[MARIO_ACTIVE] = 0;
    regs.a = 0;
    return true;
  }

  // Side-on contact -> snap Mario to the middle of his 8px cell, in position and sprite record.
  const snappedX = (mem8[MARIO_X] | CELL_LOW_BITS) - CELL_HALF;
  mem8[MARIO_X] = snappedX;
  mem8[MARIO_SPRITE_RECORD + SPRITE_X] = snappedX;
  regs.a = 1;
  regs.b = 0; // the handler reads b as land(1)/stay-airborne(0)
  return false;
}

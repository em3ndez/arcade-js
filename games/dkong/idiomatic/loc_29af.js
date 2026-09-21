// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29af — resolve what happens when an airborne Mario meets a moving object in this board's
 * object array: he lands on it, he dies under it, or he is nudged aside. Runs only while Mario is
 * airborne and only on board 3 — a board gate closes it elsewhere, leaving the caller untouched.
 * With the gate open the overlap search checks Mario against the six records (8px vertically, 4px
 * horizontally). On an overlap the contact is judged from his pre-motion Y, against a line 4 above
 * the object's Y:
 *   - clearly above -> he LANDS: Y set a standing height above the line, just-repositioned flag raised.
 *   - clearly below -> he DIES: the flag that keeps him active is cleared.
 *   - between      -> SIDE-ON: X snapped to the middle of his 8px cell, written to position and sprite.
 * ONE BRANCH IS COLLAPSED: the side-on case's two ways of computing the snapped X both equal
 * 8*floor(X/8)+3 for all inputs, so one expression remains. LIVE-OUT: the search verdict A + the
 * land/stay-airborne selector B the airborne handler reads; Mario's cells go to RAM.
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

  // Run the six-record overlap search against Mario: reference point c = his Y, spans l/h, base iy.
  loc_2a22(m, mem8[MARIO_Y], CONTACT_SPAN_Y, MARIO_ACTIVE, CONTACT_SPAN_X);
  if (regs.a === 0) return true;

  // Match is reported as count minus index; recover the record — it rides each arm's return into
  // ix for the handler (set on every post-match path, as before the standalone write).
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;

  const contactLine = u8(mem8[record + OBJ_Y] - CONTACT_LINE_RISE);
  const previousY = mem8[MARIO_AIR_PREV_Y];

  // Clearly above the line before this frame's motion -> Mario lands on the object.
  if (u8(previousY + ABOVE_CLEARANCE) < contactLine) {
    mem8[MARIO_Y] = contactLine - STANDING_HEIGHT;
    mem8[EDGE_REPOSITION_FLAG] = 1;
    return (regs.ix = record, regs.a = 1, regs.b = 1, false);
  }

  // Clearly below it -> Mario is killed.
  if (u8(previousY - BELOW_CLEARANCE) >= contactLine) {
    mem8[MARIO_ACTIVE] = 0;
    return (regs.ix = record, regs.a = 0, true);
  }

  // Side-on contact -> snap Mario to the middle of his 8px cell, in position and sprite record.
  const snappedX = (mem8[MARIO_X] | CELL_LOW_BITS) - CELL_HALF;
  mem8[MARIO_X] = snappedX;
  mem8[MARIO_SPRITE_RECORD + SPRITE_X] = snappedX;
  // the handler reads b as land(1)/stay-airborne(0)
  return (regs.ix = record, regs.a = 1, regs.b = 0, false);
}

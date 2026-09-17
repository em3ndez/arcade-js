// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSpringArcAndDropAtTravelEnd — the spring's per-object body: store the current
 * animation-string pointer back into the record (low +0x0e, high +0x0f) so the next pass resumes
 * the arc, then drop the spring only when it has reached the far X limit AND the last string byte
 * was the terminator — handing it to NEXT_STATE and firing a transition sound. Every path then
 * mirrors the position to the sprite record and advances both scan cursors through the shared tail.
 * The object/sprite cursors, string pointer and last-read string byte arrive in registers.
 *
 * LIVE-OUT: the pointer stores and, on the drop path, the state byte and the two sound-trigger
 * shadows, plus the mirror tail's sprite writes and advanced cursors.
 */

import { OBJ_X, OBJ_STATE, SND_TRIGGER } from "./names.js";
import { mirrorObjectPositionToSprite } from "./mirrorObjectPositionToSprite.js";

const OBJ_STR_PTR = 0x0e; // 16-bit animation-string pointer: low +0x0e, high +0x0f
const X_BOUNDARY = 0xb7;
const STRING_TERMINATOR = 0x7f;
const NEXT_STATE = 4;

export function advanceSpringArcAndDropAtTravelEnd(m, ix = m.regs.ix, l = m.regs.l, h = m.regs.h, c = m.regs.c) {
  const { mem8 } = m;

  mem8[ix + OBJ_STR_PTR] = l;
  mem8[ix + OBJ_STR_PTR + 1] = h;

  if (mem8[ix + OBJ_X] >= X_BOUNDARY && c === STRING_TERMINATOR) {
    mem8[ix + OBJ_STATE] = NEXT_STATE;
    mem8[SND_TRIGGER + 3] = 0;
    mem8[SND_TRIGGER + 4] = 3;
  }

  mirrorObjectPositionToSprite(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/** stampCopyrightStrip — park the four pieces of one fixed caption strip in the display list.
 * Four consecutive object entries are filled entirely from constants: a shared position on one
 * axis and a shared control byte, shapes counting up from the first, and positions on the other
 * axis stepping one piece-width apart so the pieces butt together into a single strip. Each
 * entry is split across two halves a fixed distance apart, which is why every piece takes two
 * writes on each side. Nothing is read and nothing branches, so the same sixteen bytes land on
 * every call and a second call changes nothing the first did not.
 * LIVE-OUT: memory only. */

import { PLAYER_ENTRY } from "./names.js";
const PIECES = 4;
const ENTRY_STRIDE = 2;
const SHAPE = 1;
const CONTROL = 48;
const SECOND_AXIS = 49;

const FIXED_AXIS_VALUE = 216;
const CONTROL_VALUE = 108;
const FIRST_SHAPE = 4;
const LEADING_EDGE = 160;
const PIECE_PITCH = 16;

export function stampCopyrightStrip(m) {
  const { mem8 } = m;
  for (let piece = 0; piece < PIECES; piece++) {
    const entry = PLAYER_ENTRY + piece * ENTRY_STRIDE;
    mem8[entry] = FIXED_AXIS_VALUE;
    mem8[entry + SHAPE] = FIRST_SHAPE + piece;
    mem8[entry + CONTROL] = CONTROL_VALUE;
    mem8[entry + SECOND_AXIS] = LEADING_EDGE - piece * PIECE_PITCH;
  }
}

// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_ALT_LO, DRAW_CURSOR_ALT_HI } from "./names.js";

/**
 * swapDrawPointers — exchange the primary and alternate vector-write cursors. ROM 0xb944.
 *
 * Role in the machine: Tempest builds its vector display list through a write cursor, but the object
 * renderer needs to lay down "shadow" passes (a second structure) interleaved with the main list. Rather
 * than thread two pointers everywhere, the code keeps a primary cursor ($74/$75, DRAW_CURSOR_LO/HI) and an
 * alternate ($76/$77, DRAW_CURSOR_ALT_LO/HI) and flips between them by swapping the two 16-bit values.
 * drawMovingObjectSlots ($b8ba) calls this to switch the shared cursor onto the other structure for a pass
 * and again to switch back.
 *
 * Behavior: save the primary pointer's low and high bytes, copy the alternate pointer into the primary
 * slots, then store the saved primary bytes into the alternate slots -- a straight two-word exchange.
 *
 * Live-out: DRAW_CURSOR_LO/HI and DRAW_CURSOR_ALT_LO/HI, with their prior contents swapped. Grounding: [seen].
 */
export function swapDrawPointers(m) {
  const { mem8 } = m;
  const lo = mem8[DRAW_CURSOR_LO]; // save the primary pointer's low byte
  const hi = mem8[DRAW_CURSOR_HI]; // save the primary pointer's high byte
  mem8[DRAW_CURSOR_LO] = mem8[DRAW_CURSOR_ALT_LO]; // primary <- alternate (low)
  mem8[DRAW_CURSOR_HI] = mem8[DRAW_CURSOR_ALT_HI]; // primary <- alternate (high)
  mem8[DRAW_CURSOR_ALT_LO] = lo; // alternate <- saved primary (low)
  mem8[DRAW_CURSOR_ALT_HI] = hi; // alternate <- saved primary (high)
}

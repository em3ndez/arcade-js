// SPDX-License-Identifier: GPL-3.0-only
/** loc_460e — fire once when a watched pair of cells stops agreeing: step a shared counter down,
 * seat two vertical bytes and two glyph bytes into one object slot, ask for a sound when the trigger
 * cell is armed, and queue one display command. When the pair still agrees it does nothing.
 * LIVE-OUT: memory. */

import { loc_580b } from "./loc_580b.js";
import { postCommand } from "./postCommand.js";

const WATCHED = 0xa67c;
const MIRROR = 0xab43;
const SOUND_TRIGGER = 0xa800;
const SLOT_VERTICAL_A = 0x01;
const SLOT_VERTICAL_B = 0x03;
const SLOT_GLYPH_A = 0x30;
const SLOT_GLYPH_B = 0x32;

export function loc_460e(m, counterBase = m.regs.ix, slotBase = m.regs.iy) {
  const { mem8 } = m;
  if (mem8[MIRROR] === mem8[WATCHED]) return;

  mem8[counterBase] = mem8[counterBase] - 1;
  mem8[(slotBase + SLOT_VERTICAL_A) & 0xffff] = 0xfe;
  mem8[(slotBase + SLOT_VERTICAL_B) & 0xffff] = 0xfd;
  mem8[(slotBase + SLOT_GLYPH_A) & 0xffff] = 0x6c;
  mem8[(slotBase + SLOT_GLYPH_B) & 0xffff] = 0x6c;

  if (mem8[SOUND_TRIGGER] === 0xff) loc_580b(m);
  return postCommand(m, 0x04, 0x0d);
}

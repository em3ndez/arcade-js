// SPDX-License-Identifier: GPL-3.0-only
/** setUpTwoPlayerStartObjectOnce — fire once when a watched pair of cells stops agreeing: step a shared counter down,
 * seat two vertical bytes and two glyph bytes into one object slot, ask for a sound when the trigger
 * cell is armed, and queue one display command. When the pair still agrees it does nothing.
 * LIVE-OUT: memory. */

import { requestMotherShipWarpSound } from "./requestMotherShipWarpSound.js";
import { postCommand } from "./postCommand.js";
import { PLAYER_STATE, TAMPER_GLYPH_COPY, loc_a67c } from "./names.js";

const SLOT_VERTICAL_A = 0x01;
const SLOT_VERTICAL_B = 0x03;
const SLOT_GLYPH_A = 0x30;
const SLOT_GLYPH_B = 0x32;

export function setUpTwoPlayerStartObjectOnce(m, counterBase = m.regs.ix, slotBase = m.regs.iy) {
  const { mem8 } = m;
  if (mem8[TAMPER_GLYPH_COPY] === mem8[loc_a67c]) return;

  mem8[counterBase] = mem8[counterBase] - 1;
  mem8[(slotBase + SLOT_VERTICAL_A) & 0xffff] = 0xfe;
  mem8[(slotBase + SLOT_VERTICAL_B) & 0xffff] = 0xfd;
  mem8[(slotBase + SLOT_GLYPH_A) & 0xffff] = 0x6c;
  mem8[(slotBase + SLOT_GLYPH_B) & 0xffff] = 0x6c;

  if (mem8[PLAYER_STATE] === 0xff) requestMotherShipWarpSound(m);
  return postCommand(m, 0x04, 0x0d);
}

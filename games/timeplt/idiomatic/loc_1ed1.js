// SPDX-License-Identifier: GPL-3.0-only
/** loc_1ed1 — hand back the control word of the cabinet panel that faces the picture.
 * Both panels are mirrored into work RAM every frame and a flag cell selects between them.
 * LIVE-OUT: that word, returned and left in the register file; nothing is written here. */

const SCREEN_UNFLIPPED = 0xa987;
const MAIN_PANEL_CONTROLS = 0xa9af;
const COCKTAIL_PANEL_CONTROLS = 0xa9b0;

export function loc_1ed1(m) {
  const { regs, mem8 } = m;
  const flipped = mem8[SCREEN_UNFLIPPED] === 0;
  const panel = flipped ? COCKTAIL_PANEL_CONTROLS : MAIN_PANEL_CONTROLS;
  regs.a = mem8[panel];
  return regs.a;
}

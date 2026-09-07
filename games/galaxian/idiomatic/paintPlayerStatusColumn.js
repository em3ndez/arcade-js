// SPDX-License-Identifier: GPL-3.0-only
// paintPlayerStatusColumn -- ROM 0x20cd, grounding [seen].
// Paints the three-cell VRAM column of the player-status indicator (the stacked
// glyph at the edge of the screen). Starting from the destination tilemap
// address in HL and stepping by the stride in DE, it writes the top cell =
// code+1 (an incremented character code passed in A) and two fixed tiles below
// it. After painting, and only when the caller's flags(B) bit4 is clear and the
// mode gate loc_4006 (0x4006) reads zero, it clears the saved status flag cell
// loc_40ab (0x40ab). The A/HL/DE/B defaults mirror the Z80 register entry
// convention; the caller repaintPlayerStatusColumn (ROM 0x20ac) sets them up.
// Live-out: three VRAM cells written; loc_40ab optionally cleared.
import { u16 } from "../../../core/int.js";
import { loc_4006, loc_40ab } from "./names.js";

// The two fixed lower tiles of the column, and the flag bit (B bit4) that, when
// set, tells this routine to leave the saved status flag untouched.
const TILE_MID = 0x25; // middle-row tile
const TILE_BOTTOM = 0x20; // bottom-row tile
const HIDE_BIT = 0x10; // B bit 4: when set, leave the status flag alone

export function paintPlayerStatusColumn(m, code = m.regs.a, dest = m.regs.hl, stride = m.regs.de, flags = m.regs.b) {
  const { mem8 } = m;

  // Top cell: the character code plus one. Stepping by `stride` (DE) after each
  // write walks down the column -- the stride carries the VRAM row-to-row gap.
  let cell = dest;
  mem8[cell] = code + 1; // top cell: incremented char code
  // Middle cell: a fixed tile.
  cell = u16(cell + stride);
  mem8[cell] = TILE_MID;
  // Bottom cell: a fixed tile.
  cell = u16(cell + stride);
  mem8[cell] = TILE_BOTTOM;

  // Optionally clear the saved status flag. If flags(B) bit4 is set the caller
  // wants the flag left alone; if the mode gate loc_4006 is nonzero we also skip
  // it; only when both say "go" do we zero loc_40ab.
  if (flags & HIDE_BIT) return;
  if (mem8[loc_4006] !== 0) return;
  mem8[loc_40ab] = 0; // clear the status flag
}

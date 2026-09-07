// SPDX-License-Identifier: GPL-3.0-only
//
// selectPlayerStatusVram — resolve the VRAM base of a player's status column.
//
// WHAT IT IS
//   A pure selector keyed on the player index (defaulting to register A, the Z80 entry value):
//   index 0 returns PLAYER1_STATUS_VRAM (0x5340), any other value returns PLAYER2_STATUS_VRAM
//   (0x50e0). The chosen base is returned in HL; it touches no memory.
//
// ROLE IN THE MACHINE
//   Each player has a three-cell status column in the tilemap (lives/ships indicator). The
//   repaint routine repaintPlayerStatusColumn (0x20ac) calls this to point HL at the correct
//   column for the current (or paired) player before painting or blanking it.
//
// ROM 0x214e.  Grounding: [seen].
// LIVE-OUT: m.regs.hl = the selected status-column VRAM base.
import { PLAYER1_STATUS_VRAM, PLAYER2_STATUS_VRAM } from "./names.js";

export function selectPlayerStatusVram(m, playerIndex = m.regs.a) {
  // Player one (index 0) -> its column base; anything else -> player two's column base, in HL.
  return (m.regs.hl = playerIndex === 0 ? PLAYER1_STATUS_VRAM : PLAYER2_STATUS_VRAM);
}

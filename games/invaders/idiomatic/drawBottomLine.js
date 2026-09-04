// SPDX-License-Identifier: GPL-3.0-only
import { fillScreenRow } from "./fillScreenRow.js";
import { PLAYFIELD_VRAM_BASE } from "./names.js";

/**
 * drawBottomLine — paint the one-pixel ground line across the full width of the play field.
 *
 * WHAT IT IS
 *   Lays down the horizontal floor the player ship and shields sit on: a single lit pixel row spanning
 *   all 0xe0 (224) screen columns, drawn along the very bottom of the play area.
 *
 * ROLE IN THE MACHINE
 *   The framebuffer is treated as 32-byte columns walked top-to-bottom; the ground line lives at
 *   offset 0x02 of every column — which is exactly PLAYFIELD_VRAM_BASE (0x2402), the first playfield
 *   byte, two bytes above VIDEO_RAM_BASE (see mechanisms.md "Video RAM and the framebuffer"). That
 *   byte is the first one clearPlayfield erases (its wipe starts at 0x2402), so the ground line does
 *   NOT survive a play-field wipe — this routine must redraw it after each clear (hence the call at
 *   round setup). It delegates to the shared fill primitive fillScreenRow with the lit byte 0x01, a
 *   pass count of 0xe0, and the base address, which stores 0x01 and steps one column (+0x20) per pass
 *   across the whole width.
 *
 * ROM 0x01cf.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL = the fill pointer left one stride past the last column (fillScreenRow's end pointer).
 */
export function drawBottomLine(m) {
  // Fill the lit byte 0x01 into offset 0x02 of all 0xe0 columns, one column-step (0x20) apart, from
  // PLAYFIELD_VRAM_BASE — a full-width one-pixel floor at the first byte clearPlayfield erases.
  return fillScreenRow(m, 0x01, 0xe0, PLAYFIELD_VRAM_BASE);
}

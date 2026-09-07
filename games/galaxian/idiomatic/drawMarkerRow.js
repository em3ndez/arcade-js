// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawMarkerRow — repaint the five-slot HUD marker row (the bonus-marker indicators).
 *
 * WHAT IT IS
 *   Redraws the row of up to five markers at MARKER_ROW_VRAM (0x539e). It stamps `markers` filled marker
 *   tiles (code 102) growing upward from the row's base cell, then blanks the leftover slots so the row
 *   always shows exactly five cells' worth of state. It is the HUD half of the bonus-marker mechanism:
 *   awardBonusMarker bumps the marker counter and calls here to repaint.
 *
 * ROLE IN THE MACHINE
 *   Both stampers draw a 2x2 tile block growing upward and hand back the advanced pointer (`.hl`):
 *   drawTileBlock2x2Up (0x2593) stamps the filled marker (tile 102), drawFixedTileBlock2x2Up (0x2591)
 *   stamps the blank decorative block (fixed seed 46) used for empty slots. Two twists on the count:
 *     - When OBJ_ACTIVE_FLAG (0x4200) is set (the object/AI subsystem live, i.e. in-play), the DISPLAYED
 *       count is one less than the stored count — one marker is dropped for the frame.
 *     - If that drop empties the count, `blankOnly` is set and the fill loop is skipped so every slot is
 *       blanked instead.
 *   The five slots are walked by a single signed slot counter that starts at 5 and is decremented through
 *   both loops; the blank loop ends when that counter underflows below zero, detected as a u8 value >= 128
 *   (the Z80 tested the sign bit). The fill loop is a do-while, mirroring the Z80's count-in-B loop where
 *   a count of zero wraps to a full pass.
 *
 * ROM 0x22b3.  Grounding: [seen].
 *
 * LIVE-OUT: the five-slot marker row repainted in VRAM (no work-RAM write).
 */
import { drawTileBlock2x2Up } from "./drawTileBlock2x2Up.js";
import { drawFixedTileBlock2x2Up } from "./drawFixedTileBlock2x2Up.js";
import { OBJ_ACTIVE_FLAG, MARKER_ROW_VRAM } from "./names.js";
import { u8 } from "../../../core/int.js";

const SLOTS = 5;
const MARKER_TILE = 102;

export function drawMarkerRow(m, markers = m.regs.b) {
  const { mem8 } = m;
  // Draw cursor starts at the marker row's base VRAM cell; the slot counter spans all five slots.
  let dst = MARKER_ROW_VRAM;
  let slot = SLOTS;

  // In-play adjustment: while the object subsystem is active, show one fewer marker; if that empties
  // the count, blank the whole row instead of drawing any markers.
  let blankOnly = false;
  if (mem8[OBJ_ACTIVE_FLAG] !== 0) {
    markers = u8(markers - 1);
    if (markers === 0) blankOnly = true;
  }

  // Fill pass: stamp one filled marker (tile 102) per remaining marker, growing upward, spending a slot
  // each. Skipped entirely on the blank-only path.
  if (!blankOnly) {
    do {
      dst = drawTileBlock2x2Up(m, MARKER_TILE, dst).hl;
      slot = u8(slot - 1);
      markers = u8(markers - 1);
    } while (markers !== 0);
  }

  // Blank pass: fill every slot left in the row with the blank decorative block until the slot counter
  // underflows past zero (u8 >= 128 == the signed sign bit set).
  for (;;) {
    slot = u8(slot - 1);
    if (slot >= 128) return; // signed slot counter went negative
    dst = drawFixedTileBlock2x2Up(m, dst).hl;
  }
}

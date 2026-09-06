// SPDX-License-Identifier: GPL-3.0-only
// Draw the 5-slot marker row: paint `markers` marker tiles growing upward from the row cell, then blank
// the remaining slots. When the object-active flag is set one marker is dropped; if that empties the
// count every slot is blanked instead. The slot counter runs out when it goes negative as a signed byte.
import { drawTileBlock2x2Up } from "./drawTileBlock2x2Up.js";
import { drawFixedTileBlock2x2Up } from "./drawFixedTileBlock2x2Up.js";
import { OBJ_ACTIVE_FLAG, MARKER_ROW_VRAM } from "./names.js";
import { u8 } from "../../../core/int.js";

const SLOTS = 5;
const MARKER_TILE = 102;

export function drawMarkerRow(m, markers = m.regs.b) {
  const { mem8 } = m;
  let dst = MARKER_ROW_VRAM;
  let slot = SLOTS;

  let blankOnly = false;
  if (mem8[OBJ_ACTIVE_FLAG] !== 0) {
    markers = u8(markers - 1);
    if (markers === 0) blankOnly = true;
  }

  if (!blankOnly) {
    do {
      dst = drawTileBlock2x2Up(m, MARKER_TILE, dst).hl;
      slot = u8(slot - 1);
      markers = u8(markers - 1);
    } while (markers !== 0);
  }

  for (;;) {
    slot = u8(slot - 1);
    if (slot >= 128) return; // signed slot counter went negative
    dst = drawFixedTileBlock2x2Up(m, dst).hl;
  }
}

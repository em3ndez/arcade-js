// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_COUNTER } from "./names.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { buildTextOverlayList } from "./buildTextOverlayList.js";

// Draw one vector list, add a second while a status nibble is still low, then run frame setup.
export function loc_aa79(m) {
  const { mem8 } = m;
  drawSlotShapeWithHeader(m, 0x00, 0x32);
  if ((mem8[FRAME_COUNTER] & 0x1f) < 0x10) drawSlotShapeWithHeader(m, 0xe0, 0x22);
  return buildTextOverlayList(m);
}

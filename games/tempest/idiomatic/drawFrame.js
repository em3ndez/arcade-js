// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { STATUS_FLAGS, DRAW_RECORD_PTR_LO, DRAW_RECORD_PTR_HI, REDRAW_COUNTER, PLAYER_SHAPE_SUM, VECHEAD0_FRAME, VECHEAD1_FRAME, VEC_LIST_HEADER_LO, VEC_LIST_HEADER_HI } from "./names.js";
import { seatDrawCursor } from "./seatDrawCursor.js";
import { closeLayerPointer } from "./closeLayerPointer.js";
import { drawScoreStatusList } from "./drawScoreStatusList.js";
import { drawSlotShapeList } from "./drawSlotShapeList.js";
import { drawStyledSlotList } from "./drawStyledSlotList.js";
import { drawEnemyShapeList } from "./drawEnemyShapeList.js";
import { buildObjectDisplayList } from "./buildObjectDisplayList.js";
import { buildTextOverlayList } from "./buildTextOverlayList.js";
import { paintRimLanes } from "./paintRimLanes.js";
import { buildEnemyDisplayList } from "./buildEnemyDisplayList.js";
import { drawTimedObjectList } from "./drawTimedObjectList.js";

// Draw one frame: each subsystem runs bracketed by a setup/teardown pair keyed to its
// layer id. Between the player layer's brackets, when the sign flag is clear, sum a
// 40-byte source block (carry-chained) into a status cell. Clear the change counter, then
// latch two constants into the first two display words.
export function drawFrame(m) {
  const { mem8 } = m;
  seatDrawCursor(m, 0x07);
  drawScoreStatusList(m);
  closeLayerPointer(m, 0x07);

  seatDrawCursor(m, 0x04);
  drawSlotShapeList(m);
  closeLayerPointer(m, 0x04);

  seatDrawCursor(m, 0x03);
  drawStyledSlotList(m);
  closeLayerPointer(m, 0x03);

  seatDrawCursor(m, 0x06);
  drawEnemyShapeList(m);
  closeLayerPointer(m, 0x06);

  seatDrawCursor(m, 0x05);
  buildObjectDisplayList(m);
  closeLayerPointer(m, 0x05);

  seatDrawCursor(m, 0x00);
  buildTextOverlayList(m);
  if (!(mem8[STATUS_FLAGS] & 0x80)) {
    const ptr = mem8[DRAW_RECORD_PTR_LO] | (mem8[DRAW_RECORD_PTR_HI] << 8);
    let a = 0xf2;
    let carry = 0;
    for (let y = 0x27; y >= 0; y--) {
      const s = a + mem8[u16(ptr + y)] + carry;
      a = s & 0xff;
      carry = s > 0xff ? 1 : 0;
    }
    mem8[PLAYER_SHAPE_SUM] = a;
  }
  closeLayerPointer(m, 0x00);
  paintRimLanes(m);

  seatDrawCursor(m, 0x01);
  buildEnemyDisplayList(m);
  closeLayerPointer(m, 0x01);

  seatDrawCursor(m, 0x08);
  drawTimedObjectList(m);
  closeLayerPointer(m, 0x08);

  mem8[REDRAW_COUNTER] = 0x00;
  mem8[VEC_LIST_HEADER_LO] = mem8[VECHEAD0_FRAME];
  mem8[VEC_LIST_HEADER_HI] = mem8[VECHEAD1_FRAME];
}

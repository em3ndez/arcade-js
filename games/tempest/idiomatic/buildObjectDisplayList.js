// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, PLAYER_LEVEL_TBL, IRQ_HEARTBEAT, PROJ_PT_Y, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI,
  PROJ_OFS_X_LO, PROJ_OFS_X_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI, loc_9e, CHECKSUM_ACC,
  OBJECT_INDEX_TABLE, OBJECT_RECORD_TABLE, OBJ_DY_HI, OBJ_DY_LO, OBJ_DX_HI, OBJ_DX_LO,
} from "./names.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";

// Build a vector display list for up to 0x12 active objects, emitting a header word,
// screen-relative coordinate words, and their negated shadow words for each object,
// flushing the cursor when the byte offset saturates, then close with a trailing header.
export function buildObjectDisplayList(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x0c;
  emitTaggedVectorWord(m, 0x08, 0x0c);
  layHeaderAndBuildRecord(m, 0x66);
  mem8[PROJ_PT_Y] = 0x12;
  mem8[SLOT_LOOP_INDEX] = 0x3f;
  let y = 0x00;

  while (true) {
    const idx = mem8[SLOT_LOOP_INDEX];
    const kind = mem8[u16(OBJECT_RECORD_TABLE + idx)];
    if (kind !== 0) {
      const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);
      let carry = kind >= 0x50 ? 1 : 0;
      if (kind >= 0x50) mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
      mem8[u16(base + y)] = kind & 0x3f;
      // Rotate the raw kind three times to lift its top bits into a small header code.
      let rot = kind;
      for (let i = 0; i < 3; i++) {
        const nextC = (rot >> 7) & 1;
        rot = ((rot << 1) | carry) & 0xff;
        carry = nextC;
      }
      const header = ((rot & 0x03) + 1) | 0x70;
      y = (y + 1) & 0xff;
      mem8[u16(base + y)] = header;
      y = (y + 1) & 0xff;

      const obj = mem8[u16(OBJECT_INDEX_TABLE + idx)];
      const dxLo = mem8[u16(OBJ_DX_LO + obj)] - mem8[PROJ_OFS_X_LO];
      mem8[PROJ_X_LO] = dxLo;
      mem8[u16(base + y)] = dxLo;
      y = (y + 1) & 0xff;
      const dxHi = mem8[u16(OBJ_DX_HI + obj)] - mem8[PROJ_OFS_X_HI] - (dxLo < 0 ? 1 : 0);
      mem8[PROJ_X_HI] = dxHi;
      mem8[u16(base + y)] = dxHi & 0x1f;
      y = (y + 1) & 0xff;

      const dyLo = mem8[u16(OBJ_DY_LO + obj)];
      mem8[PROJ_Y_LO] = dyLo;
      mem8[u16(base + y)] = dyLo;
      y = (y + 1) & 0xff;
      const dyHi = mem8[u16(OBJ_DY_HI + obj)];
      mem8[PROJ_Y_HI] = dyHi;
      mem8[u16(base + y)] = dyHi & 0x1f;
      y = (y + 1) & 0xff;

      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0x00; y = (y + 1) & 0xff;
      mem8[u16(base + y)] = 0xa0; y = (y + 1) & 0xff;

      // Emit the negated shadow of each coordinate word.
      const nx = (mem8[PROJ_X_LO] ^ 0xff) + 1;
      mem8[u16(base + y)] = nx; y = (y + 1) & 0xff;
      const nxHi = (mem8[PROJ_X_HI] ^ 0xff) + (nx > 0xff ? 1 : 0);
      mem8[u16(base + y)] = nxHi & 0x1f; y = (y + 1) & 0xff;
      const ny = (mem8[PROJ_Y_LO] ^ 0xff) + 1;
      mem8[u16(base + y)] = ny; y = (y + 1) & 0xff;
      const nyHi = (mem8[PROJ_Y_HI] ^ 0xff) + (ny > 0xff ? 1 : 0);
      mem8[u16(base + y)] = nyHi & 0x1f; y = (y + 1) & 0xff;

      if (y >= 0xf0) {
        y = (y - 1) & 0xff;
        advanceDisplayCursor(m, y);
        y = 0x00;
      }
      const left = (mem8[PROJ_PT_Y] - 1) & 0xff;
      mem8[PROJ_PT_Y] = left;
      if (left & 0x80) break;
    }
    const rem = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = rem;
    if (rem & 0x80) break;
  }

  if (y !== 0) {
    y = (y - 1) & 0xff;
    advanceDisplayCursor(m, y);
  }
  if (mem8[CHECKSUM_ACC] !== 0 && mem8[PLAYER_LEVEL_TBL] >= 0x0a) mem8[IRQ_HEARTBEAT] = 0x7a;
  return emitBlankVectorWordTag70(m, 0x01);
}

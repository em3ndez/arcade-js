// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileColumn — the board-layout renderer's arm for segment kinds 4/5/6: fill a tilemap column
 * downward from SEG_ADDR1 with a kind-selected tile (4 -> 0xE0, 5 -> 0xB0, else 0xFE), paying
 * SEG_HEIGHT down one tile's pixels per row, then step the record pointer. Kind 7+ draws nothing
 * and only steps the pointer.
 *
 * LIVE-OUT: memory (SEG_TILE, SEG_HEIGHT and the tilemap cells) plus the record pointer.
 */

import { u16 } from "../../../core/int.js";
import { SEG_ADDR1, SEG_HEIGHT, SEG_KIND, SEG_TILE } from "./names.js";

export function fillTileColumn(m, de = m.regs.de) {
  const { regs, mem8, mem16 } = m;

  const kind = mem8[SEG_KIND];

  // A SIGN test, not an unsigned compare: kinds leaving the subtraction non-negative bail.
  if (((kind - 0x07) & 0x80) === 0) {
    regs.de = u16(de + 1);
    return;
  }

  let tile;
  if (kind === 0x04) tile = 0xe0;
  else if (kind === 0x05) tile = 0xb0;
  else tile = 0xfe;

  mem8[SEG_TILE] = tile;
  let addr = mem16[SEG_ADDR1];
  for (;;) {
    mem8[addr] = tile;
    addr = u16(addr + 0x20);
    const height = mem8[SEG_HEIGHT];
    mem8[SEG_HEIGHT] = (height - 0x08);
    if (height < 0x08) break;
  }

  regs.de = u16(de + 1);
}

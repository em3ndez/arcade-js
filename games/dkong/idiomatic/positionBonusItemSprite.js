// SPDX-License-Identifier: GPL-3.0-only
/**
 * positionBonusItemSprite — place the on-board bonus-item sprite at its current grid cell. The
 * cell index (2*C) looks up a stored (X, Y) position grid and stamps the item's 4-byte sprite
 * record (X, code 0x72, attr 0x0C, Y).
 *
 * LIVE-OUT: memory-only — the four sprite-record bytes.
 */
import { u16 } from "../../../core/int.js";
import {
  BONUS_ITEM_POSITION_TABLE,
  SPRITE_BUFFER,
} from "./names.js";

const RECORD = SPRITE_BUFFER + 0x74;

export function positionBonusItemSprite(m, b = m.regs.b, c = m.regs.c) {
  const { mem8 } = m;

  // BC is the full index; B is always 0 here, but the 16-bit add is preserved.
  const doubledC = (c << 1) & 0xff;
  const index = u16((b << 8) | doubledC);
  const entry = u16(BONUS_ITEM_POSITION_TABLE + index);

  const x = mem8[entry];
  const y = mem8[u16(entry + 1)];

  mem8[RECORD + 0] = x;
  mem8[RECORD + 1] = 0x72;
  mem8[RECORD + 2] = 0x0c;
  mem8[RECORD + 3] = y;
}

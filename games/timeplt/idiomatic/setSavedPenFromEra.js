// SPDX-License-Identifier: GPL-3.0-only
/** setSavedPenFromEra — copy the two-byte field that a player's round index selects out of an inline table
 * into that player's own record. Which player is read from and written to is the same choice, made
 * once from the player-up flag, so the two never cross. The index is doubled as a byte before it
 * reaches the table, so an index past the half-way mark folds back to the head of it.
 * LIVE-OUT: the two bytes written. */

import { u8, u16 } from "../../../core/int.js";
import { offsetAddress } from "./offsetAddress.js";
import { ACTIVE_PLAYER, PLAYER_ONE_ERA_INDEX, PLAYER_ONE_PEN_GLYPH, PLAYER_TWO_ERA_INDEX, PLAYER_TWO_PEN_GLYPH } from "./names.js";


const FIELD_TABLE = 0x0f8d;
const FIELD_WIDTH = 2;

export function setSavedPenFromEra(m) {
  const { regs, mem8 } = m;
  const secondPlayer = mem8[ACTIVE_PLAYER] !== 0;
  const field = secondPlayer ? PLAYER_TWO_PEN_GLYPH : PLAYER_ONE_PEN_GLYPH;
  const round = mem8[secondPlayer ? PLAYER_TWO_ERA_INDEX : PLAYER_ONE_ERA_INDEX];

  regs.hl = FIELD_TABLE;
  regs.a = u8(round * FIELD_WIDTH);
  const entry = offsetAddress(m);

  mem8[field] = mem8[entry];
  mem8[u16(field + 1)] = mem8[u16(entry + 1)];
}

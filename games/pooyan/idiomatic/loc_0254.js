// SPDX-License-Identifier: GPL-3.0-only
import { blankTileColumn } from "./blankTileColumn.js";
import { paintColumnBodyTiles } from "./paintColumnBodyTiles.js";
import { loc_02a8 } from "./loc_02a8.js";
import { verifyRomSignature } from "./verifyRomSignature.js";
import {
  WORKER_CONTROL_BYTE,
  WORKER_COLUMN_VRAM,
  COLUMN_CAP_VRAM,
  P2_SCORE_VRAM,
  GAME_ACTIVE_FLAG,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
} from "./names.js";
/**
 * loc_0254 — the per-frame worker dispatched by the attract/main state driver.
 *
 * If the control byte's low nibble is set it only runs the program-signature check and returns.
 * Otherwise, while a game is active, it repaints two three-tile scroll columns (four blank
 * columns then the shared column in one-player mode; a capped body column in two-player mode),
 * then optionally blanks one more column when the control byte's bit 4 and the game-active
 * bit 0 are both set. Every column steps one tilemap row up per cell.
 *
 * LIVE-OUT: none — the caller (main state driver) reloads all of its registers immediately
 * after this returns, so no register or flag it leaves is consumed.
 */

const ROW_UP = -0x20; //         one tilemap row up, the shared column stride
const CAP_TILE_2P = 0x02; //     the two-player column's cap tile
const LOW_NIBBLE = 0x0f;
const CONTROL_BIT4 = 0x10; //    gates the final blank column
const ACTIVE_BIT0 = 0x01; //     game-active low bit gates the final blank column

export function loc_0254(m) {
  const { mem8 } = m;
  const control = mem8[WORKER_CONTROL_BYTE];

  if ((control & LOW_NIBBLE) !== 0) {
    verifyRomSignature(m);
    return;
  }
  if (mem8[GAME_ACTIVE_FLAG] === 0) return;

  if (mem8[TWO_PLAYER_FLAG] === 0) {
    blankTileColumn(m, COLUMN_CAP_VRAM, ROW_UP);
    let cell = blankTileColumn(m, P2_SCORE_VRAM, ROW_UP);
    cell = blankTileColumn(m, cell, ROW_UP);
    blankTileColumn(m, cell, ROW_UP);
  } else {
    mem8[COLUMN_CAP_VRAM] = CAP_TILE_2P;
    paintColumnBodyTiles(m, COLUMN_CAP_VRAM, ROW_UP);
  }

  loc_02a8(m, WORKER_COLUMN_VRAM, ROW_UP);
  const column = mem8[ACTIVE_PLAYER] === 0 ? WORKER_COLUMN_VRAM : COLUMN_CAP_VRAM;

  if ((control & CONTROL_BIT4) === 0) return;
  if ((mem8[GAME_ACTIVE_FLAG] & ACTIVE_BIT0) === 0) return;
  blankTileColumn(m, column, ROW_UP);
}

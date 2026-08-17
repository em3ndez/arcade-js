// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardExtraLife — award an extra life: bump the active player's life count and stamp its marker.
 * LIVE-OUT: memory-only.
 */
import { loc_83cc, ACTIVE_PLAYER, PLAYER1_LIVES, PLAYER2_LIVES, LIVES_COUNT, LIVES_ROW_MARKER_BASE } from "./names.js";

const PLAYER_ONE = 1;
const LIFE_CAP = 16;
const MARKER_TILE = 76;
const ROW_STRIDE = 32;

export function awardExtraLife(m) {
  const { mem8 } = m;
  mem8[loc_83cc] = 0;

  const countCell = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? PLAYER1_LIVES : PLAYER2_LIVES;
  const count = (mem8[countCell] + 1) & 0xff;
  mem8[countCell] = count;
  mem8[LIVES_COUNT] = count;

  if (count >= LIFE_CAP) return; // capped -> no new marker
  mem8[(LIVES_ROW_MARKER_BASE + count * ROW_STRIDE)] = MARKER_TILE;
}

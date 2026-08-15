// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardExtraLife — award an extra life: bump the active player's life count and stamp its marker.
 * LIVE-OUT: memory-only.
 */
import { loc_83cc, ACTIVE_PLAYER, PLAYER1_LIVES, PLAYER2_LIVES, loc_83b7, loc_a85e } from "./names.js";

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
  mem8[loc_83b7] = count;

  if (count >= LIFE_CAP) return; // capped -> no new marker
  mem8[(loc_a85e + count * ROW_STRIDE) & 0xffff] = MARKER_TILE;
}

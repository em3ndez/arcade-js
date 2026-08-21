// SPDX-License-Identifier: GPL-3.0-only
import { ACTOR_TABLE, PLAYER_Y } from "./names.js";
/**
 * deriveStackedSpriteYs — fan the player's base Y out to the three stacked player-sprite slots.
 *
 * The player is drawn as three sprites stacked vertically. This takes the player-actor base Y and
 * writes it into the Y field of stacked slots 3/2/1: slot 3 gets the base Y, slot 2 gets Y-0x10,
 * and slot 1 gets Y-0x10+0x0a (0x0a below slot 2's top).
 *
 * LIVE-OUT: memory only. (A is left = base Y - 6, but no caller reads it — all four callers reload
 * from RAM immediately after the call.)
 */
export function deriveStackedSpriteYs(m) {
  const { mem8 } = m;

  // ACTOR_TABLE + 0x1c/0x34/0x4c are the Y field (+0x04) of actor slots 1/2/3 (stride 0x18).
  const y = mem8[PLAYER_Y];
  mem8[ACTOR_TABLE + 0x4c] = y;
  mem8[ACTOR_TABLE + 0x34] = y - 0x10;
  mem8[ACTOR_TABLE + 0x1c] = y - 0x10 + 0x0a;
}

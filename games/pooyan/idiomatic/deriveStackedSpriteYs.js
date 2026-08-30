// SPDX-License-Identifier: GPL-3.0-only
import { ACTOR_TABLE, PLAYER_Y } from "./names.js";
/**
 * deriveStackedSpriteYs — fan the player's base Y out to the three stacked player-sprite slots.
 *
 * ROM 0x23d7 — [seen]. The player character is too tall for one hardware sprite, so it is drawn
 * as three sprites stacked vertically. The game logic only tracks one Y for the player (its base
 * Y, PLAYER_Y); this routine derives the three per-slot Y coordinates from it every frame so the
 * three tiers stay locked together as the player moves.
 *
 * The three drawn slots live in the actor table (ACTOR_TABLE, 0x8a80) at a stride of 0x18 bytes,
 * each with its Y field at record offset +0x04 — so the Y fields sit at ACTOR_TABLE + 0x1c / 0x34
 * / 0x4c (slots 1 / 2 / 3). Reading downward on screen: slot 3 sits at the base Y, slot 2 one
 * tier up at Y-0x10, and slot 1 at Y-0x10+0x0a (0x0a below slot 2, i.e. Y-0x06) — the tiers
 * overlap slightly rather than abutting, which is what stitches the three sprites into one
 * seamless figure.
 *
 * PURE LEAF: reads PLAYER_Y, writes three Y fields; calls nothing.
 *
 * LIVE-OUT: memory only — the three slot Y fields. (The ROM leaves A holding base Y - 6, but no
 * caller reads it; every caller reloads from RAM immediately afterward.)
 */
export function deriveStackedSpriteYs(m) {
  const { mem8 } = m;

  // The player's single tracked Y. PLAYER_Y is ACTOR_TABLE + 0x04 — the base actor record's Y
  // field — and drives all three drawn tiers.
  const y = mem8[PLAYER_Y];

  // Bottom tier (slot 3): drawn at the base Y. ACTOR_TABLE + 0x4c is slot 3's Y field
  // (0x48 record base + 0x04 Y offset).
  mem8[ACTOR_TABLE + 0x4c] = y;

  // Middle tier (slot 2): one 0x10-pixel tier up the screen. ACTOR_TABLE + 0x34 is slot 2's Y
  // field (0x30 + 0x04).
  mem8[ACTOR_TABLE + 0x34] = y - 0x10;

  // Top tier (slot 1): 0x0a pixels below the middle tier (Y-0x10+0x0a = Y-0x06), so the top and
  // middle sprites overlap and read as one continuous figure. ACTOR_TABLE + 0x1c is slot 1's Y
  // field (0x18 + 0x04).
  mem8[ACTOR_TABLE + 0x1c] = y - 0x10 + 0x0a;
}

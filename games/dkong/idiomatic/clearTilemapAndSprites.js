// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTilemapAndSprites — blank every tilemap cell and zero the sprite shadow
 * buffer, a full-screen wipe for a mode/phase transition.
 *
 * LIVE-OUT: memory-only — the tilemap and sprite-buffer bytes.
 */

import { u16 } from "../../../core/int.js";
import {
  SPRITE_BUFFER,
  TILEMAP_BASE,
} from "./names.js";

const TILEMAP_BYTES = 0x400; // 1024 = every cell of the 32x32 tilemap
const BLANK_TILE = 0x10;

const SPRITE_BUFFER_BYTES = 0x180; // 384 = 96 sprite records x 4

export function clearTilemapAndSprites(m) {
  const { mem8 } = m;

  for (let i = 0; i < TILEMAP_BYTES; i++) {
    mem8[u16(TILEMAP_BASE + i)] = BLANK_TILE;
  }

  for (let i = 0; i < SPRITE_BUFFER_BYTES; i++) {
    mem8[u16(SPRITE_BUFFER + i)] = 0x00;
  }
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTilemapAndSprites — blank the ENTIRE tilemap and zero the sprite shadow
 * buffer, a blunt full-screen wipe for a mode/phase transition.
 *
 * Takes no inputs and calls nothing — a straight-line, constant memory transform
 * (every operand is an immediate; it reads no register and no RAM). Two fixed
 * fills, then return:
 *
 *   1. TILEMAP. Writes the blank tile 0x10 across ALL 1024 cells of the video-RAM
 *      tilemap, as one uninterrupted sweep. Unlike the narrower wipe used
 *      elsewhere, which fills only the central playfield columns plus the side
 *      columns, this blanks EVERY cell uniformly.
 *   2. SPRITE BUFFER. Zeroes the 384-byte sprite shadow buffer SPRITE_BUFFER = 96
 *      hardware sprite records x 4 bytes — the i8257 channel-0 DMA source blitted
 *      to sprite RAM each vblank.
 *
 * Invoked from the game-state / phase-transition path — a full wipe of the display
 * before the next scene is composed.
 *
 * LIVE-OUT: memory-only — the tilemap and sprite-buffer bytes. No live registers or
 * flags: the callers reload what they need before reading anything.
 */

import { SPRITE_BUFFER } from "./names.js";

const TILEMAP_BASE = 0x7400; // video-RAM tilemap: first cell
const TILEMAP_BYTES = 0x400; // 1024 = every cell of the 32x32 tilemap
const BLANK_TILE = 0x10;

const SPRITE_BUFFER_BYTES = 0x180; // 384 = 96 sprite records x 4

export function clearTilemapAndSprites(m) {
  const { mem } = m;

  // 1. Tilemap: blank every cell of video RAM to the blank tile.
  for (let i = 0; i < TILEMAP_BYTES; i++) {
    mem.write8((TILEMAP_BASE + i) & 0xffff, BLANK_TILE);
  }

  // 2. Sprite buffer: zero the 384-byte shadow buffer (the DMA source for sprite RAM).
  for (let i = 0; i < SPRITE_BUFFER_BYTES; i++) {
    mem.write8((SPRITE_BUFFER + i) & 0xffff, 0x00);
  }
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTilemapAndSprites — blank the ENTIRE tilemap and zero the sprite shadow
 * buffer, a blunt full-screen wipe for a mode/phase transition.  ROM 0x0852.
 *
 * Takes no inputs and calls nothing — a straight-line, constant memory transform
 * (every operand is an immediate; it reads no register and no RAM). Two fixed
 * fills, then return:
 *
 *   1. TILEMAP. Writes the blank tile 0x10 across ALL 1024 cells of the video-RAM
 *      tilemap, the contiguous span 0x7400-0x77FF (the oracle does it as 4 djnz
 *      runs of 256 — `ld b,0` == 256 — over an HL that is NOT reloaded between
 *      runs, so the 4x256 = 1024-byte walk is one uninterrupted sweep). Unlike its
 *      sibling clearPlayfieldAndSprites (ROM 0x0874), which fills only the central
 *      playfield columns + side columns, this blanks EVERY cell uniformly.
 *   2. SPRITE BUFFER. Zeroes the 384-byte sprite shadow buffer SPRITE_BUFFER
 *      (0x6900-0x6A7F) = 96 hardware sprite records x 4 bytes — the i8257
 *      channel-0 DMA source blitted to sprite RAM 0x7000 each vblank. The oracle
 *      does it as two djnz runs (192 + 192, `ld b,0xC0`) over an un-reloaded HL;
 *      one contiguous span here.
 *
 * Invoked from the game-state / phase-transition path — loc_0986 (which follows it
 * by setting the flip-screen latch 0x7D82) and loc_196b (the index-23 sub-state
 * phase arm) — to wipe the display before the next scene is composed.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0852.test.js.
 * GATE:     crafted-entry; sub_0852 is UNREACHED in attract (0 dispatches over
 *           3000 frames — its two callers are in-game phase arms), so it is gated
 *           by crafted entries with both target regions (+ guard bands) pre-poked
 *           to a sentinel on BOTH sides, which pins the EXACT write footprint
 *           against the oracle. The routine reads nothing, so one such pair proves
 *           equivalence for every start state; several sentinels are swept. Teeth =
 *           a one-cell-short tilemap fill.
 * LIVE-OUT: memory-only — the tilemap + sprite-buffer bytes. No live registers or
 *           flags: both callers reload A/DE (loc_0986 `ld de,0x7d82 / ld a,0x01`;
 *           loc_196b `ld a,(0x600e)`) before reading anything, so the oracle's
 *           terminal A=0/B=0/C=0/HL=0x6A80/F are dead ABI (the whole-machine gate
 *           backstops that). SP/PC are not compared — the idiomatic layer drops the
 *           `ret`'s stack/PC bookkeeping (the JS call stack replaces it).
 * NAMES:    SPRITE_BUFFER (0x6900). The tilemap base (0x7400 video RAM) stays hex —
 *           it is not named in names.js.
 */

import { SPRITE_BUFFER } from "./names.js";

const TILEMAP_BASE = 0x7400; // video-RAM tilemap: first cell
const TILEMAP_BYTES = 0x400; // 1024 = every cell of the 32x32 tilemap
const BLANK_TILE = 0x10;

const SPRITE_BUFFER_BYTES = 0x180; // 384 = 96 sprite records x 4

export function clearTilemapAndSprites(m) {
  const { mem } = m;

  // 1. Tilemap: blank every cell of video RAM (0x7400-0x77FF) to the blank tile.
  for (let i = 0; i < TILEMAP_BYTES; i++) {
    mem.write8((TILEMAP_BASE + i) & 0xffff, BLANK_TILE);
  }

  // 2. Sprite buffer: zero the 384-byte shadow buffer (DMA source for 0x7000).
  for (let i = 0; i < SPRITE_BUFFER_BYTES; i++) {
    mem.write8((SPRITE_BUFFER + i) & 0xffff, 0x00);
  }
}

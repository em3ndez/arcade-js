// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_ANIM_CURSOR, TILE_ANIM_PARITY } from "./names.js";
/**
 * advanceTileAnimForwardOnOdd — the odd-frame half of the on-screen tile-strip animation:
 * one frame in two, nudge the animated tile forward, marching a cursor across video RAM.
 *
 * ROM 0x2405-0x241d. [seen].
 *
 * The machine animates a short strip of tilemap by cycling the tile CODE stored in one video-RAM
 * cell up through a fixed range, and when that cell has cycled to the top, moving on to the next
 * cell. Two routines share the work on alternating frames: this one runs the strip FORWARD on odd
 * frames; its mirror runs it BACK on even frames. Which of the two acts is decided by bit 0 of a
 * single per-frame parity tick (TILE_ANIM_PARITY, 0x8f37) that both routines bump — so exactly one
 * of the pair takes effect each frame and the animation steps one cell per two frames.
 *
 * The cursor (TILE_ANIM_CURSOR, 0x88be) is a full 16-bit pointer whose high byte sits in the
 * 0x84xx video-RAM page (the tilemap) and whose low byte oscillates as the strip marches. The tile
 * codes it walks through cycle 0x10 / 0x34 / 0x37; the top of that cycle, 0x37, is the trigger to
 * advance to the next cell, and 0x34 is the code stamped into a cell as the strip enters it.
 *
 * A leaf: it writes only the parity tick, the cursor, and one tilemap cell, and calls nothing.
 *
 * LIVE-OUT: memory only — TILE_ANIM_PARITY (bumped), TILE_ANIM_CURSOR (advanced when it acts), and
 * one 0x84xx tilemap cell (its tile code raised, or a fresh cell seeded). Returns nothing.
 */

const TILE_ANIM_WRAP = 0x37;  // top of the tile-code cycle: at/above this the cursor steps forward and reseeds
const TILE_ANIM_SEED = 0x34;  // tile code stamped into the freshly-entered cell

export function advanceTileAnimForwardOnOdd(m) {
  const { mem8, mem16 } = m;

  // Bump the shared per-frame parity tick and let only the odd-frame half proceed: when bit 0 is
  // clear this is an even frame and the forward pass does nothing (the backward mirror handles it).
  mem8[TILE_ANIM_PARITY] = mem8[TILE_ANIM_PARITY] + 1;
  if ((mem8[TILE_ANIM_PARITY] & 1) === 0) return; // even frame: nothing to do here

  // Read the tile code the cursor currently points at in the 0x84xx tilemap. If it has reached the
  // top of the cycle (0x37), this cell is finished animating: step the cursor to the next tilemap
  // cell and seed it with 0x34 so the strip continues there. Otherwise just raise this cell's tile
  // code by one, advancing its animation frame in place.
  let cursor = mem16[TILE_ANIM_CURSOR];
  if (mem8[cursor] >= TILE_ANIM_WRAP) {
    cursor = u16(cursor + 1);
    mem8[cursor] = TILE_ANIM_SEED;
  } else {
    mem8[cursor] = mem8[cursor] + 1;
  }

  // Store the (possibly advanced) cursor back so the next odd frame resumes where this one left off.
  mem16[TILE_ANIM_CURSOR] = cursor;
}

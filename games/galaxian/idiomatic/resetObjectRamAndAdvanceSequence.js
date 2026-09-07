// SPDX-License-Identifier: GPL-3.0-only
import { seedObjectRamShadowField } from "./seedObjectRamShadowField.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import {
  SPRITE_SHADOW_BASE,
  loc_4260,
  OBJECT_DRAW_SUPPRESS,
  MESSAGE_SCROLL_ENABLE,
  VRAM_WRITE_PTR,
  VRAM_BASE,
  loc_4009,
  SEQUENCE_STATE,
  loc_1d91,
} from "./names.js";

/**
 * resetObjectRamAndAdvanceSequence (ROM 0x0408) -- sequence sub-state 0 of the press-start screen,
 * the pass that wipes the object field clean before the start screen builds its display.
 *
 * WHAT IT IS
 *   runStartScreenAndLaunchGame (the GAME_STATE = 2, credit-inserted "press start" handler) dispatches on
 *   SEQUENCE_STATE across four short sub-states; this is index 0. It re-seeds the interleaved OBJRAM code
 *   lane from a ROM template, zeroes the sprite shadow and the whole object-record region, clears two
 *   status flags, rewinds the VRAM write cursor two cells into the grid, arms the dwell timer, and bumps
 *   the sequence selector so the next frame runs the following sub-state. See mechanisms.md "Press-start
 *   and launching a round" and "Seeding the object shadow from ROM".
 *
 * ROLE IN THE MACHINE
 *   Runs once (it self-advances SEQUENCE_STATE at the end). Seeds the odd/code lane of the object-RAM
 *   shadow from ROM template loc_1d91 via seedObjectRamShadowField. Uses fillMemoryBlock to zero
 *   SPRITE_SHADOW_BASE (0x4060, the 64-byte sprite-shadow span) and the object-record region at loc_4260
 *   (0x4260) -- a full 256-byte page plus an 80-byte tail. Clears OBJECT_DRAW_SUPPRESS (0x4238) and
 *   MESSAGE_SCROLL_ENABLE (0x40b0), points VRAM_WRITE_PTR (0x400b) at VRAM_BASE+2, arms dwell tier
 *   loc_4009 (0x4009) to 16, and increments SEQUENCE_STATE (0x400a).
 *
 * Grounding: [seen] (names.js cert for 0x0408).
 *
 * LIVE-OUT: object shadow reseeded; sprite shadow + object records zeroed; two flags cleared; VRAM cursor
 *   and dwell timer reset; SEQUENCE_STATE advanced by one.
 */
const FULL_PAGE = 256; // zeroes this span with an already-drained count register (0 -> 256 bytes)
const DWELL_TIMER_START = 16;

export function resetObjectRamAndAdvanceSequence(m) {
  const { mem8, mem16 } = m;

  // Re-seed the odd (sprite-code) lane of the interleaved object-RAM shadow from ROM template loc_1d91 --
  // the start-screen variant of the reseed -- so the codes are restored before the record region is wiped.
  seedObjectRamShadowField(m, loc_1d91);

  // Zero the 64-byte sprite-shadow span, then a full page from the object-record base and its 80-byte tail.
  // fillMemoryBlock stores the byte across a run of cells; FULL_PAGE (256) rides the Z80 "count 0 -> 256"
  // wrap, so 0x4260..0x435f then 0x4360..0x43af are all cleared, retiring every object record.
  fillMemoryBlock(m, SPRITE_SHADOW_BASE, 0, 64);
  fillMemoryBlock(m, loc_4260, 0, FULL_PAGE);
  fillMemoryBlock(m, loc_4260 + FULL_PAGE, 0, 80);

  // Clear the object-figure draw suppress and stop the message scroller so the start screen paints cleanly.
  mem8[OBJECT_DRAW_SUPPRESS] = 0;
  mem8[MESSAGE_SCROLL_ENABLE] = 0;

  // Point the VRAM fill cursor two cells into the character map (VRAM_BASE + 2) where the next sub-state
  // starts drawing, arm the dwell tier (16) that paces the sub-states, and advance the sequence selector.
  mem16[VRAM_WRITE_PTR] = VRAM_BASE + 2;
  mem8[loc_4009] = DWELL_TIMER_START;
  mem8[SEQUENCE_STATE]++; // bump the selector to the next state
}

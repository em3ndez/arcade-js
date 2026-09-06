// SPDX-License-Identifier: GPL-3.0-only
// Sequence state-table entry (selector 0): seed the interleaved OBJRAM shadow field from a template,
// zero the sprite-shadow span and a broad object-record region, clear two status cells, point the VRAM
// cursor two cells into the grid, arm the dwell tier, and bump the sequence-state selector.
import { seedObjectRamShadowField } from "./seedObjectRamShadowField.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import {
  SPRITE_SHADOW_BASE,
  loc_4260,
  loc_4238,
  MESSAGE_SCROLL_ENABLE,
  VRAM_WRITE_PTR,
  VRAM_BASE,
  loc_4009,
  SEQUENCE_STATE,
  loc_1d91,
} from "./names.js";

const FULL_PAGE = 256; // zeroes this span with an already-drained count register (0 -> 256 bytes)
const DWELL_TIMER_START = 16;

export function resetObjectRamAndAdvanceSequence(m) {
  const { mem8, mem16 } = m;

  seedObjectRamShadowField(m, loc_1d91);

  // Zero the 64-byte sprite-shadow span, then a full page from the object-record base and its 80-byte tail.
  fillMemoryBlock(m, SPRITE_SHADOW_BASE, 0, 64);
  fillMemoryBlock(m, loc_4260, 0, FULL_PAGE);
  fillMemoryBlock(m, loc_4260 + FULL_PAGE, 0, 80);

  mem8[loc_4238] = 0;
  mem8[MESSAGE_SCROLL_ENABLE] = 0;

  mem16[VRAM_WRITE_PTR] = VRAM_BASE + 2;
  mem8[loc_4009] = DWELL_TIMER_START;
  mem8[SEQUENCE_STATE]++; // bump the selector to the next state
}

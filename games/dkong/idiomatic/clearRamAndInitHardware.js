// SPDX-License-Identifier: GPL-3.0-only
/**
 * Power-on setup: wipe all RAM, seed an empty task queue, set the display
 * hardware bits, silence the sound, and hand the game its stack. Runs cold
 * with vblank masked, reads no work RAM, and writes only constants.
 *
 * LIVE-OUT: memory, the display/sound hardware latches, and the stack pointer.
 */

import { silenceSound } from "./silenceSound.js";
import { TASK_TAIL, TASK_HEAD, TASK_RING, WORK_RAM_BASE } from "./names.js";

const WORK_PAGE_HI = 0x7000; // full 4 KB page; top ~1 KB over-runs into unmapped discard

const SPRITE_RAM_LO = 0x7000;
const SPRITE_RAM_HI = 0x7400;

const VIDEO_RAM_LO = 0x7400;
const VIDEO_RAM_HI = 0x7800;
const BLANK_TILE = 0x10; // blank glyph, not zero

const TASK_RING_SLOTS = 0x40;
const SLOT_FREE = 0xff;
const QUEUE_EMPTY = 0xc0;

const HW_FLIPSCREEN = 0x7d82;
const HW_SPRITE_BANK = 0x7d83;
const HW_NMI_MASK = 0x7d84;
const HW_PALETTE_BANK0 = 0x7d86;
const HW_PALETTE_BANK1 = 0x7d87;

export function clearRamAndInitHardware(m) {
  const { regs, mem, mem8 } = m;

  for (let a = WORK_RAM_BASE; a < WORK_PAGE_HI; a++) mem8[a] = 0;

  for (let a = SPRITE_RAM_LO; a < SPRITE_RAM_HI; a++) mem8[a] = 0;

  for (let a = VIDEO_RAM_LO; a < VIDEO_RAM_HI; a++) mem8[a] = BLANK_TILE;

  for (let i = 0; i < TASK_RING_SLOTS; i++) mem8[TASK_RING + i] = SLOT_FREE;
  mem8[TASK_TAIL] = QUEUE_EMPTY;
  mem8[TASK_HEAD] = QUEUE_EMPTY;

  mem.write8(HW_SPRITE_BANK, 0);
  mem.write8(HW_PALETTE_BANK0, 0);
  mem.write8(HW_PALETTE_BANK1, 0);
  mem.write8(HW_FLIPSCREEN, 1);

  regs.sp = 0x6c00;

  silenceSound(m);

  mem.write8(HW_NMI_MASK, 1);
}

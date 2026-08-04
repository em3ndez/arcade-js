// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearRamAndInitHardware — power-on setup: wipe all RAM, seed the task queue, set the display
 * hardware bits, silence the sound, and hand the game its stack.
 *
 * It runs from cold with the vblank interrupt still masked, reads no work RAM at all, and every
 * store it makes writes a constant — so what it leaves behind cannot depend on what was there
 * before. In order it:
 *   - Zeroes the whole 4 KB work-RAM page. Real work RAM stops short of the end of that page, so
 *     the last kilobyte of the wipe lands on nothing and is discarded. The over-run is reproduced
 *     faithfully rather than trimmed.
 *   - Clears sprite RAM to zero.
 *   - Fills the tile/name video RAM with the BLANK TILE — not zero, which is a real glyph.
 *   - Marks every task-ring slot free and parks both task-queue pointers at the ring base, i.e.
 *     an empty queue.
 *   - Clears the sprite bank and both palette banks, and turns flip-screen on.
 *   - Points the stack just past the top of work RAM, so the first push lands on its last byte,
 *     then silences the sound.
 *   - Re-enables the vblank interrupt mask. From here the interrupt can fire.
 *
 * LIVE-OUT: memory and the display/sound hardware latches, plus the stack pointer — the stack the
 * game inherits from here on.
 */

import { silenceSound } from "./silenceSound.js";
import { TASK_TAIL, TASK_HEAD, TASK_RING } from "./names.js";

// The clear runs the full 4 KB page; real work RAM ends before the page does, so the last
// kilobyte spills into the unmapped discard window (those writes are counted, not stored).
const WORK_PAGE_LO = 0x6000;
const WORK_PAGE_HI = 0x7000; // exclusive end (4096 bytes)

const SPRITE_RAM_LO = 0x7000;
const SPRITE_RAM_HI = 0x7400; // exclusive end (1024 bytes)

const VIDEO_RAM_LO = 0x7400;
const VIDEO_RAM_HI = 0x7800; // exclusive end (1024 bytes)
const BLANK_TILE = 0x10; //     video-RAM fill value (a blank tile, not zero)

const TASK_RING_SLOTS = 0x40; // 64 bytes = 32 slots x 2 bytes
const SLOT_FREE = 0xff; //       task-ring slot marked free
const QUEUE_EMPTY = 0xc0; //     both queue pointers parked at the ring base offset

// Display-hardware control latches — board outputs, not work RAM.
const HW_FLIPSCREEN = 0x7d82;
const HW_SPRITE_BANK = 0x7d83;
const HW_NMI_MASK = 0x7d84;
const HW_PALETTE_BANK0 = 0x7d86;
const HW_PALETTE_BANK1 = 0x7d87;

export function clearRamAndInitHardware(m) {
  const { regs, mem } = m;

  // Wipe the whole work-RAM page (the top 1 KB over-runs into the discard window).
  for (let a = WORK_PAGE_LO; a < WORK_PAGE_HI; a++) mem.write8(a, 0);

  // Clear sprite RAM.
  for (let a = SPRITE_RAM_LO; a < SPRITE_RAM_HI; a++) mem.write8(a, 0);

  // Fill video RAM with the blank tile (not zero).
  for (let a = VIDEO_RAM_LO; a < VIDEO_RAM_HI; a++) mem.write8(a, BLANK_TILE);

  // Mark every task-ring slot free, then park both queue pointers at the empty base.
  for (let i = 0; i < TASK_RING_SLOTS; i++) mem.write8(TASK_RING + i, SLOT_FREE);
  mem.write8(TASK_TAIL, QUEUE_EMPTY);
  mem.write8(TASK_HEAD, QUEUE_EMPTY);

  // Display bits: sprite bank and both palette banks off, flip-screen on.
  mem.write8(HW_SPRITE_BANK, 0);
  mem.write8(HW_PALETTE_BANK0, 0);
  mem.write8(HW_PALETTE_BANK1, 0);
  mem.write8(HW_FLIPSCREEN, 1);

  // Hand the game its stack: the first push lands on the last byte of work RAM.
  regs.sp = 0x6c00;

  // Silence the sound hardware and its work-RAM shadow.
  silenceSound(m);

  // Re-enable the vblank interrupt; from here it can fire.
  mem.write8(HW_NMI_MASK, 1);
}

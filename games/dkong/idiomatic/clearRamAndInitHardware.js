// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearRamAndInitHardware — power-on setup: wipe all RAM, seed the task queue, set the display
 * hardware bits, silence the sound, and hand the game its stack.  ROM 0x0266.
 *
 * The reset vector falls straight into here with the vblank NMI still masked, and
 * this routine falls through into the main loop at 0x02bd when it finishes. In order
 * it:
 *   - Zeroes the whole 4 KB work-RAM page 0x6000-0x6FFF. Real work RAM is only
 *     0x6000-0x6BFF; the top 1 KB is unmapped, so those writes are discarded (and
 *     counted). The over-run is reproduced faithfully.
 *   - Clears sprite RAM 0x7000-0x73FF to zero.
 *   - Fills the tile/name video RAM 0x7400-0x77FF with blank tile 0x10 — NOT zero.
 *   - Marks all 32 task-ring slots free (0x60C0-0x60FF = 0xFF) and parks both
 *     task-queue pointers at the ring base offset 0xC0 (empty queue).
 *   - Clears the sprite bank and both palette banks, and turns flip-screen on.
 *   - Points the stack at 0x6C00 (the first push lands at 0x6BFF, the top of work
 *     RAM), then silences the sound.
 *   - Re-enables the vblank NMI mask; from here the NMI can fire.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0266.test.js.
 * GATE:     crafted-entry — input-independent (reads no work RAM; every store writes a
 *           constant), so there are no data-dependent arms to sweep. Validated against
 *           the oracle on a power-on machine, a real mid-attract machine, and a
 *           pre-dirtied RAM/io machine that proves every span is overwritten regardless
 *           of prior contents; reachability shown through the real boot path (bootOnly).
 *           The RAM diff excludes the dead STACK_SCRATCH [0x6be0,0x6c00) that the
 *           oracle's dissolved push16/call bracket writes; io device state and the
 *           discard counter are compared too. Teeth: a blank-tile twin, a flip-screen
 *           twin, and a missing-silence twin.
 * LIVE-OUT: SP (= 0x6C00) — the stack the main loop inherits. Every other register the
 *           oracle leaves is dead (the main loop reloads before use); memory otherwise.
 * NAMES:    TASK_TAIL, TASK_HEAD, TASK_RING (names.js); silenceSound = ROM 0x011c. The
 *           bulk RAM spans (work/sprite/video) and the display-hardware control latches
 *           (0x7D82-0x7D87) have no names.js cell, so they stay local hex constants.
 */

import { silenceSound } from "./silenceSound.js"; // ROM 0x011c
import { TASK_TAIL, TASK_HEAD, TASK_RING } from "./names.js";

// Work RAM is 0x6000-0x6BFF; the clear runs the full 4 KB page 0x6000-0x6FFF, so the
// top 1 KB spills into the unmapped discard window (those writes are counted, not stored).
const WORK_PAGE_LO = 0x6000;
const WORK_PAGE_HI = 0x7000; // exclusive end (0x6000 + 4096)

const SPRITE_RAM_LO = 0x7000;
const SPRITE_RAM_HI = 0x7400; // exclusive end (1024 bytes)

const VIDEO_RAM_LO = 0x7400;
const VIDEO_RAM_HI = 0x7800; // exclusive end (1024 bytes)
const BLANK_TILE = 0x10; //     video-RAM fill value (a blank tile, not zero)

const TASK_RING_SLOTS = 0x40; // 64 bytes = 32 slots x 2 bytes
const SLOT_FREE = 0xff; //       task-ring slot marked free
const QUEUE_EMPTY = 0xc0; //     TASK_TAIL/TASK_HEAD parked at the ring base offset

// Display-hardware control latches (board outputs, not work RAM — no names.js cell).
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

  // Hand the game its stack (the first push lands at 0x6BFF, the top of work RAM).
  regs.sp = 0x6c00;

  // Silence the sound hardware and its work-RAM shadow.
  silenceSound(m);

  // Re-enable the vblank NMI; from here the NMI can fire.
  mem.write8(HW_NMI_MASK, 1);
}

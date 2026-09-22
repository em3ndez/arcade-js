// SPDX-License-Identifier: GPL-3.0-only
/**
 * Power-on setup: wipe all RAM, seed an empty task queue, set the display
 * hardware bits, silence the sound, and hand the game its stack. Runs cold
 * with vblank masked, reads no work RAM, and writes only constants.
 *
 * LIVE-OUT: memory, the display/sound hardware latches, and the stack pointer.
 */

import { silenceSound } from "./silenceSound.js";
import {
  TASK_TAIL,
  TASK_HEAD,
  TASK_RING,
  WORK_RAM_BASE,
  FLIPSCREEN,
  SPRITE_BANK,
  NMI_ENABLE,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  STACK_TOP,
  SPRITE_RAM_BASE,
  TILEMAP_BASE,
  DMA_CH0_ADDR,
} from "./names.js";

const SPRITE_RAM_LO = SPRITE_RAM_BASE;

const BLANK_TILE = 0x10; // blank glyph, not zero

const TASK_RING_SLOTS = 0x40;
const SLOT_FREE = 0xff;
const QUEUE_EMPTY = 0xc0;

export function clearRamAndInitHardware(m) {
  const { mem8 } = m;

  for (let a = WORK_RAM_BASE; a < SPRITE_RAM_BASE; a++) mem8[a] = 0;

  for (let a = SPRITE_RAM_LO; a < TILEMAP_BASE; a++) mem8[a] = 0;

  // Tilemap runs up to where the DMA registers begin.
  for (let a = TILEMAP_BASE; a < DMA_CH0_ADDR; a++) mem8[a] = BLANK_TILE;

  for (let i = 0; i < TASK_RING_SLOTS; i++) mem8[TASK_RING + i] = SLOT_FREE;
  mem8[TASK_TAIL] = QUEUE_EMPTY;
  mem8[TASK_HEAD] = QUEUE_EMPTY;

  mem8[SPRITE_BANK] = 0;
  mem8[PALETTE_BANK_BIT0] = 0;
  mem8[PALETTE_BANK_BIT1] = 0;
  mem8[FLIPSCREEN] = 1;

  return (m.regs.sp = STACK_TOP, silenceSound(m), (mem8[NMI_ENABLE] = 1));
}

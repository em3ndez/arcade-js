// SPDX-License-Identifier: GPL-3.0-only
// Attract/reset init: decode three 2-bit input fields (IN1 bits 6-7, IN2 bits 0-1, IN2 bit 2) into text
// descriptor indices and paint each column. Then, unless IN0 bit 6 is asserted, seed the screen-fill
// state (VRAM cursor, dwell tiers, mode flags), clear the lamp/coin latch block, and silence the sound
// hardware.
import {
  IN0, IN1, IN2_PORT, START_LAMP_0, VRAM_WRITE_PTR, VRAM_BASE,
  loc_4006, loc_401a, loc_4008, loc_4009,
} from "./names.js";
import { drawTextColumnByIndex } from "./drawTextColumnByIndex.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { silenceSoundAndDisableIrqStars } from "./silenceSoundAndDisableIrqStars.js";

const LATCH_BLOCK_BYTES = 4; // start_lamp 0/1, coin_lock, coin_count_0

export function drawInputTextColumnsAndSeedScreenFill(m) {
  const { mem8 } = m;

  drawTextColumnByIndex(m, (mem8[IN1] >> 6) & 0x03);
  drawTextColumnByIndex(m, (mem8[IN2_PORT] & 0x03) + 4);
  drawTextColumnByIndex(m, ((mem8[IN2_PORT] >> 2) & 0x01) + 8);

  if (mem8[IN0] & 0x40) return; // input gate: bit 6 asserted skips the state init

  mem8[loc_4006] = 0;
  mem8[loc_401a] = 2;
  mem8[loc_4008] = 16; // low byte of the 16-bit dwell-pair seed
  mem8[loc_4009] = 48; // high byte of the same seed
  m.mem16[VRAM_WRITE_PTR] = VRAM_BASE;

  fillMemoryBlock(m, START_LAMP_0, 0, LATCH_BLOCK_BYTES);
  return silenceSoundAndDisableIrqStars(m);
}

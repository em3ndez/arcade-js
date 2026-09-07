// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawInputTextColumnsAndSeedScreenFill — attract/reset init: draw the dip-switch readout, then arm the
 * animated screen fill.
 *
 * WHAT IT IS
 *   During attract the machine shows the current dip-switch settings as three text columns and animates a
 *   tile fill sweeping across the screen. This routine does the readout-and-arm half: it decodes three
 *   two-bit config fields straight out of the input ports into text-descriptor indices, paints a column
 *   for each, and — unless an input gate says otherwise — seeds the state the per-frame fill effect then
 *   drives.
 *
 * ROLE IN THE MACHINE
 *   The three text columns come from three 2-bit fields: IN1 (0x6800) bits 6-7, IN2_PORT (0x7000) bits
 *   0-1, and IN2_PORT bit 2. Each is biased by a fixed offset (+0, +4, +8) so the three land on different
 *   rows of the text-descriptor table, and drawTextColumnByIndex (0x1ccf) paints each. The input gate is
 *   IN0 (0x6000) bit 6: when asserted the routine returns before touching any state, leaving the fill
 *   un-armed. Otherwise it seeds the screen-fill state — clear the mode flag loc_4006, set dispatch flag
 *   loc_401a=2, seed the two-tier dwell pair loc_4008/loc_4009 to 0x3010 (16 low, 48 high), rewind the
 *   VRAM write cursor VRAM_WRITE_PTR (0x400b) to VRAM_BASE (0x5000) — then clears the four-byte
 *   start-lamp/coin latch block (the LS259 latches at 0x6000, the write side of the same address IN0 is
 *   read from) via fillMemoryBlock, and silences the audio + halts the vblank IRQ/starfield through
 *   silenceSoundAndDisableIrqStars (0x1cb5). Reached from armInputFlagAndDrawInputColumns (0x1c68).
 *
 * ROM 0x1c73.  Grounding: [seen].
 *
 * LIVE-OUT: three text columns painted; on the un-gated path the screen-fill state seeded and the audio
 *           hardware quiesced (returns silenceSoundAndDisableIrqStars's result).
 */
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

  // Column 1: IN1 bits 6-7 -> descriptor rows 0..3.
  drawTextColumnByIndex(m, (mem8[IN1] >> 6) & 0x03);
  // Column 2: IN2 bits 0-1, biased +4 -> descriptor rows 4..7.
  drawTextColumnByIndex(m, (mem8[IN2_PORT] & 0x03) + 4);
  // Column 3: IN2 bit 2, biased +8 -> descriptor rows 8..9.
  drawTextColumnByIndex(m, ((mem8[IN2_PORT] >> 2) & 0x01) + 8);

  if (mem8[IN0] & 0x40) return; // input gate: bit 6 asserted skips the state init

  // Seed the screen-fill state so the per-frame fill effect can start sweeping.
  // Mode flag: normal (not the alternate service path).
  mem8[loc_4006] = 0;
  // Dispatch flag selecting the screen-fill sub-handler.
  mem8[loc_401a] = 2;
  mem8[loc_4008] = 16; // low byte of the 16-bit dwell-pair seed
  mem8[loc_4009] = 48; // high byte of the same seed
  // Rewind the fill write cursor to the top of the character map.
  m.mem16[VRAM_WRITE_PTR] = VRAM_BASE;

  // Clear the 4-byte lamp/coin latch block (LS259 outputs at 0x6000, the write side of IN0's address).
  fillMemoryBlock(m, START_LAMP_0, 0, LATCH_BLOCK_BYTES);
  // Quiesce the sound hardware and halt the vblank IRQ + starfield.
  return silenceSoundAndDisableIrqStars(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * wipeVideoAndHardwareLatches -- the cold-boot hardware wipe, then on into the RAM tests.
 *
 * WHAT IT IS
 *   Puts every piece of video and I/O hardware into a known quiet state: the tilemap goes blank, object RAM
 *   (column scroll/colour, sprites, bullets) goes to zero, the start lamps / coin lockout / coin counter
 *   latches drop, the four sound LFO-frequency latches park at 1, the eight sound registers go to zero, the
 *   eight control-latch slots from the interrupt enable up (interrupt, starfield, both screen flips) go to
 *   zero, and the sound pitch latch is driven fully high.
 *
 * ROLE IN THE MACHINE
 *   Reached from the reset vector with the interrupt already masked. It then runs the work-RAM march test
 *   for 32 seeds, which in turn runs the video-RAM test and the ROM checksum and hands off to the main loop.
 *
 * ROM 0x1a55 (through 0x1a99).  Grounding: [seen]. Cells: VRAM (via blankVideoRam), OBJRAM_HW_BASE (0x5800),
 * START_LAMP_0 (0x6000), SOUND_LFO_FREQ (0x6004), SOUND_W_REG0 (0x6800), IRQ_ENABLE (0x7001),
 * SOUND_PITCH_W (0x7800).
 *
 * LIVE-OUT: memory and the hardware latches, as left by the boot chain; returns the main-loop generator.
 */
import { OBJRAM_HW_BASE, START_LAMP_0, SOUND_LFO_FREQ, SOUND_W_REG0, IRQ_ENABLE, SOUND_PITCH_W } from "./names.js";
import { blankVideoRam } from "./blankVideoRam.js";
import { marchTestWorkRam } from "./marchTestWorkRam.js";

const OBJRAM_SIZE = 0x100;
const OUTPUT_LATCHES = 4; // start lamp 0/1, coin lockout, coin counter 0
const LFO_LATCHES = 4;
const SOUND_REGS = 8;
const CONTROL_SLOTS = 8; // interrupt enable up through the flip latches and one past; the gaps are unmapped
const RAM_TEST_SEEDS = 32;

export function wipeVideoAndHardwareLatches(m) {
  const { mem8 } = m;

  blankVideoRam(m);
  for (let i = 0; i < OBJRAM_SIZE; i++) mem8[OBJRAM_HW_BASE + i] = 0;

  for (let i = 0; i < OUTPUT_LATCHES; i++) mem8[START_LAMP_0 + i] = 0;
  for (let i = 0; i < LFO_LATCHES; i++) mem8[SOUND_LFO_FREQ + i] = 1; // parked at rest, not the zero special case
  for (let i = 0; i < SOUND_REGS; i++) mem8[SOUND_W_REG0 + i] = 0;
  for (let i = 0; i < CONTROL_SLOTS; i++) mem8[IRQ_ENABLE + i] = 0;
  mem8[SOUND_PITCH_W] = 255;

  return marchTestWorkRam(m, RAM_TEST_SEEDS);
}

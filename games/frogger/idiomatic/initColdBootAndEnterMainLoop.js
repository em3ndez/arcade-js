// SPDX-License-Identifier: GPL-3.0-only
/**
 * initColdBootAndEnterMainLoop — the cold-boot init reached from the reset vector. Disables the NMI and
 * the flip latches, clears work RAM and the OBJRAM page, seeds the starting time / cabinet / coinage from
 * the DSW reads, copies two boot-state blocks, re-enables the NMI, programs both i8255 PPIs, pulses the
 * sound port (mute/unmute), and tail-hands to the main loop as the driver generator. LIVE-OUT: memory.
 */
import {
  IN1_PORT, IN2_PORT, FLIP_X_LATCH, FLIP_Y_LATCH, NUM_PLAYERS,
  COCKTAIL_ENABLED_FLAG, COINAGE_WORD, SOUND_CTRL_SHADOW, SOUND_CTRL_PORT,
  OBJRAM_BASE, OBJRAM_CTRL_LO, OBJRAM_CTRL_HI, NMI_ENABLE, PPI1_CTRL, PPI0_CTRL,
  SPIN_DELAY_WORD, SPIN_DELAY_INIT, FANFARE_INDEX, WORK_RAM_TOP, loc_8000,
  SHARED_TIME_BYTE, STARTING_TIME_DSW_TABLE, PLAYER2_SCORE, SCORE_STATE_INIT_SRC,
  SPAWN_RNG_RING_BASE, SPAWN_RING_INIT_SRC,
} from "./names.js";
import { drainForegroundThenYieldEachVblank } from "./drainForegroundThenYieldEachVblank.js";
import { spinWatchdogSettleDelay } from "./spinWatchdogSettleDelay.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { issueSoundCommand } from "./issueSoundCommand.js";

const SCORE_STATE_LEN = 0x12;
const SPAWN_RING_LEN = 0x20;

export function initColdBootAndEnterMainLoop(m) {
  const { mem8 } = m;

  mem8[NMI_ENABLE] = 0;
  mem8[FLIP_X_LATCH] = 0;
  mem8[FLIP_Y_LATCH] = 0;

  for (let a = loc_8000; a <= WORK_RAM_TOP; a++) mem8[a] = 0;
  for (let i = 0; i < 0x100; i++) mem8[OBJRAM_BASE + i] = 0;

  // starting time from the DSW difficulty table (IN1 bits 0-1)
  mem8[SHARED_TIME_BYTE] = mem8[STARTING_TIME_DSW_TABLE + (mem8[IN1_PORT] & 0x03)];

  const in2 = mem8[IN2_PORT];
  if (in2 & 0x08) mem8[COCKTAIL_ENABLED_FLAG] = 1; // cocktail cabinet
  mem8[COINAGE_WORD] = in2 & 0x06;

  // seed the 18-byte score/high-score/state block with ROM defaults
  for (let i = 0; i < SCORE_STATE_LEN; i++) mem8[PLAYER2_SCORE + i] = mem8[SCORE_STATE_INIT_SRC + i];

  spinWatchdogSettleDelay(m); // power-on settle

  mem8[NUM_PLAYERS] = 1;
  mem8[NMI_ENABLE] = 1; // NMI on from here

  clearTilemapToTile16(m); // clear the screen

  mem8[OBJRAM_CTRL_LO] = 0;
  mem8[OBJRAM_CTRL_HI] = 6;
  m.mem16[SPIN_DELAY_WORD] = SPIN_DELAY_INIT;
  mem8[FANFARE_INDEX] = 0x15;

  // seed the 32-byte spawn-RNG ring page with ROM defaults
  for (let i = 0; i < SPAWN_RING_LEN; i++) mem8[SPAWN_RNG_RING_BASE + i] = mem8[SPAWN_RING_INIT_SRC + i];

  mem8[PPI0_CTRL] = 0x9b; // mode0, all inputs
  mem8[PPI1_CTRL] = 0x88; // A/B outputs (sound)

  mem8[SOUND_CTRL_SHADOW] = 0x18;
  mem8[SOUND_CTRL_PORT] = 0x18;

  issueSoundCommand(m, 0x00); // mute-pulse command 0

  const unmuted = mem8[SOUND_CTRL_SHADOW] & 0xef; // clear the mute bit
  mem8[SOUND_CTRL_SHADOW] = unmuted;
  mem8[SOUND_CTRL_PORT] = unmuted;

  issueSoundCommand(m, 0xff); // unmute-pulse command 0xff

  return drainForegroundThenYieldEachVblank(m); // hand back the main-loop generator
}

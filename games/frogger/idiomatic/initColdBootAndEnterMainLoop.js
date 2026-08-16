// SPDX-License-Identifier: GPL-3.0-only
/**
 * initColdBootAndEnterMainLoop — the cold-boot init reached from the reset vector. Disables the NMI and
 * the flip latches, clears work RAM and the OBJRAM page, seeds the lives count / cabinet / coinage from
 * the DSW input reads, copies two boot-state blocks out of program memory, settles, re-enables the NMI,
 * programs both i8255 PPIs, primes the sound port with a mute-then-unmute pulse, and tail-hands to the
 * main loop. Runs once at power-on; the tail returns the driver generator. LIVE-OUT: memory.
 */
import { IN1_PORT, IN2_PORT, MAIN_LOOP_HEAD } from "./names.js";
import { spinWatchdogSettleDelay } from "./spinWatchdogSettleDelay.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { issueSoundCommand } from "./issueSoundCommand.js";

const IRQ_ENABLE = 0xb808;
const FLIP_X = 0xb810, FLIP_Y = 0xb80c;
const WORK_RAM_LO = 0x8000, WORK_RAM_HI = 0x87ff;
const OBJRAM_BASE = 0xb000;
const LIVES_TABLE = 0x2e00, LIVES_COUNT = 0x83e4;
const CABINET_FLAG = 0x83c2, COINAGE_WORD = 0x83d4;
const BOOT_STATE_SRC = 0x2e0a, BOOT_STATE_DEST = 0x83eb, BOOT_STATE_LEN = 0x12;
const NUM_PLAYERS = 0x8370;
const OBJRAM_CTRL_LO = 0xb001, OBJRAM_CTRL_HI = 0xb003;
const SPIN_DELAY_WORD = 0x83c7, CELL_8381 = 0x8381;
const PAGE84_SRC = 0x2eb1, PAGE84_DEST = 0x8400, PAGE84_LEN = 0x20;
const PPI0_CTRL = 0xe006, PPI1_CTRL = 0xd006;
const SOUND_CTRL_SHADOW = 0x83d9, SOUND_CTRL_PORT = 0xd002;

export function initColdBootAndEnterMainLoop(m) {
  const { mem8 } = m;

  mem8[IRQ_ENABLE] = 0;
  mem8[FLIP_X] = 0;
  mem8[FLIP_Y] = 0;

  for (let a = WORK_RAM_LO; a <= WORK_RAM_HI; a++) mem8[a] = 0;
  for (let i = 0; i < 0x100; i++) mem8[OBJRAM_BASE + i] = 0;

  mem8[LIVES_COUNT] = mem8[LIVES_TABLE + (mem8[IN1_PORT] & 0x03)];

  const in2 = mem8[IN2_PORT];
  if (in2 & 0x08) mem8[CABINET_FLAG] = 1; // cocktail cabinet
  mem8[COINAGE_WORD] = in2 & 0x06;

  for (let i = 0; i < BOOT_STATE_LEN; i++) mem8[BOOT_STATE_DEST + i] = mem8[BOOT_STATE_SRC + i];

  spinWatchdogSettleDelay(m); // power-on settle

  mem8[NUM_PLAYERS] = 1;
  mem8[IRQ_ENABLE] = 1; // NMI on from here

  clearTilemapToTile16(m); // clear the screen

  mem8[OBJRAM_CTRL_LO] = 0;
  mem8[OBJRAM_CTRL_HI] = 6;
  m.mem16[SPIN_DELAY_WORD] = 0x0100;
  mem8[CELL_8381] = 0x15;

  for (let i = 0; i < PAGE84_LEN; i++) mem8[PAGE84_DEST + i] = mem8[PAGE84_SRC + i];

  mem8[PPI0_CTRL] = 0x9b; // mode0, all inputs
  mem8[PPI1_CTRL] = 0x88; // A/B outputs (sound)

  mem8[SOUND_CTRL_SHADOW] = 0x18;
  mem8[SOUND_CTRL_PORT] = 0x18;

  m.regs.a = 0x00;
  issueSoundCommand(m);

  const unmuted = mem8[SOUND_CTRL_SHADOW] & 0xef; // clear the mute bit
  mem8[SOUND_CTRL_SHADOW] = unmuted;
  mem8[SOUND_CTRL_PORT] = unmuted;

  m.regs.a = 0xff;
  issueSoundCommand(m);

  return m.call(MAIN_LOOP_HEAD); // fall through into the attract/main loop
}

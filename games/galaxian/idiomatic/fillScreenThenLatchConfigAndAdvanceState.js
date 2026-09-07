// SPDX-License-Identifier: GPL-3.0-only
// fillScreenThenLatchConfigAndAdvanceState — game-state-0 boot handler: clear the screen a block at a
// time, then latch machine config and advance out of the boot state.
//
// WHAT IT IS
//   The per-frame handler for game state 0. Every frame it fills a 32-byte tilemap block at the VRAM
//   write cursor with the blank tile and advances the cursor, wiping the screen across successive
//   frames, while a per-state timer counts down. When that timer expires it does the one-time boot
//   latch: it resets the state cluster, folds the DIP/input shadow bits into their config cells, picks
//   the coinage-table byte, unpacks the packed flag bitmask, seeds the object shadow and the player-1
//   status glyphs, and enqueues two deferred command words — handing the machine to the next state.
//
// ROLE IN THE MACHINE
//   Dispatch slot 0 of the game-state table at loc_0066 ({0x00e6, 0x0156, 0x03f2, 0x0536, 0x077b}). It
//   is the cold-boot entry that both clears the tilemap (0x5000-0x53ff, block by block via the write
//   cursor at 0x400b/0x400c) and, on timer expiry, reads the operator configuration out of the input/DIP
//   shadows into the working config cells (see mechanisms.md "Power-on ... boot config"): coinage mode
//   loc_4000 from the top two bits of IN1_SHADOW, config bit loc_401f from IN2_SHADOW, and the
//   screen-flip / cabinet bit loc_400f from IN0_SHADOW, plus a coinage-table byte into loc_40ac. It then
//   expands the packed 16-byte flag bitmask into the 128-byte flag block, seeds the object shadow, writes
//   the player-1 status glyphs, and queues two command words before advancing GAME_STATE.
//
// ROM 0x00e6.  Grounding: [seen].
//
// LIVE-OUT: VRAM_WRITE_PTR advanced; on timer expiry the state cluster, config cells, flag block,
// object shadow, status glyphs and command queue are all updated and GAME_STATE = 1.
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import { fetchIndexedTableByte } from "./fetchIndexedTableByte.js";
import { seedObjectShadowFromRom } from "./seedObjectShadowFromRom.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  VRAM_WRITE_PTR, loc_4008, loc_4007, loc_4006, GAME_STATE, SEQUENCE_STATE,
  IN0_SHADOW, IN1_SHADOW, IN2_SHADOW, IN2_PORT, loc_4000, loc_400f, loc_401f,
  loc_051b, loc_0152, loc_40ac, PLAYER1_STATUS_VRAM, loc_5320, loc_5300,
  loc_0604, loc_0503,
} from "./names.js";

const FILL_TILE = 16;   // blank fill value
const FILL_COUNT = 32;  // bytes filled per pass

export function fillScreenThenLatchConfigAndAdvanceState(m) {
  const { mem8, mem16 } = m;

  // Refill a 32-byte tilemap block at the write cursor (VRAM_WRITE_PTR, 0x400b/0x400c) with the blank
  // tile, then advance the stored cursor past it so the next frame clears the following block.
  const dest = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, dest, FILL_TILE, FILL_COUNT);
  mem16[VRAM_WRITE_PTR] = dest + FILL_COUNT;

  // Hold this state until the per-state timer (loc_4008) elapses — the fill spreads across these frames.
  const remaining = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = remaining;
  if (remaining !== 0) return;

  // Timer elapsed: this is the one-time boot latch. Reset the state cluster (loc_4007=1, loc_4006=0,
  // GAME_STATE=1, SEQUENCE_STATE=0) so the machine leaves boot and enters the attract sequence.
  mem8[loc_4007] = 1;
  mem8[loc_4006] = 0;
  mem8[GAME_STATE] = 1;
  mem8[SEQUENCE_STATE] = 0;

  // Fold operator config out of the input/DIP shadows into their working cells: coinage mode from the
  // top two bits of IN1_SHADOW, a config bit from IN2_SHADOW, and the screen-flip/cabinet bit from
  // IN0_SHADOW. Between them, expand the packed 16-byte flag bitmask at loc_051b into the 128-byte block.
  mem8[loc_4000] = (mem8[IN1_SHADOW] >> 6) & 3;
  mem8[loc_401f] = (mem8[IN2_SHADOW] >> 2) & 1;
  unpackBitmaskToFlagBytes(m, loc_051b);
  mem8[loc_400f] = (mem8[IN0_SHADOW] >> 5) & 1;

  // Pick the coinage-table byte for loc_40ac: index the 4-entry table at loc_0152 by the low two bits of
  // the live IN2 input port (the coin/credit setting), so the credit logic uses the operator's coinage.
  mem8[loc_40ac] = fetchIndexedTableByte(m, mem8[IN2_PORT] & 3, loc_0152);

  // Seed the stride-2 OBJRAM shadow field from ROM (template 0x1d71) so the object layer starts clean.
  seedObjectShadowFromRom(m);

  // Write the three player-1 status column glyphs into the tilemap (status cell, then 0x5320 and 0x5300).
  mem8[PLAYER1_STATUS_VRAM] = 1;
  mem8[loc_5320] = 37;
  mem8[loc_5300] = 32;

  // Append two deferred command words (loc_0604 then loc_0503) to the command queue for the next state.
  enqueueCommandWord(m, loc_0604);
  return enqueueCommandWord(m, loc_0503);
}

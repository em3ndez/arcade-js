// SPDX-License-Identifier: GPL-3.0-only
// Per-state init tick: refill a 32-byte block at the write cursor and advance the stored cursor, then
// count the per-state timer down. On expiry reset the state cluster, fold three config/input bits into
// their flag cells, unpack the flag bitmask, seed the object shadow and the status column, and append
// two deferred command words to the event queue.
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

  // Refill the cursor block and advance the stored cursor past it.
  const dest = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, dest, FILL_TILE, FILL_COUNT);
  mem16[VRAM_WRITE_PTR] = dest + FILL_COUNT;

  // Hold this state until the per-state timer elapses.
  const remaining = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = remaining;
  if (remaining !== 0) return;

  // Elapsed: reset the state cluster.
  mem8[loc_4007] = 1;
  mem8[loc_4006] = 0;
  mem8[GAME_STATE] = 1;
  mem8[SEQUENCE_STATE] = 0;

  // Fold config/input bits into their flag cells.
  mem8[loc_4000] = (mem8[IN1_SHADOW] >> 6) & 3;
  mem8[loc_401f] = (mem8[IN2_SHADOW] >> 2) & 1;
  unpackBitmaskToFlagBytes(m, loc_051b);
  mem8[loc_400f] = (mem8[IN0_SHADOW] >> 5) & 1;

  // Select a config byte from the 4-entry table by the low 2 bits of the input port.
  mem8[loc_40ac] = fetchIndexedTableByte(m, mem8[IN2_PORT] & 3, loc_0152);

  seedObjectShadowFromRom(m);

  // Seed the three player-status column glyphs.
  mem8[PLAYER1_STATUS_VRAM] = 1;
  mem8[loc_5320] = 37;
  mem8[loc_5300] = 32;

  // Append two deferred command words to the event queue.
  enqueueCommandWord(m, loc_0604);
  return enqueueCommandWord(m, loc_0503);
}

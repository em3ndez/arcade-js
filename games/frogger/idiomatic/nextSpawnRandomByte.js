// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextSpawnRandomByte — ring XOR step: fold two cells of the work-RAM ring through the moving cursor.
 * LIVE-OUT: memory + register A (the XOR result).
 */
import { SPAWN_RNG_RING_BASE } from "./names.js";

const RING_SIZE = 32;
const WRAP_TO = 31;
const FOLD_OFFSET = 13; // the partner cell sits this far ahead of the cursor
const FOLD_BACK = 31; // folded back under the ring size when it overshoots

export function nextSpawnRandomByte(m) {
  const { regs, mem8 } = m;

  let cursor = (mem8[SPAWN_RNG_RING_BASE] - 1) & 0xff;
  if (cursor === 0) cursor = WRAP_TO;
  mem8[SPAWN_RNG_RING_BASE] = cursor;

  let j = (cursor + FOLD_OFFSET) & 0xff;
  if (j >= RING_SIZE) j -= FOLD_BACK;

  const value = mem8[(SPAWN_RNG_RING_BASE + cursor)] ^ mem8[(SPAWN_RNG_RING_BASE + j)];
  mem8[(SPAWN_RNG_RING_BASE + j)] = value;
  return (regs.a = value);
}

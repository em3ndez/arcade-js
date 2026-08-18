// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickAttractCellFrameClock — advance one attract cell's animation frame on its tick clock.
 * While the per-cell tick timer has not run out, returns false so the caller skips its remainder.
 * On the tick it reloads, steps the frame cursor down (wrapping at zero), sets that frame's table
 * tile in the accumulator, and returns true.
 * LIVE-OUT: memory; on the true return also the accumulator tile in A.
 */
import { u8 } from "../../../core/int.js";
import { ATTRACT_FRAME_TIMER, ATTRACT_FRAME_INDEX, ATTRACT_TILE_TABLE } from "./names.js";

const TIMER_RELOAD = 8;
const INDEX_WRAP = 4;

// The tile for the current attract-cell animation frame: table[frame index]. The oracle leaves this in
// A on the elapsed exit; idiomatic callers read it register-free from the frame index this clock advanced.
export function attractCellFrameTile(m) {
  const { mem8 } = m;
  const index = mem8[ATTRACT_FRAME_INDEX];
  return mem8[(ATTRACT_TILE_TABLE & ~0xff) | u8((ATTRACT_TILE_TABLE & 0xff) + index)];
}

export function tickAttractCellFrameClock(m) {
  const { mem8 } = m;

  const timer = u8(mem8[ATTRACT_FRAME_TIMER] - 1);
  mem8[ATTRACT_FRAME_TIMER] = timer;
  if (timer !== 0) return false;

  mem8[ATTRACT_FRAME_TIMER] = TIMER_RELOAD;

  let index = u8(mem8[ATTRACT_FRAME_INDEX] - 1);
  if (index === 0) index = INDEX_WRAP;
  mem8[ATTRACT_FRAME_INDEX] = index;

  const tile = attractCellFrameTile(m);
  return (m.regs.a = tile, true);
}

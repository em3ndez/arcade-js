// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickAttractCellFrameClock — advance one attract cell's animation frame on its tick clock.
 * While the per-cell tick timer has not run out, returns false so the caller skips its remainder.
 * On the tick it reloads, steps the frame cursor down (wrapping at zero), sets that frame's table
 * tile in the accumulator, and returns true.
 * LIVE-OUT: memory; on the true return also the accumulator tile in A.
 */
import { u8 } from "../../../core/int.js";

const FRAME_TIMER = 0x83bd;
const FRAME_INDEX = 0x83be;
const TILE_TABLE = 0x2e1b;
const TIMER_RELOAD = 8;
const INDEX_WRAP = 4;

export function tickAttractCellFrameClock(m) {
  const { mem8 } = m;

  const timer = u8(mem8[FRAME_TIMER] - 1);
  mem8[FRAME_TIMER] = timer;
  if (timer !== 0) return false;

  mem8[FRAME_TIMER] = TIMER_RELOAD;

  let index = u8(mem8[FRAME_INDEX] - 1);
  if (index === 0) index = INDEX_WRAP;
  mem8[FRAME_INDEX] = index;

  const tile = mem8[(TILE_TABLE & 0xff00) | u8((TILE_TABLE & 0xff) + index)];
  return (m.regs.a = tile, true);
}

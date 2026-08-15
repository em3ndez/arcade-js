// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickAttractCellFrameClock — advance one attract cell's animation frame on its tick clock.
 * While the per-cell tick timer has not run out this reports false via a double caller-skip: it
 * drops its saved pointer and the caller's return and rets to the caller's caller. On the tick it
 * reloads, steps the frame cursor down (wrapping at zero), and returns that frame's table tile in
 * the accumulator with the saved pointer restored.
 * LIVE-OUT: memory; on the true return also the accumulator tile and the restored pointer.
 */
import { u8 } from "../../../core/int.js";

const FRAME_TIMER = 0x83bd;
const FRAME_INDEX = 0x83be;
const TILE_TABLE = 0x2e1b;
const TIMER_RELOAD = 8;
const INDEX_WRAP = 4;

export function tickAttractCellFrameClock(m) {
  const { regs, mem8 } = m;

  m.push16(regs.hl);

  const timer = u8(mem8[FRAME_TIMER] - 1);
  mem8[FRAME_TIMER] = timer;
  if (timer !== 0) {
    m.pop16();
    m.pop16();
    m.ret();
    return false;
  }

  mem8[FRAME_TIMER] = TIMER_RELOAD;

  let index = u8(mem8[FRAME_INDEX] - 1);
  if (index === 0) index = INDEX_WRAP;
  mem8[FRAME_INDEX] = index;

  regs.a = mem8[(TILE_TABLE & 0xff00) | u8((TILE_TABLE & 0xff) + index)];
  regs.hl = m.pop16();
  m.ret();
  return true;
}

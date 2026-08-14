// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1198 — coordinate/column compute for the tile render loop. Take HL's distance from the
 * VRAM base (less the incoming borrow), keep its top three column bits, then run six passes that
 * fold one probed H bit and the shifted column bits into an accumulator, and three final rotates.
 * The accumulator is the result and it is returned in C; no memory is touched.
 * LIVE-OUT: register C.
 */
import { loc_a800 } from "./names.js";

const PASSES = 6;
const FINAL_ROTATES = 3;
const COLUMN_BITS = 0xe0;
const H_PROBE_BIT = 0x04;

const rotateLeft = (v) => ((v << 1) | (v >> 7)) & 0xff;

export function loc_1198(m) {
  const { regs } = m;
  const borrow = regs.fC ? 1 : 0;
  const offset = (regs.hl - loc_a800 - borrow) & 0xffff;
  let low = offset & COLUMN_BITS;
  let high = (offset >> 8) & 0xff;
  let acc = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    acc = rotateLeft(acc);
    if (high & H_PROBE_BIT) acc = (acc + 1) & 0xff; // fold the probed H bit into bit 0
    const carry = (low >> 7) & 1;
    low = ((low << 1) | carry) & 0xff;
    high = ((high << 1) | carry) & 0xff;
  }
  for (let i = 0; i < FINAL_ROTATES; i++) acc = rotateLeft(acc);
  regs.c = acc;
}

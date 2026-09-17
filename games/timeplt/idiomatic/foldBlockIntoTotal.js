// SPDX-License-Identifier: GPL-3.0-only
/** foldBlockIntoTotal — add a run of bytes into a total the caller has already started, walking a SECOND
 * pointer alongside it a byte at a time. The second walk contributes nothing to the total: each
 * step overwrites the same byte-sized holder, so only the last byte it passes survives the loop.
 * The length arrives as a count that means a full 256 when it is zero, both pointers step in
 * lockstep, and the total wraps at eight bits. Nothing is written.
 * LIVE-OUT: the total, returned and left standing in A; the last byte the second walk read (C);
 * both pointers, each standing one past its own run (HL, DE); and the length counted down to
 * nothing (B). All returned as register-out (load-bearing: register-dispatched from the frozen
 * translated layer), the return value being the total. */

import { u8, u16 } from "../../../core/int.js";

const LENGTH_ZERO_MEANS = 256;

export function foldBlockIntoTotal(m, running = m.regs.a, sumFrom = m.regs.hl, walkFrom = m.regs.de, length = m.regs.b, lastWalked = m.regs.c) {
  const { mem8 } = m;
  const run = length === 0 ? LENGTH_ZERO_MEANS : length;
  let total = running;
  let walked = lastWalked;
  for (let i = 0; i < run; i++) {
    total = u8(total + mem8[u16(sumFrom + i)]);
    walked = mem8[u16(walkFrom + i)];
  }
  return (m.regs.c = walked), (m.regs.hl = u16(sumFrom + run)), (m.regs.de = u16(walkFrom + run)), (m.regs.b = 0), (m.regs.a = total);
}

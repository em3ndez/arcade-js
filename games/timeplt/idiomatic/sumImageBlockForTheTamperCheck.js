// SPDX-License-Identifier: GPL-3.0-only
/** sumImageBlockForTheTamperCheck — add a run of bytes together and hand the total on to the routine this entry
 * transfers into, reached by a jump so that routine's own return carries this one. The run is
 * walked forward from a pointer; the length means a full 256 when it is zero and the total wraps
 * at eight bits. Nothing is written and nothing is compared: this entry produces a number, and
 * what is made of it belongs to the chain. The flags the additions leave are not reproduced.
 * The chain is entered by a direct call, as the original jumps into it, so this entry performs no return of
 * its own and pops no slot; `handOn` is that continuation, the parking step of the tamper verdict unless
 * a caller names another. LIVE-OUT: memory, whatever the chain writes; plus the total and the pointer, handed on. */

import { u8, u16 } from "../../../core/int.js";
import { parkTheImageTotalForTheTamperVerdict } from "./parkTheImageTotalForTheTamperVerdict.js";

const LENGTH_ZERO_MEANS = 256;

export function sumImageBlockForTheTamperCheck(m, base = m.regs.hl, length = m.regs.b, handOn = parkTheImageTotalForTheTamperVerdict) {
  const { regs, mem8 } = m;
  const run = length === 0 ? LENGTH_ZERO_MEANS : length;
  let total = 0;
  for (let i = 0; i < run; i++) total = u8(total + mem8[u16(base + i)]);
  // The total, the walked pointer and the spent counter are the register-out bridge the
  // continuation reads; they ride the return into the continuation, entered directly as the original jumps to it.
  return (regs.a = total), (regs.hl = u16(base + run)), (regs.b = 0),
    handOn(m, total);
}

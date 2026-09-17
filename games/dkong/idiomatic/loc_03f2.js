// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_03f2 — store the caller's byte at the caller's destination, then, unless the spin counter's
 * low bit is set this frame, overwrite it at the same cell with the byte plus one — a one-frame
 * jitter between two adjacent values. Both stores are kept so the write trace matches, not just
 * the final byte. The counter is read AFTER the first store, preserving the hardware order.
 *
 * LIVE-OUT: memory-only — the caller's destination cell.
 */

import { u8 } from "../../../core/int.js";
import { SPIN_COUNT } from "./names.js";

export function loc_03f2(m) {
  const { regs, mem8 } = m;

  const dest = regs.hl; // caller-supplied destination address
  const value = regs.b; // caller-supplied byte to store

  mem8[dest] = value;

  if ((mem8[SPIN_COUNT] & 1) === 0) {
    mem8[dest] = u8(value + 1);
  }
}

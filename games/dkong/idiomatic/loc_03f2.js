// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_03f2 — store a byte at a caller-given address, then bump-and-restore it on a spin coin-flip.  ROM 0x03F2.
 *
 * A tiny store helper the caller reaches with a destination address and a byte already
 * chosen. It always writes that byte to the destination. Then, unless the spin counter's
 * low bit is set this frame, it writes the byte AGAIN at the SAME destination one higher —
 * so the cell ends holding the byte on the frames the low bit is set, and the byte + 1 on
 * the frames it is clear. There is no address step between the two writes: the second store
 * overwrites the first at the one destination, and the +1 wraps at a byte (0xFF + 1 -> 0).
 *
 * The net effect is a one-frame jitter on the stored byte, alternating between two adjacent
 * values as the spin counter's low bit flickers with per-frame workload. The first store is
 * unconditional, so it is the only value that survives on the set-bit frames and is the base
 * the clear-bit frames bump from; on the clear-bit frames the first store is immediately
 * overwritten and shows up only in a write trace, never in the final cell. Both stores are
 * kept here so the write behaviour matches the oracle exactly, not just the final byte.
 *
 * The destination and the byte are the caller's — the sole caller (sub_03a2, ROM 0x03A2)
 * hands it a sprite-buffer cell and a sprite value from either of its two arms — so this
 * routine reads them as inputs and writes only where told. Because the destination is a
 * caller-supplied pointer, the read of the spin counter happens AFTER the first store, which
 * matters only in the degenerate case where the destination IS the spin counter (it is not,
 * in play): the order is preserved so that case still tracks the oracle.
 *
 * A LEAF: reads the spin counter and the caller's destination/byte, writes the caller's
 * destination (once or twice), calls nothing and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03f2.test.js.
 * GATE:     exhaustive over what decides the effect — the stored byte (all 256, covering the
 *           +1 wrap) crossed with the spin low bit, plus an all-256 spin sweep proving only
 *           the low bit is consulted, plus a destination sweep across work RAM proving the
 *           write is pointer-relative (including the self-referential destination == spin
 *           counter, which fixes the store-then-read order) — all compared to the oracle on
 *           RAM. Plus real captured 0x03F2 dispatches from an attract run.
 * LIVE-OUT: memory-only (the caller's destination cell). The oracle's residual registers and
 *           flags and its early return are dead ABI: the sole caller reloads its scratch and
 *           consumes no value the routine leaves behind — it returns nothing.
 * NAMES:    SPIN_COUNT (0x6019) — from ram.js. The destination is a register-supplied pointer
 *           (0x6A29 in play, inside SPRITE_BUFFER) with no fixed named cell, so it stays a
 *           bare address read from the caller's register.
 */

import { u8 } from "../../../core/int.js";
import { SPIN_COUNT } from "./ram.js";

/**
 * @param {object} m  the machine (uses m.regs for the destination/byte inputs and m.mem).
 * @returns {void}
 */
export function loc_03f2(m) {
  const { regs, mem } = m;

  const dest = regs.hl; // caller-supplied destination address
  const value = regs.b; // caller-supplied byte to store

  // Unconditional first store — the value that survives on set-bit frames and the base the
  // clear-bit frames bump from.
  mem.write8(dest, value);

  // On the frames the spin counter's low bit is CLEAR, store one higher at the same cell,
  // overwriting the first store; the +1 wraps at a byte. Read AFTER the first store to keep
  // the store-then-read order the oracle uses.
  if ((mem.read8(SPIN_COUNT) & 1) === 0) {
    mem.write8(dest, u8(value + 1));
  }
}

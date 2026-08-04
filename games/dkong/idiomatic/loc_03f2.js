// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_03f2 — store a byte at a caller-given address, then bump it by one on a spin coin-flip.
 *
 * A tiny store helper the caller reaches with a destination address and a byte already chosen.
 * It always writes that byte to the destination. Then, unless the spin counter's low bit is
 * set this frame, it writes the byte AGAIN at the SAME destination, one higher — so the cell
 * ends holding the byte on the frames the low bit is set, and the byte plus one on the frames
 * it is clear. There is no address step between the two writes: the second store overwrites the
 * first at the one destination, and the increment wraps at a byte.
 *
 * The net effect is a one-frame jitter on the stored byte, alternating between two adjacent
 * values as the spin counter's low bit flickers with per-frame workload — and that counter
 * flickers because it advances once per main-loop pass, so its rate follows how much work each
 * frame's code did. The first store is unconditional, so it is the only value that survives on
 * the set-bit frames and the base the clear-bit frames bump from; on the clear-bit frames it is
 * immediately overwritten and shows up only in a write trace, never in the final cell. Both
 * stores are kept so the write behaviour matches, not just the final byte.
 *
 * The destination and the byte are the caller's — in play a sprite-buffer cell and a sprite
 * value — so this routine writes only where it is told. The spin counter is read AFTER the
 * first store, which matters only in the degenerate case where the destination IS the spin
 * counter. That does not happen in play, but the order is preserved so the case stays faithful.
 *
 * A LEAF: reads the spin counter and the caller's destination and byte, writes the destination
 * once or twice, calls nothing and returns nothing.
 *
 * LIVE-OUT: memory-only — the caller's destination cell.
 */

import { u8 } from "../../../core/int.js";
import { SPIN_COUNT } from "./names.js";

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
  // overwriting the first store; the increment wraps at a byte. The counter is read AFTER the
  // first store, which is the order the hardware sequence uses.
  if ((mem.read8(SPIN_COUNT) & 1) === 0) {
    mem.write8(dest, u8(value + 1));
  }
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp50mBoardTiles — during board setup, stamp four tilemap cells, but only on
 * the 50m conveyor board (board 2).
 *
 * Reached unconditionally from every board's setup pass, but its first act is a
 * per-board applicability gate: it loads the board mask 0x02 (bit1 = 50m) and runs
 * the shared board gate, which opens only when the current board is 2. Off the 50m
 * board the gate is closed and the routine writes nothing; on the 50m board it
 * stamps a fixed two-tile motif into two video-RAM cell pairs, tile 0x10 then tile
 * 0xC0 in each pair.
 *
 * The two cells of a pair are two bytes apart because tilemap columns are stride-2
 * in this address layout. The four writes are a two-pass loop in the original, with
 * the second pair's base address loaded INSIDE the loop — so pass 1 fills the first
 * pair and pass 2 the second. Hoisting that load out "as loop-invariant" would write
 * the second pair twice and lose the first; written out as four explicit stores, the
 * trap cannot recur.
 *
 * INPUT-INDEPENDENT on the open arm: every stored value is a constant, so the four
 * writes are identical regardless of prior machine state. Its only callee is the
 * gate, modelled as a boolean; it touches no other memory and no register a caller
 * reads.
 *
 * LIVE-OUT: memory-only — the four video-RAM bytes on the open arm, nothing on the
 * closed arm.
 */
import { boardBitGate } from "./boardBitGate.js";

export function stamp50mBoardTiles(m) {
  const { regs, mem } = m;

  // Per-board applicability gate: mask 0x02 = bit1 = 50m. The gate reads the current
  // board and reports whether this board's bit is set; closed off the 50m board -> the
  // caller-skip idiom drops the rest.
  regs.a = 0x02;
  if (!boardBitGate(m)) return;

  // Open only on the 50m board: stamp the fixed motif into the two cell pairs.
  mem.write8(0x776c, 0x10);
  mem.write8(0x776e, 0xc0);
  mem.write8(0x748c, 0x10);
  mem.write8(0x748e, 0xc0);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp50mBoardTiles — during board setup, stamp four tilemap cells, but only on
 * the 50m conveyor board (board 2).  ROM 0x3FA6.
 *
 * Reached unconditionally from every board's setup pass (loc_0cc6 `jp 0x3FA0` ->
 * loc_3fa0 `call 0x3FA6`), but its first act is a per-board applicability gate: it
 * loads the board mask 0x02 (bit1 = 50m) and runs `rst 0x30` (boardBitGate), which
 * opens only when BOARD == 2. Off the 50m board the gate is closed and the routine
 * writes nothing; on the 50m board it stamps a fixed two-tile motif into two
 * video-RAM cell pairs:
 *
 *     0x776C = 0x10   0x776E = 0xC0        (first pair)
 *     0x748C = 0x10   0x748E = 0xC0        (second pair)
 *
 * The two cells of a pair are two bytes apart because tilemap columns are stride-2
 * in this address layout. The oracle expresses the four writes as a two-pass `djnz`
 * loop whose `ld hl,0x748C` sits INSIDE the loop, so pass 1 fills the 0x776C pair
 * and pass 2 the 0x748C pair — hoisting that load out "as loop-invariant" would
 * write the 0x748C pair twice and lose the 0x776C pair (the documented sub_3fa6
 * trap). Written out as four explicit stores, the trap cannot recur.
 *
 * INPUT-INDEPENDENT on the open arm: every stored value is a constant, so the four
 * writes are identical regardless of prior machine state. Its only callee is the
 * gate, modelled as a boolean; it touches no other memory and no register a caller
 * reads.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3fa6.test.js.
 * GATE:     crafted-entry — BOTH arms are hit by real captured dispatches: the
 *           closed arm by plain 25m attract (board 1, writes nothing) and the open
 *           arm by a Karl-sanctioned board poke forcing 50m (board 2) setup, whose
 *           setup pass dispatches this once with the gate open. Plus crafted board-2
 *           pokes on a captured board-1 state (pre-dirtied cells + garbage
 *           registers/far-RAM prove input-independence) and a hoist-trap teeth twin.
 *           Fresh clone per case (it writes video RAM).
 * LIVE-OUT: memory-only — the four video-RAM bytes on the open arm, nothing on the
 *           closed arm. loc_3fa0's next act after the call is `jp 0x0D5F` with no
 *           flag branch and no read of any register this leaves, so no register/flag
 *           is live; the oracle's terminal pc advance and its `ret` SP+2 pop are the
 *           step/stack ABI the direct-call layer replaces with a JS return, so
 *           neither pc nor SP is live either. (The gate's own caller-skip stack idiom
 *           is likewise the boolean return — no stack modelling.)
 * NAMES:    BOARD (0x6227) is read inside boardBitGate (imported). The four targets
 *           are video-RAM tilemap addresses (0x74xx/0x77xx), not work RAM, so they
 *           stay bare hex constants — they reference no work-RAM name.
 */
import { boardBitGate } from "./boardBitGate.js";

export function stamp50mBoardTiles(m) {
  const { regs, mem } = m;

  // Per-board applicability gate: mask 0x02 = bit1 = 50m. boardBitGate reads BOARD
  // and reports whether this board's bit is set; closed off the 50m board -> the
  // caller-skip idiom drops the rest, exactly `if (!m.call(0x0030)) return`.
  regs.a = 0x02;
  if (!boardBitGate(m)) return;

  // Open only on the 50m board: stamp the fixed motif into the two cell pairs.
  mem.write8(0x776c, 0x10);
  mem.write8(0x776e, 0xc0);
  mem.write8(0x748c, 0x10);
  mem.write8(0x748e, 0xc0);
}

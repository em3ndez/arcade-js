// SPDX-License-Identifier: GPL-3.0-only
/**
 * signStepHalfRate — collapse a direction byte to a ±1 step, every other frame.  ROM 0x26E9.
 *
 * A leaf in the 50m object subsystem (sub_25f2, gated by `rst 0x30` mask 0x02 =
 * BOARD 2). Its callers keep a signed "direction" byte per moving channel — 0x62A1
 * (published to 0x63A3), 0x62A3 (to 0x63A5, and negated to 0x63A4), 0x62A6 (to
 * 0x63A6) — and hand this routine that byte's address in HL. It normalises the byte
 * to a UNIT step in its own sign direction and returns it, but only on alternate
 * frames:
 *
 *   - It reads FRAME (0x601A, the NMI-DECREMENTED frame counter) and tests bit 0.
 *     On an EVEN frame (bit 0 clear) the oracle's `and 0x01 / ret z` returns with
 *     A = 0 and writes nothing — the channel emits a zero step this frame.
 *   - On an ODD frame it reads bit 7 (the sign bit) of the byte at (HL): set (byte
 *     is negative) -> step = 0xFF (-1), clear -> step = 0x01 (+1). It stores the step
 *     back into (HL) and returns it in A.
 *
 * So the byte at (HL) is a persistent direction latch (its magnitude is discarded —
 * after the first odd frame it holds only ±1), and the value the caller publishes to
 * its 0x63Ax shadow pulses 0 / ±1 across frames: a fixed-direction step delivered at
 * HALF the frame rate. The direction itself is flipped elsewhere (the sibling
 * countdown/reload routines and 0x26DE); this routine only reduces-to-sign.
 *
 * HL is a caller-supplied pointer, left unchanged. A LEAF: reads FRAME + one byte,
 * writes at most that one byte, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-26e9.test.js.
 * GATE:     exhaustive — a total function of (FRAME, byte-at-HL): the (byte written,
 *           A returned) pair == the oracle over all 256×256 (frame,byte) combos at a
 *           real HL address, covering every branch (even / odd·bit7-set / odd·bit7-
 *           clear); plus crafted real-machine-state entries at the three genuine HL
 *           addresses (0x62A1/0x62A3/0x62A6) with a memory-footprint check. Teeth: a
 *           wrong-sign-bit twin. NOTE: attract never dispatches 0x26E9 — the whole
 *           sub_25f2 cascade is `rst 0x30`-gated to 50m and attract plays 25m — so
 *           every case is exhaustive/crafted, not captured.
 * LIVE-OUT: memory (the byte at HL, rewritten on odd frames only) + register A (the
 *           step — every caller consumes it immediately, storing it to a 0x63Ax
 *           shadow; loc_264c also negates it). Flags are DEAD (no caller reads them);
 *           HL is preserved; no pc/SP (the JS return models the Z80 `ret`).
 * NAMES:    FRAME (0x601A) — from ram.js. HL is a register-relative pointer the
 *           caller supplies, so no fixed RAM address is imported for it.
 */
import { FRAME } from "../optimized/ram.js";

export function signStepHalfRate(m) {
  const { regs, mem } = m;

  // `ld a,(FRAME) / and 0x01 / ret z` — on even frames the step is zero and (HL) is
  // left alone; A is the `and 0x01` result, which is 0.
  if ((mem.read8(FRAME) & 0x01) === 0) {
    regs.a = 0x00;
    return;
  }

  // Odd frame: `bit 7,(hl) / ld a,0xff / jp nz,.. / ld a,0x01` — sign of the byte at
  // (HL) becomes a unit step (0xFF = -1 if negative, else 0x01 = +1), stored back and
  // returned in A.
  const step = (mem.read8(regs.hl) & 0x80) ? 0xff : 0x01;
  mem.write8(regs.hl, step);
  regs.a = step;
}

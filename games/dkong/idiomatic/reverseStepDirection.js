// SPDX-License-Identifier: GPL-3.0-only
/**
 * reverseStepDirection — flip the sign of a signed direction-step byte at (HL).  ROM 0x26DE.
 *
 * Donkey Kong keeps a one-byte signed "direction step" for certain timed sprite
 * objects; the byte's SIGN bit selects which way the object is currently moving.
 * This routine reverses that direction: it reads the byte HL points at and rewrites
 * it to +2 (0x02) when the byte is currently negative (bit 7 set) or to -2 (0xFE)
 * when it is non-negative (bit 7 clear). The magnitude is always reset to 2, but
 * only the resulting SIGN is consumed downstream — sub_2523 reads M50_OBJ2_STEP_DIR /
 * M50_OBJ3_STEP_DIR (0x62A3/0x62A6) and takes bit 7 (via `rlca`) to pick a +7 vs -8 sprite
 * movement field, and loc_264c/tail_268d publish the byte on to M50_OBJ2_STEP_POS /
 * M50_OBJ3_STEP (0x63A5/0x63A6, the 50m published-step shadows). So the observable effect is a
 * direction reversal on the object this byte steers.
 *
 * A LEAF: it calls nothing and touches exactly one byte — a single read and a single
 * write, both at (HL). Its three live callers all sit under sub_25f2 and use it as an
 * on-timer-expiry direction flip: sub_2602 (HL=M50_OBJ1_STEP_DIR 0x62A1), sub_262f
 * (HL=M50_OBJ2_STEP_DIR 0x62A3), and sub_2679 (HL=M50_OBJ3_STEP_DIR 0x62A6) each set HL,
 * reload a paired countdown, invoke this, and
 * continue without reading any register or flag it leaves behind.
 *
 * Memory-equivalent to the frozen oracle — equivalence-26de.test.js.
 * GATE:     exhaustive — a total function of the one input byte (only bit 7 of (HL)
 *           is read). Swept over all 256 values of (HL) at each real target address
 *           (M50_OBJ1/2/3_STEP_DIR = 0x62A1/0x62A3/0x62A6) on a real captured attract machine, plus crafted
 *           both-arm entries staged like the real callers. Attract never dispatches
 *           0x26DE (0 hits / thousands of frames, asserted), so the gate is
 *           crafted-entry + exhaustive, not real-dispatch.
 * LIVE-OUT: memory-only — the one byte at (HL). The three callers read no register or
 *           flag on return, and the downstream consumer (sub_2523) reads the MEMORY
 *           byte, not any register the oracle leaves; the oracle's residual A/flags
 *           are dead ABI (the whole-machine gate backstops that).
 * NAMES:    none used in code — HL is a live-in pointer supplied by the caller, so the
 *           routine references no fixed RAM address. (The real callers point HL at the 50m
 *           step-direction latches M50_OBJ1_STEP_DIR / M50_OBJ2_STEP_DIR / M50_OBJ3_STEP_DIR
 *           = 0x62A1/0x62A3/0x62A6, now named in names.js; referenced here in prose only.)
 */
export function reverseStepDirection(m) {
  const { regs, mem } = m;
  const v = mem.read8(regs.hl);
  // bit 7 set (currently moving "negative") -> +2; else -> -2 (0xFE as a byte).
  // Reverses the direction; only the resulting sign is read downstream.
  mem.write8(regs.hl, (v & 0x80) ? 0x02 : 0xfe);
}

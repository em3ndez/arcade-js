// SPDX-License-Identifier: GPL-3.0-only

/**
 * negateA — two's-complement negate of the accumulator: A = (-A) & 0xff.
 *
 * ROLE: one of the tiny signed-delta arithmetic primitives that the motion/steer spines lean on. In the
 * original 6502 code this is the classic "CLC / EOR #$ff / ADC #$01"-style negate — flip every bit and add
 * one — which turns a value into its two's-complement opposite. The movement code calls it whenever it must
 * subtract a magnitude or reflect a heading (e.g. folding a negative lane delta before re-homing an object,
 * or reversing a segment's vertical steer at a wall bounce).
 *
 * ROM/HARDWARE: this is pure register math — no memory, no I/O — so it is grounded from behaviour only.
 * It assumes the CPU is in BINARY mode (the D/decimal flag clear); in decimal mode the wrap would differ,
 * but every caller in this subsystem runs binary.
 *
 * GROUNDING: [code] (behaviour-derived; no cell to watch in MAME).
 * LIVE-OUT: register A — the negated byte, masked back into 0..0xff.
 */
export function negateA(m, a = m.regs.a) {
  // Two's-complement negate: -a as a JS number, then mask to a single byte so the result wraps exactly
  // the way the 8-bit accumulator would. Written straight back to register A (the routine's live-out).
  return (m.regs.a = (-a) & 0xff);
}

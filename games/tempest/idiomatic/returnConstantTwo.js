// SPDX-License-Identifier: GPL-3.0-only

/**
 * returnConstantTwo -- register-only leaf that always yields the constant pair A = 0x02, Y = 0x00. ROM 0xb955.
 *
 * Role in the machine: a shared "return the small constant 2" helper. Several callers reach this address
 * to load A with 2 (and clear Y) before falling through to a common tail -- it is the fixed-value arm of a
 * larger routine that other paths enter with a different constant. It has no game state of its own: it is
 * pure control-flow furniture that spares the ROM a duplicated pair of immediate loads.
 *
 * Behavior: writes 0x02 into the accumulator and 0x00 into the Y index register, then returns. No branch,
 * no loop, no memory access -- the two register assignments are the entire body.
 *
 * Live-out: the CPU registers A = 0x02 and Y = 0x00. Touches no memory cell, so it leaves nothing for a
 * later frame beyond what the immediate caller consumes from A/Y. Grounding: [code].
 */
export function returnConstantTwo(m) {
  // A <- 2, Y <- 0; the array is just the two register writes evaluated in order and handed back.
  return [(m.regs.a = 0x02), (m.regs.y = 0x00)];
}

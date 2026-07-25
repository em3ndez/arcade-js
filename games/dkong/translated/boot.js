// SPDX-License-Identifier: GPL-3.0-only
/**
 * Translated boot path: Z80 reset through main-loop entry.
 *
 * Translated in EXECUTION ORDER from the reset vector. Every routine below
 * carries its ROM address range and the original mnemonics so fidelity is
 * auditable line by line.
 *
 * Register state is threaded through `Regs` rather than JS locals because the
 * original passes values between routines in registers.
 */

export { reset } from "./reset.js";
export { bootOnly } from "./bootOnly.js";
export { bootInit } from "./bootInit.js";
export { sub_011c } from "./sub_011c.js";

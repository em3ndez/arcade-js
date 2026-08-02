// SPDX-License-Identifier: GPL-3.0-only
/**
 * Translated boot path: Z80 loc_0000 through main-loop entry.
 *
 * Translated in EXECUTION ORDER from the loc_0000 vector. Every routine below
 * carries its ROM address range and the original mnemonics so fidelity is
 * auditable line by line.
 *
 * Register state is threaded through `Regs` rather than JS locals because the
 * original passes values between routines in registers.
 */

export { loc_0000 } from "./loc_0000.js";
export { bootOnly } from "./bootOnly.js";
export { loc_0266 } from "./loc_0266.js";
export { loc_011c } from "./loc_011c.js";

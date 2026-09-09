// SPDX-License-Identifier: GPL-3.0-only
import { loc_42, loc_43, loc_62, loc_63, loc_72, loc_73, loc_f0 } from "./names.js";

/**
 * loc_2b79 — a short zero-page state fixup: two unconditional writes and one gated write.
 *   1. derive $72 = ($73 + (0x04 ^ $f0)) & 0xff (plain 8-bit add, carry cleared).
 *   2. mirror $62 = $63.
 *   3. gate   if ($43 & 0xaf) != 0 then $42 = 0x28, else leave $42 untouched.
 * Writes memory only. [code]
 */
export function loc_2b79(m) {
  const { mem8 } = m;
  mem8[loc_72] = mem8[loc_73] + (0x04 ^ mem8[loc_f0]); // derive (store through mem8 truncates the add)
  mem8[loc_62] = mem8[loc_63];                          // mirror
  if ((mem8[loc_43] & 0xaf) !== 0) mem8[loc_42] = 0x28; // gate
}

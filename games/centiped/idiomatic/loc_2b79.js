// SPDX-License-Identifier: GPL-3.0-only
import { loc_42, loc_43, loc_62, loc_63, loc_72, loc_73, loc_f0 } from "./names.js";

/**
 * loc_2b79 (ROM 0x2b79) -- the zero-page state fixup that sits at the bottom of the movement-integrator
 * spine. After the integrator has committed a new coordinate, this routine re-derives the paired shadow
 * cells the rest of the frame reads, so the working ($72/$62) copies stay consistent with the freshly
 * updated ($73/$63) coordinates. It only writes memory; nothing is returned.
 *
 *   1. derive $72 = ($73 + (0x04 ^ $f0)) & 0xff (plain 8-bit add, carry cleared).
 *   2. mirror $62 = $63.
 *   3. gate   if ($43 & 0xaf) != 0 then $42 = 0x28, else leave $42 untouched.
 * Live-out: $72, $62, and conditionally $42. Writes memory only. [code]
 */
export function loc_2b79(m) {
  const { mem8 } = m;
  // Derive the $72 shadow from the live $73 axis: add the constant 0x04 XOR the $f0 mode byte. The
  // store through mem8 truncates to 8 bits, reproducing the 6502 ADC's wrap with carry left clear.
  mem8[loc_72] = mem8[loc_73] + (0x04 ^ mem8[loc_f0]); // derive (store through mem8 truncates the add)
  // Mirror the $63 coordinate into its $62 working copy so both halves of the pair track together.
  mem8[loc_62] = mem8[loc_63];                          // mirror
  // Fall through into the shared gate tail below (the integrator threads straight into it).
  loc_2b86(m);                                          // fall into the $43-mask gate tail
}

// A second entry into this range (a sibling's carry branch lands here): the $43-mask gate tail --
// arm $42 to 0x28 whenever any of the $43 mode bits (& 0xaf) are set. This is why routeByCoordDelta
// can jump straight here for a wide gap: it wants only the $42 arming, not the $72/$62 rewrite. [code]
export function loc_2b86(m) {
  const { mem8 } = m;
  // If any of the $43 control-mode bits are set, arm $42 with the fixed 0x28 marker; otherwise the
  // cell is left exactly as it was so a non-mode frame does not disturb it.
  if ((mem8[loc_43] & 0xaf) !== 0) mem8[loc_42] = 0x28;
}

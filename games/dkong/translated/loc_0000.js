// SPDX-License-Identifier: GPL-3.0-only
import { bootOnly } from "./bootOnly.js";
import { loc_02bd } from "./loc_02bd.js";

/**
 * loc_0000  (ROM 0x0000–0x0005) — the loc_0000 vector: clears the vblank NMI mask, then falls through into the main loop.
 *
 *   0000  3e 00        ld   a,0x00
 *   0002  32 84 7d     ld   (0x7d84),a
 *   0005  c3 66 02     jp   0x0266
 *
 * Clears the vblank NMI mask before anything else: interrupts off during
 * setup. 0x7D84 is the NMI mask (confirmed against MAME's driver:
 * `map(0x7d84,0x7d84).w(nmi_mask_w)`), not an ls259.6h latch bit.
 */
export function loc_0000(m) {
  bootOnly(m);
  // 0x02BC falls THROUGH into the main loop at 0x02BD -- there is no jump
  // instruction, the code simply continues. This was missing, and its absence
  // made the ENTIRE main loop and NMI path dead code while the state diff
  // stayed green -- because the frames it compares all end before boot does.
  // A passing gate said nothing about code it never reached.
  loc_02bd(m);
}

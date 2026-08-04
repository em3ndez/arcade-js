// SPDX-License-Identifier: GPL-3.0-only
/**
 * markNextBarrelAsAltKind — raise bit 7 of BARREL_CLAIM_MODE, leaving the low bits alone.
 *
 * A one-line leaf: read the barrel slot-claim mode byte, turn its top bit on, and store it
 * back. The bits underneath survive untouched, so the mode value the slot-claim cluster
 * wrote into this same byte is preserved — a mode-1 claim with bit 7 raised reads back
 * as 0x81.
 *
 * WHAT BIT 7 DOES: it selects the barrel's KIND. The barrel released after this fires is
 * stamped with a different sprite code, a different attribute (hence a different palette)
 * and a different family index, and that family index is read again on several later paths,
 * so the choice reaches behaviour and not only the picture. Both kinds can be on the board
 * at the same time.
 *
 * WHAT BIT 7 DOES NOT DO: it is NOT what makes a barrel drop straight down instead of
 * rolling along the girders. That is selected by BIT 0 of the same byte, independently of
 * bit 7 — and this routine leaves bit 0 exactly as it found it, so a barrel marked here can
 * still take either path.
 *
 * NOT CLAIMED: which NAMED Donkey Kong object either kind is.
 *
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE. The value is not read back out of a register by
 * anything; only the stored byte is live.
 */

import { BARREL_CLAIM_MODE } from "./names.js";

export function markNextBarrelAsAltKind(m) {
  const { mem } = m;

  // Raise bit 7 (the barrel-kind select) on the slot-claim mode byte, leaving the mode value
  // in the low bits as it is.
  mem.write8(BARREL_CLAIM_MODE, mem.read8(BARREL_CLAIM_MODE) | 0x80);
}

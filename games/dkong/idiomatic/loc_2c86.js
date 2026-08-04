// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c86 — one entry of the bonus-event barrel-release cluster: wipe the slot-claim byte, then
 * ask for a release with mode 3.
 *
 * What sets this entry apart from its siblings is the up-front CLEAR. It zeroes the slot-claim byte
 * and only then hands off, with the mode number 3 and the bonus value the caller supplies. The
 * shared release step always records the mode, and — only when the bonus counter has reached its
 * scheduled mark — claims the first free barrel slot and raises bit 7 of that same byte. Because of
 * the clear, the byte therefore ends this pass at exactly 0 (nothing claimed) or 0x80 (a slot
 * claimed), and can never carry a stale value forward from an earlier pass.
 *
 * The bonus value arrives in a register and is forwarded as an ordinary argument.
 *
 * LIVE-OUT: memory-only — the slot-claim byte, plus whatever the shared release step writes.
 */

import { BARREL_CLAIM_MODE } from "./names.js";
import { armBarrelRelease } from "./armBarrelRelease.js";

const MODE_BYTE = 0x03; // the mode number this entry asks for

/**
 * @param {object} m  the machine; the bonus value is read from a register, and memory is written.
 * @returns {void}
 */
export function loc_2c86(m) {
  const { regs, mem } = m;

  // Wipe the slot-claim byte before asking for the release, so nothing stale survives this pass.
  mem.write8(BARREL_CLAIM_MODE, 0);

  // Ask for a release: mode 3, and the bonus value the caller left in a register.
  armBarrelRelease(m, MODE_BYTE, regs.c);
}

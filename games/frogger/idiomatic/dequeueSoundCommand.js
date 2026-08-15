// SPDX-License-Identifier: GPL-3.0-only
/**
 * dequeueSoundCommand — drain one queued sound command: when the pending count is non-zero, decrement it,
 * issue the front command to the sound chip, then shift the remaining queue down one slot.
 * LIVE-OUT: memory (the count and the shifted queue) plus the sound-chip ports the issuer pulses.
 */
import { loc_8300 } from "./names.js";
import { issueSoundCommand } from "./issueSoundCommand.js";

export function dequeueSoundCommand(m) {
  const { regs, mem8 } = m;

  const pending = mem8[loc_8300];
  if (pending === 0) return;

  mem8[loc_8300] = pending - 1;
  regs.a = mem8[(loc_8300 + 1) & 0xffff]; // front command byte
  issueSoundCommand(m);

  for (let i = 0; i < pending; i++) {
    mem8[(loc_8300 + 1 + i) & 0xffff] = mem8[(loc_8300 + 2 + i) & 0xffff];
  }
}

import { NMI_MASK_LATCH } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * disableFrameInterrupt — switch the per-frame (vblank) interrupt off.
 *
 * The game services itself once per video frame from a vblank interrupt; this is the
 * "off" half of a two-entry pair sharing one control line, its mirror the "on" half.
 * Cold boot calls it first thing, so state seeds with no interrupt able to run against
 * half-built work memory. The mask line takes only the low bit, so storing 0 disables.
 */
export function disableFrameInterrupt(m) {
  // Drive the per-frame interrupt line off; the latch takes the low bit, so 0 is off.
  m.mem8[NMI_MASK_LATCH] = 0;
}

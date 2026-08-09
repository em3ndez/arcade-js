// SPDX-License-Identifier: GPL-3.0-only
/** enterCommandRingDrain — tail transfer into the foreground command-ring loop; hands control to the ring drain and never comes back. LIVE-OUT: whatever the drain leaves. */

const FOREGROUND_LOOP = 0x0b93;

export function enterCommandRingDrain(m) {
  return m.call(FOREGROUND_LOOP);
}

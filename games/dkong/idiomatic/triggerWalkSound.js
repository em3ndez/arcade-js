// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerWalkSound — request Mario's footstep sound by storing a three-frame hold
 * into the walk slot of the sound-trigger shadow; the per-vblank sound driver
 * counts it down and holds the latch asserted while non-zero.
 *
 * LIVE-OUT: memory-only — the walk slot of the sound-trigger block.
 */

import { SND_TRIGGER } from "./names.js";

const WALK_ASSERT_FRAMES = 0x03;

export function triggerWalkSound(m) {
  m.mem8[SND_TRIGGER] = WALK_ASSERT_FRAMES;
}

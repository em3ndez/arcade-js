// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerWalkSound — request Mario's footstep ("walk") sound for three frames.
 *
 * The walk sound is a discrete analog circuit behind a hardware latch the processor cannot read
 * back, so game code asks for it through a work-RAM shadow instead: it stores a small frame count
 * into the walk slot of the sound-trigger block, and the per-vblank sound driver counts that value
 * down, holding the latch asserted for as long as it stays non-zero. This leaf performs that one
 * store — the walk slot gets 3, a three-frame hold, one short footstep blip.
 *
 * It reads nothing, branches nowhere, and always writes the same constant, so what it does cannot
 * depend on the machine state it is entered with. Whether a footstep happens at all is a decision
 * taken before the call; this routine is only the store that carries it out.
 *
 * LIVE-OUT: memory-only — the walk slot of the sound-trigger block.
 */

import { SND_TRIGGER } from "./names.js";

// A sound is asserted by storing a small frame count into its trigger shadow; the sound driver
// counts it down, so 3 holds the walk latch for three frames.
const WALK_ASSERT_FRAMES = 0x03;

export function triggerWalkSound(m) {
  m.mem.write8(SND_TRIGGER, WALK_ASSERT_FRAMES);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseSpriteArmOneShotAndQueueSound — shared tail of the sprite-object spawn arms. A per-turn one-shot:
 * while the per-turn scratch flag is still 0 it latches it to 1 and queues the spawn sound onto the ring;
 * once set, the arm has already fired this turn and returns untouched. The queued sound is dropped by the
 * ring primitive when not playing, but the one-shot still latches. LIVE-OUT: memory-only.
 */
import { PER_TURN_SCRATCH } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

const SPRITE_ARM_SOUND = 0x90;

export function raiseSpriteArmOneShotAndQueueSound(m) {
  const { mem8 } = m;
  if (mem8[PER_TURN_SCRATCH] !== 0) return;
  mem8[PER_TURN_SCRATCH] = 1;
  enqueueSoundCommand(m, SPRITE_ARM_SOUND);
}

// SPDX-License-Identifier: GPL-3.0-only
import { spawnChildActorIntoFreeSpriteSlot } from "./spawnChildActorIntoFreeSpriteSlot.js";
/**
 * spawnChildActorIfInRange — B-range guard in front of the child-actor spawn.
 *
 * When B is at or above 0x20 the index is out of range: report it back in A and do nothing.
 * Otherwise hand off (tail) to the spawn step, whose result becomes this routine's result.
 *
 * LIVE-OUT: A — the spawn result when in range, or B itself when out of range; a register-
 * dispatched caller reads it back.
 */

const B_RANGE_LIMIT = 0x20; // B >= this: out of range

export function spawnChildActorIfInRange(m, b = m.regs.b) {
  if (b >= B_RANGE_LIMIT) return (m.regs.a = b);
  return spawnChildActorIntoFreeSpriteSlot(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateFires — one frame of the fire service, in four ordered steps over the same five-record
 * array: (1) the difficulty gate, false meaning this is not one of the frames the fires move on;
 * (2) the census, which tallies live fires and admits at most one pending spawn, false meaning the
 * array is empty; (3) the per-fire state walk; (4) the sprite publish.
 *
 * It must not return the callees' booleans. Those booleans stand for a stack unwind the callees
 * perform themselves; this routine performs none, so its two early exits are plain returns — a
 * `false` leaving here would make the call seam discard a second stack word it does not owe.
 */

import { gateFireUpdateByDifficulty } from "./gateFireUpdateByDifficulty.js";
import { spawnRequestedFireAndRecolorLiveFires } from "./spawnRequestedFireAndRecolorLiveFires.js";
import { publishFireSprites } from "./publishFireSprites.js";

/** The return bracket the per-fire state walk's own return consumes. */
const RESUME_AFTER_STATE_WALK = 0x30f6;

export function updateFires(m) {
  if (!gateFireUpdateByDifficulty(m)) return;

  if (!spawnRequestedFireAndRecolorLiveFires(m)) return;

  // The state walk returns through its own `ret`, so the bracket that `ret` pops is pushed here.
  m.push16(RESUME_AFTER_STATE_WALK);
  m.call(0x31b1);

  publishFireSprites(m);
}

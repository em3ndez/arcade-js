// SPDX-License-Identifier: GPL-3.0-only
/** scrollWorldAtTheEraPace — move the world past the ship at the pace the era sets. It READS the heading rather than
 * deciding it: some paths in write it first and others arrive with whatever is already there. One of
 * three fixed velocity tables is picked from ERA_INDEX alone — the opening era its own, the next two sharing a second,
 * everything from the third era up sharing a third — and the pair that table gives for the ship's heading is handed on to
 * be negated into the world scroll. The three tables are one curve at three sizes: peaks of 256, 306 and 331, within 0.75%
 * of pure scaling of one another, rungs on a ladder of six that climbs in steps of 25. What the era picks is a rung.
 * LIVE-OUT: memory. */

import { loc_1f55 } from "./loc_1f55.js";
import { velocityForHeading } from "./velocityForHeading.js";
import { ERA_INDEX } from "./names.js";

const OPENING_ERA_PACE = 0x5e00;
const EARLY_ERA_PACE = 0x2e3e;
const LATER_ERA_PACE = 0x08fa;
const FIRST_LATER_ERA = 3;

export function scrollWorldAtTheEraPace(m) {
  const era = m.mem8[ERA_INDEX];
  let pace = LATER_ERA_PACE;
  if (era === 0) pace = OPENING_ERA_PACE;
  else if (era < FIRST_LATER_ERA) pace = EARLY_ERA_PACE;

  velocityForHeading(m, pace);
  loc_1f55(m);
}

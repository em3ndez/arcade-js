// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2ce6 — retire one record of a four-record sprite group as the 25m bonus counter runs down,
 * then continue into the barrel-record preset. Below four remaining, zeroes the X (which blanks
 * it) of the record whose index equals the remaining count, so the group empties one per step and
 * is empty at zero.
 *
 * LIVE-OUT: memory-only.
 */

import {
  BONUS_COUNTDOWN_SPRITES,
  SPRITE_X,
} from "./names.js"; // sprite-record field offset (+0), NOT the object-record OBJ_ACTIVE
import { stampReleasedBarrelKind } from "./stampReleasedBarrelKind.js";

const COUNTDOWN_RECORDS = 4;
const SPRITE_RECORD_BYTES = 4;

export function loc_2ce6(m, hl = m.regs.hl, record = m.regs.ix) {
  const { mem8 } = m;

  // The caller left its pointer on the bonus counter it just decremented for this release.
  const remaining = mem8[hl];

  if (remaining < COUNTDOWN_RECORDS) {
    mem8[BONUS_COUNTDOWN_SPRITES + remaining * SPRITE_RECORD_BYTES + SPRITE_X] = 0;
  }

  return stampReleasedBarrelKind(m, record);
}

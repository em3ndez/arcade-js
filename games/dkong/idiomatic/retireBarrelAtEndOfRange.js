// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireBarrelAtEndOfRange — retire a barrel record once its X has run down to the bottom of its
 * travel range, then hand off to the shared sprite tail; otherwise hand it on unchanged. On the
 * retire arm OBJ_ACTIVE and OBJ_X are both zeroed. The record base arrives in the index register,
 * not as a parameter: the hand-off targets read the record straight off that register.
 *
 * LIVE-OUT: whatever the hand-off returns, forwarded unchanged.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import { advanceBarrelTileAnimation } from "./advanceBarrelTileAnimation.js";
import { u8 } from "../../../core/int.js";
import { OBJ_ACTIVE, OBJ_X } from "./names.js";

const X_LIMIT = 16;
// Tolerance for an X that has already wrapped past zero, so a run-down barrel still counts retired.
const WRAP_MARGIN = 8;

export function retireBarrelAtEndOfRange(m, cur, ix = m.regs.ix) {
  const { mem8 } = m;
  const record = ix;

  if (u8(mem8[record + OBJ_X] + WRAP_MARGIN) >= X_LIMIT) return advanceBarrelTileAnimation(m, cur);

  mem8[record + OBJ_ACTIVE] = 0;
  mem8[record + OBJ_X] = 0;
  return publishBarrelSprite(m, cur);
}

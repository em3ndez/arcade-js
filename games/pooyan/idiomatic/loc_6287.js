// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { markHitFlagSeedActorAndScanEnemyRecords } from "./markHitFlagSeedActorAndScanEnemyRecords.js";
import { loc_62e6 } from "./loc_62e6.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_0020 } from "./loc_0020.js";
import {
  FLIP_SCREEN_FLAG,
  ROUND_COUNTER,
  ENEMY_ACTOR_TABLE,
  POSITION_DELTA_TABLE_6360,
  ANIM_SCRIPT_6349,
} from "./names.js";
/**
 * loc_6287 — proximity test and award for one dispatch kind.
 *
 * Too wide a gap on either axis skips the record to the epilogue. One kind engages the target
 * directly; the other latches the actor onto the record, installs its animation, and adds the
 * round-indexed position delta before handing off to the record's re-arm.
 *
 * LIVE-OUT: a boolean — true = normal completion, false = a caller-skip must unwind the frame.
 */
const X_GAP_LIMIT = 0x06;
const Y_GAP_LIMIT = 0x07;
const DIRECT_KIND = 0x50;
const DELTA_FIELD = 0x0a;
const TAG_OFFSET = 0x14;
const REARM_SLOTS = 0x06;
const REARM_STRIDE = 0x18;

export function loc_6287(m, kind = m.regs.a, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy) {
  const { mem8 } = m;
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  if (Math.abs(mem8[iy] - ax) >= X_GAP_LIMIT) return loc_60f2(m, hl, ix, count);
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= Y_GAP_LIMIT) return loc_60f2(m, hl, ix, count);
  if (kind === DIRECT_KIND) return markHitFlagSeedActorAndScanEnemyRecords(m, hl);

  setActorAnimation(m, hl, ANIM_SCRIPT_6349);
  const index = (mem8[ROUND_COUNTER] & 0x07) >> 1;
  const [delta] = loc_0020(m, POSITION_DELTA_TABLE_6360, index);
  mem8[u16(hl + DELTA_FIELD)] = mem8[u16(hl + DELTA_FIELD)] + delta;
  return loc_62e6(m, mem8[u16(hl + TAG_OFFSET)], ENEMY_ACTOR_TABLE, REARM_SLOTS, REARM_STRIDE);
}

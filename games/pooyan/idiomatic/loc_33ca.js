// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_3473 } from "./loc_3473.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  SPAWN_PHASE_SNAPSHOT,
  TURN_COLUMN_LIMIT,
  ANIM_TABLE_3418,
  ANIM_TABLE_3829,
  ANIM_TABLE_3838,
} from "./names.js";
/**
 * loc_33ca — the shared turn-select tail (the state-0 handler's fall-through, and its call target).
 * Looks the low nibble of the spawn-phase snapshot up in the rst-0x20 byte table, latches the value
 * as the turn-column limit, then compares it against the record's target column (rec+0x06): limit
 * above target seats frame 0 and the straight-run table; below seats frame 1 and the turn-around
 * table; equal gates on the aim (rec+0x09) vs the sub-position (rec+0x05) — aim below seats frame =
 * aim and the turn-around table, otherwise it defers without touching the frame. Every non-defer arm
 * writes the frame (rec+0x08) and starts the animation.
 *
 * LIVE-OUT: none — memory only; the record-dispatch caller reloads A and reads no register back.
 */
const OFF_SUBPOS = 0x05; //     sub-position, the aim gate on the equal arm
const OFF_TARGET_COL = 0x06; // target column compared against the fetched limit
const OFF_FRAME = 0x08; //      animation frame index written by every non-defer arm
const OFF_AIM = 0x09; //        aim, compared against the sub-position on the equal arm
const PHASE_MASK = 0x0f;

export function loc_33ca(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const index = mem8[SPAWN_PHASE_SNAPSHOT] & PHASE_MASK;
  const [limit] = loc_0020(m, ANIM_TABLE_3418, index); // rst-0x20 byte-table lookup
  mem8[TURN_COLUMN_LIMIT] = limit;

  const targetColumn = mem8[u16(rec + OFF_TARGET_COL)];
  let frame, animTable;

  if (limit === targetColumn) {
    const aim = mem8[u16(rec + OFF_AIM)];
    if (aim < mem8[u16(rec + OFF_SUBPOS)]) {
      frame = aim;
      animTable = ANIM_TABLE_3838;
    } else {
      return loc_3473(m, rec); // aim caught up -> defer, frame untouched
    }
  } else if (limit > targetColumn) {
    frame = 0x00;
    animTable = ANIM_TABLE_3829;
  } else {
    frame = 0x01;
    animTable = ANIM_TABLE_3838;
  }

  mem8[u16(rec + OFF_FRAME)] = frame;
  return setActorAnimation(m, rec, animTable);
}

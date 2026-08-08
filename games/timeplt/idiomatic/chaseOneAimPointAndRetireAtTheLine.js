// SPDX-License-Identifier: GPL-3.0-only
/** chaseOneAimPointAndRetireAtTheLine — run one object through a whole frame of chasing: re-aim it, turn it, move it, dress
 * its sprite, and retire it once it has drifted onto a retire line. Re-aiming is rationed rather than done every frame: the
 * object carries a phase byte and the aim is only recomputed on the frames whose low four bits match it, which spreads the
 * cost of a crowd of objects across sixteen frames and gives each one a stale aim in between. WHAT IT AIMS AT ALSO MOVES:
 * the pair read here is one of six aim points that are rewritten together as the player travels, so "the" aim point would
 * be wrong twice over — it is neither the only one nor a fixed one, which is why the name says ONE and not THE.
 *
 * The turn, the move and the dressing all run every frame regardless. The counter pair the caller is holding is put back
 * before the retire test, so a caller counting objects keeps its count across all four steps. LIVE-OUT: memory, and the two
 * object pointers and that counter pair, which pass through unchanged. */

import { u16 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";
import { headingToward } from "./headingToward.js";
import { steerTowardAimOneUnitAFrame } from "./steerTowardAimOneUnitAFrame.js";
import { loc_58aa } from "./loc_58aa.js";
import { loc_3faf } from "./loc_3faf.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { retireSlot } from "./retireSlot.js";

const TURN_PHASE = 15;
const AIM_HEADING = 1;
const PHASE_WHEEL = 15;
const ONE_AIM_POINT = 0xac7f;

export function chaseOneAimPointAndRetireAtTheLine(m) {
  const { regs, mem8 } = m;
  const held = regs.bc;
  const object = regs.ix;

  if ((mem8[FRAME_TICK] & PHASE_WHEEL) === mem8[u16(object + TURN_PHASE)]) {
    mem8[u16(object + AIM_HEADING)] = headingToward(m, ONE_AIM_POINT);
  }

  steerTowardAimOneUnitAFrame(m);
  loc_58aa(m);
  loc_3faf(m);

  regs.bc = held;
  if (!hasReachedRetireLine(m)) return;
  retireSlot(m);
}

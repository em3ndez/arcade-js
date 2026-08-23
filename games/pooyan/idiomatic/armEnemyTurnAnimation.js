// SPDX-License-Identifier: GPL-3.0-only
import { loc_0c45 } from "./loc_0c45.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand02 } from "./queueSoundCommand02.js";
import { ANIM_SEQ_TABLE_4076 } from "./names.js";
/**
 * armEnemyTurnAnimation — enter the record's turn/select animation state.
 *
 * Picks one of three animation sequences from the select table by the record's low-2-bit
 * field minus one, installs it on the record, then arms the record's velocity and state
 * bytes and enqueues the accompanying sound command.
 *
 * LIVE-OUT: none — tail-delegates to the sound enqueue, which yields nothing the caller reads;
 * the whole result lives in the record and the sound ring.
 */
const SELECT_FIELD = 0x07; // record: low 2 bits pick the animation (1..3)
const SELECT_MASK = 0x03;
const VELOCITY_FIELD = 0x09; //  record: entry velocity
const STATE_FIELD = 0x02; //     record: state byte
const ENTRY_VELOCITY = 0x40;
const ENTRY_STATE = 0x0f;

export function armEnemyTurnAnimation(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const index = ((mem8[rec + SELECT_FIELD] & SELECT_MASK) - 1) & 0xff;
  const animPointer = loc_0c45(m, index, ANIM_SEQ_TABLE_4076);
  setActorAnimation(m, rec, animPointer);

  mem8[rec + VELOCITY_FIELD] = ENTRY_VELOCITY;
  mem8[rec + STATE_FIELD] = ENTRY_STATE;
  return queueSoundCommand02(m); // tail: enqueue the sound command
}

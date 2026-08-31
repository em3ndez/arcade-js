// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { RECORD_ANIM_SEQ_2CA7, HUNTER_MOVE_SCRIPT } from "./names.js";

const STATE_FIELD = 0x02; // record state byte
const STATE_TRIGGER = 0x11; // state that triggers the transition
const STATE_NEXT = 0x12; // state written on the transition
const SCRIPT_LO = 0x16; // record script pointer, low byte
const SCRIPT_HI = 0x17; // record script pointer, high byte
const SCRIPT_STEP = 0x15; // record script step index

/**
 * advanceRecordStateAndSeedMoveScript — per-record transition helper: only when a record sits in the trigger state
 * does it advance that record to the next state, point it at an animation sequence,
 * seed its script pointer, and clear its script step. Records in any other state are
 * left untouched.
 *
 * LIVE-OUT: memory only — the record's state, animation, and script fields.
 */
export function advanceRecordStateAndSeedMoveScript(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + STATE_FIELD] !== STATE_TRIGGER) return;

  mem8[rec + STATE_FIELD] = STATE_NEXT;
  setActorAnimation(m, rec, RECORD_ANIM_SEQ_2CA7);
  mem8[rec + SCRIPT_LO] = HUNTER_MOVE_SCRIPT; // low byte (store truncates)
  mem8[rec + SCRIPT_HI] = HUNTER_MOVE_SCRIPT >> 8;
  mem8[rec + SCRIPT_STEP] = 0x00;
}

// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { DROP_ANIM_DESCRIPTOR } from "./names.js";

/**
 * loc_1496 — advance one object record (based at IX) and re-arm its state.
 *
 * Steps the object's animation, then walks its position field by its signed step: when the
 * position has run below the step's negation the lap counter decrements first. It then gates on
 * the (possibly decremented) lap counter, split by the active flag: an active object with a
 * low lap count resets its sub-state and idle anim; an inactive object with a very low lap count
 * points itself at the drop animation and arms the drop state. All other cases fall through.
 *
 * LIVE-OUT: memory only — the record. The A it would return is dead (the dispatcher loop that
 * reaches this handler discards it), so no register output.
 */

const REC_SUBSTATE = 0x02; // sub-state byte
const REC_POS = 0x03; //      position field
const REC_LAP = 0x04; //      lap counter
const REC_ACTIVE = 0x07; //   active flag
const REC_STEP = 0x0a; //     signed per-frame step
const REC_ANIM = 0x11; //     anim field

const ANIM_IDLE = 0x20;
const ANIM_DROP = 0x28;
const SUBSTATE_DROP = 0x02;

export function loc_1496(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  const step = mem8[rec + REC_STEP];
  if (mem8[rec + REC_POS] < ((0 - step) & 0xff)) mem8[rec + REC_LAP] -= 1; // ran past the step
  mem8[rec + REC_POS] += step;

  const lap = mem8[rec + REC_LAP];
  if (mem8[rec + REC_ACTIVE] !== 0) {
    if (lap < 4) {
      mem8[rec + REC_SUBSTATE] = 0x00;
      mem8[rec + REC_ANIM] = ANIM_IDLE;
    }
  } else if (lap < 2) {
    setActorAnimation(m, rec, DROP_ANIM_DESCRIPTOR);
    mem8[rec + REC_SUBSTATE] = SUBSTATE_DROP;
    mem8[rec + REC_ANIM] = ANIM_DROP;
  }
}

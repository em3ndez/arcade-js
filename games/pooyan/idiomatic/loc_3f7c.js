// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  SPLASH_ANIM_TABLE_40A4,
  CATCH_TAMPER_CKSUM_TOP,
  TAMPER_STRIKES_CATCH,
} from "./names.js";
import { loc_4006 } from "./loc_4006.js";
import { advanceFallStep } from "./advanceFallStep.js";
import { loc_0c45 } from "./loc_0c45.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_0eda } from "./loc_0eda.js";
import { renderStageCountdownDigits } from "./renderStageCountdownDigits.js";
/**
 * loc_3f7c — object state-9 (catch) handler for the record based at IX.
 *
 * Ticks the animation, advances the fall, and returns while still airborne. On landing it installs
 * the splash animation for the caught kind (rec+7), resets the record's state/timer, scores the
 * catch, and drops the active-enemy count. On the normal path (path-flag bit0 clear) it decrements
 * the stage countdown and repaints it; on the special path it clears the countdown, repaints, and
 * verifies a checksum (bytes down from a fixed top to the terminator, expecting eight
 * carries), raising the integrity strike flag on a mismatch.
 *
 * LIVE-OUT: memory only.
 */
export function loc_3f7c(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // tick the animation
  if (advanceFallStep(m, rec)) return; // still airborne

  const animIndex = ((mem8[rec + 0x07] & 0x03) - 1) & 0xff;
  const anim = loc_0c45(m, animIndex, SPLASH_ANIM_TABLE_40A4);
  setActorAnimation(m, rec, anim);
  mem8[rec + 0x02] = 0x02; // reset state
  mem8[rec + 0x11] = 0x20; // reset splash timer
  loc_0eda(m); // score the catch
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;

  if ((mem8[rec + 0x0b] & 0x01) === 0) {
    if (mem8[STAGE_COUNTDOWN] === 0) return;
    mem8[STAGE_COUNTDOWN] = mem8[STAGE_COUNTDOWN] - 1;
    return renderStageCountdownDigits(m);
  }

  mem8[STAGE_COUNTDOWN] = 0x00;
  renderStageCountdownDigits(m);

  let sum = 0;
  let carries = 0;
  let ptr = CATCH_TAMPER_CKSUM_TOP;
  for (;;) {
    const b = mem8[ptr];
    if (b === 0xc8) break; // terminator
    const total = b + sum;
    if (total > 0xff) carries = (carries + 1) & 0xff;
    sum = total & 0xff;
    ptr = u16(ptr - 1);
  }
  if (((0xc8 - carries) & 0xff) === 0xc0) return; // integrity ok
  mem8[TAMPER_STRIKES_CATCH] = 0x01;
}

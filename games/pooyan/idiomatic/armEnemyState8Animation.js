// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceEnemyAnimationPhase } from "./advanceEnemyAnimationPhase.js";
import { loc_8d45, OBJECT_STATE8_ANIM_TABLE, OBJECT_ANIM_DISPLAY_CMD_BASE } from "./names.js";
/**
 * armEnemyState8Animation — object state-8 handler (dispatched with the object record in IX). Picks a
 * frame-timer reseed and an animation index from the difficulty byte, the child index and the
 * direction bit; when the difficulty path is active it queues a display command and reseeds to 0x38,
 * else 0x20. It then installs the animation from OBJECT_STATE8_ANIM_TABLE, advances the state, and
 * falls through into the state-9 handler (advanceEnemyAnimationPhase, record passed as rec). LIVE-OUT: none — delegates
 * its return to the state-9 chain.
 */

const DIFF_CLAMP = 3;
const TIMER_RESEED_ANIM = 0x38;
const TIMER_RESEED_IDLE = 0x20;
const DIR_BIT = 0x02;

export function armEnemyState8Animation(m, rec = m.regs.ix) {
  const { mem8 } = m;

  let timerReseed = TIMER_RESEED_IDLE;
  let animIndex = mem8[u16(rec + 0x17)];
  const difficulty = mem8[loc_8d45];
  if (difficulty !== 0) {
    const child = (mem8[u16(rec + 0x12)] + 1) & 0xff;
    if (child === 0) {
      animIndex = 0; // child index was 0xff
    } else {
      animIndex = (Math.min(difficulty, DIFF_CLAMP) + 6) & 0xff;
      enqueueDisplayCommand(m, OBJECT_ANIM_DISPLAY_CMD_BASE + animIndex);
      timerReseed = TIMER_RESEED_ANIM;
    }
  }
  mem8[u16(rec + 0x11)] = timerReseed;

  let index = animIndex;
  if (mem8[u16(rec + 0x07)] & DIR_BIT) {
    const stepped = (animIndex + 1) & 0xff;
    index = mem8[loc_8d45] !== 0 ? (stepped + 3) & 0xff : stepped;
  }
  setActorAnimation(m, rec, fetchWordFromTableIndex(m, index, OBJECT_STATE8_ANIM_TABLE));

  const stateCell = u16(rec + 0x02);
  mem8[stateCell] = mem8[stateCell] + 1; // advance the object state
  return advanceEnemyAnimationPhase(m, rec); // fall through into the state-9 handler
}

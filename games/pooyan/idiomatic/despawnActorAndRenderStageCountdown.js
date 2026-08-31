// SPDX-License-Identifier: GPL-3.0-only
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { renderStageCountdownDigits } from "./renderStageCountdownDigits.js";
import { ACTIVE_ENEMY_COUNT, STAGE_COUNTDOWN, PLAY_STATE_INDEX, SPAWN_PHASE_COUNTER } from "./names.js";
/**
 * despawnActorAndRenderStageCountdown — shared enemy-despawn tail. Blanks the actor's sprite band at IX, drops the active
 * enemy count, and (while it is still above zero) drops the stage countdown by one. When the play
 * sub-state is the fourth phase it also bumps the spawn-phase counter. Finally it repaints the
 * stage countdown as its two HUD digits.
 *
 * LIVE-OUT: none — a jumped-into tail that ends by rendering; the whole result is in memory
 * (the counters and the two HUD tiles).
 */
const PLAY_STATE_FOURTH = 0x04; // sub-state that also advances the spawn-phase counter

export function despawnActorAndRenderStageCountdown(m, base = m.regs.ix) {
  const { mem8 } = m;

  blankActorSpriteBand(m, base); // blank the actor sprite band
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;
  if (mem8[STAGE_COUNTDOWN] !== 0) mem8[STAGE_COUNTDOWN] = mem8[STAGE_COUNTDOWN] - 1;
  if (mem8[PLAY_STATE_INDEX] === PLAY_STATE_FOURTH) {
    mem8[SPAWN_PHASE_COUNTER] = mem8[SPAWN_PHASE_COUNTER] + 1;
  }

  renderStageCountdownDigits(m);
}

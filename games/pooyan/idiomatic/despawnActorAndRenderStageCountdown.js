// SPDX-License-Identifier: GPL-3.0-only
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { renderStageCountdownDigits } from "./renderStageCountdownDigits.js";
import { ACTIVE_ENEMY_COUNT, STAGE_COUNTDOWN, PLAY_STATE_INDEX, SPAWN_PHASE_COUNTER } from "./names.js";
/**
 * despawnActorAndRenderStageCountdown — the shared "an enemy just left the field" tail.
 *
 * WHAT IT IS
 *   ROM 0x34b0-0x34f1. Grounding: [seen].
 *
 *   Every moving thing on screen — an enemy, an object, the eagle — lives as a fixed-stride
 *   "actor record" in work RAM, and its leading run of bytes is the SPRITE BAND that describes how
 *   it is drawn this frame. When a moving actor reaches the point where it leaves play (it has
 *   arrived at its turn/exit column, or its object handler has decided to retire it), the object
 *   movement handlers all converge here to tear the actor down and update the stage bookkeeping.
 *
 * ROLE IN THE MACHINE
 *   This is the single "despawn one actor and refresh the stage readout" tail. Three object
 *   X-movement handlers reach it: advanceActorColumnAndArmTurnOrBand (ROM 0x343e) and
 *   advanceObjectColumnByStepAndDispatch (ROM 0x34f2) drop in when a column-marching actor hits its
 *   turn-column limit, and armInteriorBandOrMarkActorActive (ROM 0x3473) falls straight through into
 *   it. In one pass it (1) erases the actor's sprite, (2) drops the count of live enemies, (3)
 *   advances the per-stage countdown that measures progress through the stage, (4) in one specific
 *   play sub-state also steps the spawn-phase counter, and (5) repaints the countdown number on the
 *   HUD so the on-screen figure tracks the live value the instant the actor disappears.
 *
 * LIVE-OUT: none — this is an entry that ends by painting the HUD; the whole result is left in
 * memory: the decremented enemy count (ACTIVE_ENEMY_COUNT 0x8d40), the decremented stage countdown
 * (STAGE_COUNTDOWN 0x8901), the possibly-bumped spawn-phase counter (SPAWN_PHASE_COUNTER 0x8902),
 * the blanked sprite band at the actor record, and the two repainted countdown HUD tiles.
 */
// The single play sub-state (PLAY_STATE_INDEX 0x880a == 0x04) in which a despawn also advances the
// spawn-phase counter — the ROM tests the sub-state for exactly this value before the bump below.
const PLAY_STATE_FOURTH = 0x04; // sub-state that also advances the spawn-phase counter

// `base` is the actor-record pointer the caller is retiring, defaulting to the index register (IX)
// that the object movement dispatch keeps aimed at the record currently being updated.
export function despawnActorAndRenderStageCountdown(m, base = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — erase the sprite (ROM 0x34b0, into 0x3553). Zero the actor's whole sprite band at the
  // record base, which makes the sprite vanish on the next frame: a hardware sprite parked at
  // coordinate zero with a blank shape draws nothing. This is the "make this actor disappear"
  // primitive shared by every actor-exit path.
  blankActorSpriteBand(m, base); // blank the actor sprite band
  // Step 2 — drop the live-enemy tally (ROM 0x34b6-0x34b7, `dec (0x8d40)`). ACTIVE_ENEMY_COUNT is
  // incremented on each spawn and decremented on each despawn; it is checked against the per-stage
  // enemy budget to pace spawning, so removing this actor must lower it by one.
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;
  // Step 3 — advance the per-stage countdown (ROM 0x34ba-0x34c0: read 0x8901, `jr z` past the dec
  // when it is already zero, else `dec (0x8901)`). STAGE_COUNTDOWN starts near 0x20 at the top of a
  // stage and ticks toward zero as enemies are cleared; near zero it gates actor AI. It saturates at
  // zero rather than wrapping, so the decrement is guarded by the nonzero test.
  if (mem8[STAGE_COUNTDOWN] !== 0) mem8[STAGE_COUNTDOWN] = mem8[STAGE_COUNTDOWN] - 1;
  // Step 4 — in the fourth play sub-state only, step the spawn-phase counter (ROM 0x34c3-0x34c9:
  // `ld a,(0x880a); cp 0x04; jr nz` skips, else `inc (0x8902)`). PLAY_STATE_INDEX (0x880a) is the
  // in-play sub-state index; when it is exactly the fourth phase this despawn also advances
  // SPAWN_PHASE_COUNTER (0x8902), the per-round step counter that cycles to seven selecting the
  // spawn/fire mode branch for the wave. In any other sub-state the counter is left alone.
  if (mem8[PLAY_STATE_INDEX] === PLAY_STATE_FOURTH) {
    mem8[SPAWN_PHASE_COUNTER] = mem8[SPAWN_PHASE_COUNTER] + 1;
  }

  // Step 5 — repaint the readout (ROM falls through into 0x34c9). Redraw the stage countdown as its
  // up-to-two decimal digits in the top-of-screen status area (units tile 0x8743, tens one tilemap
  // row over at 0x8763) so the number on screen matches the value this routine just changed.
  renderStageCountdownDigits(m);
}

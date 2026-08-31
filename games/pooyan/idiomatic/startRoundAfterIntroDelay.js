// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  SUBPHASE_TICK,
  FORMATION_SLOT_TABLE,
  PLAY_MODE_LATCH,
  ROUND_IN_PROGRESS,
  GAME_ACTIVE_FLAG,
  ROUND_COUNTER,
  PLAY_STATE_INDEX,
  WAVE_ARRIVAL_COUNTER,
  LEAD_ACTOR_FRAME_DELAY,
  TWOTILE_ANIM_HOLD,
  ROPE_DRAW_STEP_TIMER,
} from "./names.js";
import { paintDisplayListRunToVram } from "./paintDisplayListRunToVram.js";
import { paintRoundNumberHud } from "./paintRoundNumberHud.js";
import { spawnEnemyFormation } from "./spawnEnemyFormation.js";
import { paintPhaseGauge } from "./paintPhaseGauge.js";
import { paintSpawnPhaseMarkerColumn } from "./paintSpawnPhaseMarkerColumn.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * startRoundAfterIntroDelay — in-play sub-state index 2: hold on the freshly built playfield
 * for a short beat, then commit to the round proper.
 *
 * WHAT IT IS
 *   One state in the in-play sub-state machine. During live play the machine keys every frame
 *   on PLAY_STATE_INDEX (0x880a) masked to five bits, which selects one of nineteen handlers
 *   that walk a round from init → wave spawn → active play → gauge drain → teardown →
 *   high-score entry. This is the handler for index 2. The prior state (index 1) has just
 *   chosen the playfield's display list; this state keeps that image painting, waits out a
 *   short intro pause, and then starts the round.
 *
 * ROLE IN THE MACHINE
 *   A handler moves the round forward by writing the NEXT sub-state index into PLAY_STATE_INDEX
 *   before it returns. Each frame this handler re-runs the display-list interpreter (so the
 *   intro image stays on screen) and advances a two-stage delay; only when both stages have
 *   elapsed does it choose a successor state and write it. Depending on the game/round flags it
 *   either hands the round on to active play (index 3) after doing the one-time level-start
 *   setup, or arms the deeper index-0x0d branch.
 *
 * ROM ADDRESS: 0x175d (occupies ROM 0x175d–0x17c0).
 * Grounding: [seen]
 *
 * LIVE-OUT (what it leaves in memory):
 *   - PLAY_STATE_INDEX (0x880a): the next sub-state — 0x03 (active play) or 0x0d.
 *   - SUBPHASE_TICK (0x88b7): the mod-0x1c frame tick, advanced (and reset on wrap).
 *   - FORMATION_SLOT_TABLE (0x8920): the once-per-two-wraps one-shot, armed or cleared.
 *   - On a fresh level only: ROUND_IN_PROGRESS (0x8904)=1, WAVE_ARRIVAL_COUNTER (0x8903)=2, the
 *     three per-level timer seeds LEAD_ACTOR_FRAME_DELAY / TWOTILE_ANIM_HOLD /
 *     ROPE_DRAW_STEP_TIMER = 0x10, plus the round-number HUD, phase gauge, odd-round marker
 *     column and sprite display list the level-start batch paints into video RAM.
 */

// TICK_WRAP: the intro-beat period. SUBPHASE_TICK (0x88b7) counts frames mod 0x1c; the handler
// does nothing further until the tick reaches this value, giving each stage of the pause its length.
const TICK_WRAP = 0x1c;
// ARM_SUBSTATE / PLAY_SUBSTATE: the two possible successor sub-states this handler writes into
// PLAY_STATE_INDEX (0x880a). 0x03 (PLAY_SUBSTATE) is active play (spawnEnemyWave, index 3); 0x0d
// (ARM_SUBSTATE) is the index-0x0d branch taken on the odd-round / round-0 paths.
const ARM_SUBSTATE = 0x0d;
const PLAY_SUBSTATE = 0x03;
// SEED: the 0x10 reload value written into the three per-level countdowns at level start —
// LEAD_ACTOR_FRAME_DELAY (0x8a91), TWOTILE_ANIM_HOLD (0x8f06) and ROPE_DRAW_STEP_TIMER (0x8f09).
const SEED = 0x10; // frame-delay / anim-hold / rope-timer reload at level start

/**
 * The level-start batch (ROM 0x17a1–0x17b8): the one-time setup a brand-new (or resumed) round
 * needs before active play. It paints the round's HUD furniture, seeds the per-level countdowns,
 * and hands off to the spawn and sprite builders so the first frame of play is fully dressed.
 */
function levelStartBatch(m) {
  const { mem8 } = m;
  // Round-number HUD (paintRoundNumberHud, ROM 0x1ead): lay out the bonus/round number panel and
  // start its per-frame update chain.
  paintRoundNumberHud(m); // bonus/round HUD setup + per-frame update chain
  // Phase gauge (paintPhaseGauge, ROM 0x2065): draw the vertical phase-gauge column of HUD tiles.
  paintPhaseGauge(m);
  // Round marker (paintSpawnPhaseMarkerColumn, ROM 0x4a0b): snapshot the spawn-phase count and
  // paint the marker column + glyph — drawn only on odd rounds (gated on ROUND_COUNTER bit0).
  paintSpawnPhaseMarkerColumn(m); // round marker (odd rounds only)
  // Seed the three per-level countdowns to 0x10 (SEED): the lead actor's frame-delay (0x8a91),
  // the two-tile animation hold (0x8f06) and the rope draw-step timer (0x8f09). Each ticks down
  // per frame during the round and reloads on expiry.
  mem8[LEAD_ACTOR_FRAME_DELAY] = SEED;
  mem8[TWOTILE_ANIM_HOLD] = SEED;
  mem8[ROPE_DRAW_STEP_TIMER] = SEED;
  // Enemy formation (spawnEnemyFormation, ROM 0x540d): run the enemy-spawn driver for the round.
  spawnEnemyFormation(m); // enemy-spawn driver
  // Sprites (rebuildSpriteDisplayList, ROM 0x02ef): rebuild the sprite display list so the new
  // round's objects appear on the first frame.
  rebuildSpriteDisplayList(m); // sprite display-list rebuild
}

/**
 * Mark a brand-new round as under way (ROM 0x1798). Raises the round-in-progress flag that the
 * render and state decision trees key on, and seats the per-stage wave-arrival counter to its
 * starting value. Only the paths that begin a fresh level call this — a round already in progress
 * skips it so the flag and counter are not re-armed mid-round.
 */
function markInProgress(mem8) {
  // ROUND_IN_PROGRESS (0x8904) = 1: a round is live; handlers gate render/state choices on this.
  mem8[ROUND_IN_PROGRESS] = 1;
  // WAVE_ARRIVAL_COUNTER (0x8903) = 2: seed the per-stage enemy-arrival/wave counter for the round.
  mem8[WAVE_ARRIVAL_COUNTER] = 2;
}

export function startRoundAfterIntroDelay(m) {
  const { mem8 } = m;

  // Keep the intro image alive. The display-list interpreter (paintDisplayListRunToVram, ROM
  // 0x4381) copies/skips the chosen playfield stream into video RAM every frame, so the built
  // playfield stays painted for the whole pause. This runs unconditionally, before the delays.
  paintDisplayListRunToVram(m);

  // Delay stage 1 — the intro beat. SUBPHASE_TICK (0x88b7) is a mod-0x1c frame tick: bump it and,
  // until it reaches TICK_WRAP (0x1c), return without doing anything else. Roughly 0x1c frames per
  // beat pass this way. On the frame it hits 0x1c, reset it to 0 and fall through to stage 2.
  mem8[SUBPHASE_TICK] = u8(mem8[SUBPHASE_TICK] + 1);
  if (mem8[SUBPHASE_TICK] !== TICK_WRAP) return; // not at the wrap yet
  mem8[SUBPHASE_TICK] = 0;

  // Delay stage 2 — a two-hit one-shot on FORMATION_SLOT_TABLE (0x8920). The PRE-increment value
  // decides: on the first stage-1 wrap it is 0, so bump it (to 1) and return — that arms it. On the
  // second stage-1 wrap it is nonzero, so clear it back to 0 and proceed. Net effect: the round
  // only actually starts on the SECOND intro beat, giving the pause its full ~2×0x1c-frame length.
  const armed = mem8[FORMATION_SLOT_TABLE]; // pre-increment value gates the one-shot
  mem8[FORMATION_SLOT_TABLE] = u8(armed + 1);
  if (armed === 0) return; // first wrap arms it
  mem8[FORMATION_SLOT_TABLE] = 0; // second wrap clears it and proceeds

  // The pause is over — choose the successor sub-state. The branches are tried in order and the
  // first match wins; each writes PLAY_STATE_INDEX (0x880a) and returns.

  // Alternate play mode already latched. PLAY_MODE_LATCH (0x8f50) nonzero means an alternate update
  // path is in force (e.g. a resumed / bonus-driven round); skip the fresh level-start setup and go
  // straight to active play (index 3).
  if (mem8[PLAY_MODE_LATCH] !== 0) { mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return; }

  // Round already in progress. ROUND_IN_PROGRESS (0x8904) nonzero means this level was already
  // marked live, so run the level-start batch (repaint HUD/gauge/marker, seed timers, spawn) but do
  // NOT re-mark it, then enter active play (index 3).
  if (mem8[ROUND_IN_PROGRESS] !== 0) {
    levelStartBatch(m); mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return;
  }

  // No game currently active — first entry into a level. GAME_ACTIVE_FLAG (0x8806) is 0 outside a
  // live game, so mark the round in progress, run the level-start batch, and enter active play.
  if (mem8[GAME_ACTIVE_FLAG] === 0) {
    markInProgress(mem8); levelStartBatch(m); mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return;
  }

  // Odd round. ROUND_COUNTER (0x8907) bit0 set selects the stage-type/facing variant that takes the
  // index-0x0d branch instead of the standard level-start; arm sub-state 0x0d and return.
  if (mem8[ROUND_COUNTER] & 0x01) { mem8[PLAY_STATE_INDEX] = ARM_SUBSTATE; return; }

  // Nonzero even round. A normal even-numbered round: mark it in progress, run the level-start
  // batch, and enter active play (index 3).
  if (mem8[ROUND_COUNTER] !== 0) {
    markInProgress(mem8); levelStartBatch(m); mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return;
  }

  // Round 0 (even). The remaining case — round counter zero — takes the index-0x0d branch as well.
  mem8[PLAY_STATE_INDEX] = ARM_SUBSTATE; // round 0, even -> arm sub-state
}

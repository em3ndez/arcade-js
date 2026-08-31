// SPDX-License-Identifier: GPL-3.0-only
import { spawnNextEnemyOnDelay } from "./spawnNextEnemyOnDelay.js";
import { advanceAllEnemyActorStates } from "./advanceAllEnemyActorStates.js";
import { blitStackedTwoTileAnimFrameOnHoldTimer } from "./blitStackedTwoTileAnimFrameOnHoldTimer.js";
import { blinkTilePairOnCountdown } from "./blinkTilePairOnCountdown.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * updateGameplayFrame — the per-frame gameplay driver (dispatch state 2).
 *
 * WHAT IT IS
 * ROM 0x755d-0x756c. This is the active-play body of one frame of work: once the machine has
 * settled into live play, this routine is what advances the whole visible world forward by a
 * single frame. It is the state-2 handler of the self-test / attract dispatcher
 * dispatchSelfTestState (ROM 0x7442), which reads the selector SELFTEST_DISPATCH_STATE (0x8921),
 * masks it to its low two bits, and vectors: 0 = signature / ROM check, 1 = HUD checksum then
 * advance, 2 = here, the gameplay frame. State 1 is what promotes the selector to 2, so once play
 * begins control lands on this routine and returns here every frame for the run of play.
 *
 * ROLE IN THE MACHINE
 * A pure sequencer — it holds no gameplay logic of its own. It calls five sub-drivers in a fixed
 * order, each owning one slice of the frame: release a queued enemy, step every actor forward,
 * repaint the stacked two-tile enemy animation, service the blink timer, and finally rebuild the
 * hardware sprite list from the work-RAM records the first four steps just touched. The order is
 * load-bearing: the spawner and the movers/animators run first so that the display-list rebuild
 * at the tail publishes the exact positions and animation frames they leave behind — run it any
 * earlier and the sprites drawn this frame would lag the world by one frame.
 *
 * Grounding: [seen]
 * LIVE-OUT: none — a void driver. It returns nothing; every effect is a side effect the five
 * callees leave in work RAM (the actor tables and the 0x8840 sprite display list) and, through
 * the final rebuild, in the sprite hardware banks.
 */

export function updateGameplayFrame(m) {
  // STEP 1 — release a queued enemy. spawnNextEnemyOnDelay (ROM 0x756d) is the delay-gated
  // spawner: while the shared frame-delay timer SHARED_FRAME_DELAY_TIMER (0x8929) is still
  // running it merely ticks it down; on expiry it walks the paired ENEMY_ACTOR_TABLE (0x8ae0) /
  // SPRITE_OBJECT_TABLE (0x8b70) records, launches exactly one waiting enemy into the play area,
  // and reseeds the delay — so a wave feeds in one member per elapsed delay. It runs FIRST so an
  // enemy that joins this frame already exists in the actor tables when the movers and the
  // display rebuild below sweep them.
  spawnNextEnemyOnDelay(m); // enemy spawner
  // STEP 2 — advance every actor one tick. advanceAllEnemyActorStates (ROM 0x7621) is an entry
  // into the shared per-frame animation / movement walk over the actor records (stride 0x18 in
  // the 0x8a80 arena): each live enemy and moving object (the arrow / hanging objects included)
  // is stepped forward one frame of motion and animation. This is where positions actually
  // change, so it runs after the spawn and before anything paints.
  advanceAllEnemyActorStates(m); // arrow / object mover
  // STEP 3 — repaint the stacked two-tile enemy animation. blitStackedTwoTileAnimFrameOnHoldTimer
  // (ROM 0x6b13) is frame-gated on its own hold timer: only when that hold expires does it reload
  // the timer, advance the animation phase, and stamp a phase-selected 2x2 tile block into video
  // RAM at two screen positions. This paces the enemy's animated body on its own cadence,
  // independent of how far the actor moved this frame.
  blitStackedTwoTileAnimFrameOnHoldTimer(m); // enemy two-tile blitter
  // STEP 4 — service the blink timer. blinkTilePairOnCountdown (ROM 0x76af) counts down a blink
  // timer and, on expiry, toggles a two-state phase and swaps a pair of video tiles — the
  // on/off flicker of a blinking on-screen element. Cheap standalone effect, driven purely by its
  // countdown reaching zero.
  blinkTilePairOnCountdown(m); // blink-timer tile swap
  // STEP 5 — publish the frame. rebuildSpriteDisplayList (ROM 0x02ef) rebuilds the work-RAM sprite
  // display list at SPRITE_DISPLAY_LIST (0x8840) from the actor records the steps above just
  // updated: four record groups, an arrow Y-tick, and a flip-mirror tail that mirrors the list for
  // a flipped screen. That staged list is what reaches the sprite hardware banks, so this runs
  // LAST — it must see every position and animation frame the movers and animators produced.
  rebuildSpriteDisplayList(m); // rebuild the sprite display list
}

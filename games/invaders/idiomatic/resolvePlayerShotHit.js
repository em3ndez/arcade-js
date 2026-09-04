// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { clearShotHitAndSilence } from "./clearShotHitAndSilence.js";
import { markSaucerHitAndRetireShot } from "./markSaucerHitAndRetireShot.js";
import { scaleXToBlock } from "./scaleXToBlock.js";
import { scaleYToBlock } from "./scaleYToBlock.js";
import { alienGridCellPtr } from "./alienGridCellPtr.js";
import { queueInvaderKillScore } from "./queueInvaderKillScore.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";
import { PLAYER_SHOT_STATUS, PLAYER_SHOT_HIT, loc_2009, loc_2029, loc_202a, ALIEN_EXPLOSION_ADDR, ALIEN_EXPLOSION_TIMER } from "./names.js";

/**
 * resolvePlayerShotHit — resolve what a live player shot struck (the state-2 collision handler).
 *
 * WHAT IT IS
 *   Runs only while the player shot is in flight (PLAYER_SHOT_STATUS == 2) and something was hit. It
 *   figures out WHAT the shot collided with and reacts: a miss off the top of the screen stands the
 *   shot down; a hit in the flying-saucer altitude band scores the saucer; otherwise it maps the shot
 *   onto the 55-cell alien rack, and if it lands on a live alien it kills that alien — clearing the
 *   grid cell, queuing its points and the invader-die sound, and starting the explosion.
 *
 * ROLE IN THE MACHINE
 *   The player-shot collision teardown (Space Invaders has no prize/bonus object — this is the shot
 *   resolver). A hit is latched in PLAYER_SHOT_HIT (0x2002), which playerShotHandler copies straight
 *   from COLLISION_FLAG (0x2061) after drawing the shot with collision detection. The shot's Y sits in
 *   the shared object-coordinate scratch loc_2029, its companion coordinate in loc_202a; loc_2009 is the fleet's
 *   reference-X anchor used both as a rack bounds guard and (via scaleXToBlock) as the grid origin.
 *   "Stand down" means state 3 + clearShotHitAndSilence (clear the hit latch, silence the invader-die
 *   tone). A kill enters state 5 (explosion), draws the burst, and arms the despawn timer that
 *   tickAlienExplosionDespawn later counts down. loc_2029/loc_202a keep loc_ names because the
 *   pixel-axis convention is not confidently read from the code.
 *
 * ROM 0x14d8-0x1537.  Grounding: [seen].
 * LIVE-OUT: RAM state machine — PLAYER_SHOT_STATUS (3, 4 via retire, or 5), the alien grid cell,
 * ALIEN_EXPLOSION_ADDR / ALIEN_EXPLOSION_TIMER, and the sound shadow; no meaningful register live-out.
 */
export function resolvePlayerShotHit(m) {
  // Shared bail arm (ROM loc_1530): force the shot into state 3 and silence/clear its hit — used
  // whenever the shot missed or landed on a dead cell.
  const standDown = () => {
    m.mem8[PLAYER_SHOT_STATUS] = 0x03;
    return clearShotHitAndSilence(m);
  };

  // Gate on the shot state. State 5 (already exploding) and any state other than 2 (in flight) return
  // untouched — this handler only resolves a collision for a shot that is currently airborne.
  const state = m.mem8[PLAYER_SHOT_STATUS];
  if (state === 0x05) return;
  if (state !== 0x02) return;

  // Read the shot's Y (loc_2029). Y >= 0xd8 means it has run off the top of the play area (a clean
  // miss), so stand down. Then require an actual latched collision (PLAYER_SHOT_HIT) before resolving
  // any target; with no hit there is nothing to attribute yet. Y >= 0xce but below 0xd8 is the saucer
  // altitude band, so credit the saucer and retire the shot.
  const coord = m.mem8[loc_2029];
  if (coord >= 0xd8) return standDown();
  if (m.mem8[PLAYER_SHOT_HIT] === 0) return;
  if (coord >= 0xce) return markSaucerHitAndRetireShot(m);

  // Below the saucer band the shot is in the alien rack. Bias the Y by +6 to the rack coordinate (key)
  // and bounds-check it against the fleet's reference-X base loc_2009: when that base is in range
  // (< 0x90) and sits at or beyond the shot's key, the shot is outside the live rack, so stand down.
  const key = u8(coord + 0x06);
  const gate = m.mem8[loc_2009];
  if (gate < 0x90 && gate >= key) return standDown();

  // Scale the two coordinates onto the coarse fleet grid: scaleXToBlock turns the key into a block
  // index (xBlock) plus a residual, scaleYToBlock yields the Y residual from loc_202a. Stash the
  // packed residual (Y hi : X lo) at ALIEN_EXPLOSION_ADDR so the despawn can replace the burst later,
  // and commit the shot to state 5 (exploding).
  const [, residualX, xBlock] = scaleXToBlock(m, key);
  const [, residualY] = scaleYToBlock(m, m.mem8[loc_202a]);
  m.mem16[ALIEN_EXPLOSION_ADDR] = (residualY << 8) | residualX;
  m.mem8[PLAYER_SHOT_STATUS] = 0x05;

  // Turn the block index into the alien's liveness cell in the active player's grid. If that cell is
  // already dead the shot hit empty space, so stand down; otherwise clear the cell (the alien dies).
  const recPtr = alienGridCellPtr(m, xBlock);
  if (m.mem8[recPtr] === 0) return standDown();
  m.mem8[recPtr] = 0x00;

  // Score the kill: queueInvaderKillScore fires the invader-die tone and queues the row's points,
  // returning the explosion sprite descriptor; loadSpriteDescriptor decodes it, blitShiftedSprite draws
  // the burst, and ALIEN_EXPLOSION_TIMER = 0x10 arms the countdown that later wipes it and retires the shot.
  loadSpriteDescriptor(m, queueInvaderKillScore(m, xBlock));
  blitShiftedSprite(m);
  m.mem8[ALIEN_EXPLOSION_TIMER] = 0x10;
}

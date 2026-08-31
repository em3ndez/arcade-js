// SPDX-License-Identifier: GPL-3.0-only
import { launchProjectileIntoFreeSlot } from "./launchProjectileIntoFreeSlot.js";
import { u8 } from "../../../core/int.js";
import {
  WAVE_PROGRESS_COUNTER,
  ROUND_COUNTER,
  GAUGE_PHASE_COUNTER,
  DIFFICULTY_DSW,
  LANE_SPAWN_COUNTDOWN,
  PLAYER_X_COORD,
  FLIP_SCREEN_FLAG,
} from "./names.js";

/**
 * fireEnemyShotWhenAlignedWithPlayer
 * ==================================
 *
 * WHAT IT IS
 *   One branch of the enemy actor state handler: the per-frame decision of whether a hunting enemy
 *   (the record pointed at by `rec`) is allowed to drop a projectile this frame, and if so whether it
 *   is lined up with the player's column to actually fire. It is the "does this enemy shoot now?"
 *   valve.
 *
 * ROLE IN THE MACHINE
 *   Enemies do not fire freely; the game meters aggression by how deep play has advanced. This routine
 *   is reached once an enemy has climbed into its firing altitude band, and it makes two decisions in
 *   sequence:
 *     1. A difficulty/progress GATE (this entry + l_39fb) that decides, from the level counters and
 *        the difficulty DIP, whether firing is even considered this frame. Deeper into the wave / a
 *        higher round / a nearly-drained phase gauge / the hardest DIP all push toward "yes".
 *     2. A shared firing TAIL (l_3a08) that applies the global fire suppressor and the per-actor gates,
 *        ticks a per-actor cooldown, then derives the tile column the player occupies and fires a shot
 *        only when the enemy already sits in that column. That is the "aligned with player" test.
 *
 * ROM ADDRESS
 *   0x39e0 (this entry). Internal convergence points: l_39fb at 0x39fb, l_3a08 at 0x3a08.
 *
 * ACTOR RECORD (`rec`) FIELDS READ HERE
 *   Each enemy actor is a stride-0x18 record in the actor array (ACTOR_TABLE, 0x8a80). This routine
 *   touches four of its bytes:
 *     rec+0x04  the actor's current tile column / high position byte -- the value the derived target
 *               column is compared against for the alignment test.
 *     rec+0x06  a per-actor magnitude field; under the mid gate a value >= 0x10 blocks firing.
 *     rec+0x08  the actor's status/mode byte; its high nibble (& 0xf0) must be nonzero for the actor
 *               to be in a fire-eligible state.
 *     rec+0x15  the per-actor fire cooldown countdown; nonzero means the enemy is still recovering
 *               from its last shot and only gets decremented this frame.
 *
 * GROUNDING: [seen] (role confirmed by observed RAM behaviour).
 *
 * LIVE-OUT: none in registers. The routine either returns having at most decremented the per-actor
 *   cooldown (rec+0x15), or, on a column match, hands control to launchProjectileIntoFreeSlot, which
 *   writes a new projectile record into the object table (PROJECTILE_TABLE, 0x8be8). All observable
 *   effect is in memory.
 */
export function fireEnemyShotWhenAlignedWithPlayer(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // The difficulty/progress gate. WAVE_PROGRESS_COUNTER (0x8d7d) counts how many enemies have arrived
  // in the current wave, so it is a proxy for how far into the wave the player has survived.
  //
  //   >= 0x0e  : deep into the wave -- skip every softening test and go straight to the firing tail.
  //   round    : a high ROUND_COUNTER (0x8907), i.e. a later level, routes through the mid gate l_39fb.
  //   gauge    : a nearly-drained phase gauge GAUGE_PHASE_COUNTER (0x8908) < 3 also routes through the
  //              mid gate (late in a phase, pressure is applied).
  //   >= 0x08  : otherwise, a late-ish wave still fires via the tail.
  //   else     : early and easy -- fall through to the mid gate, which will usually decide on the DIP.
  const wave = mem8[WAVE_PROGRESS_COUNTER];
  if (wave >= 0x0e) return l_3a08(m, rec);
  if (mem8[ROUND_COUNTER] >= 0x06) return l_39fb(m, rec);
  if (mem8[GAUGE_PHASE_COUNTER] < 0x03) return l_39fb(m, rec);
  if (wave >= 0x08) return l_3a08(m, rec);
  return l_39fb(m, rec);
}

// l_39fb (ROM 0x39fb) -- the mid difficulty gate, shared by several arms of the entry above.
// It gives the hardest difficulty setting an unconditional fire, otherwise vetoes firing for actors
// carrying a large per-actor magnitude field.
function l_39fb(m, rec) {
  const { mem8 } = m;
  // DIFFICULTY_DSW (0x8820) is the 3-bit difficulty from the DIP switches; value 0x07 is the hardest
  // setting, which forces the firing tail regardless of the actor's own state.
  if (mem8[DIFFICULTY_DSW] === 0x07) return l_3a08(m, rec);
  // Otherwise, an actor whose +6 magnitude field has reached 0x10 is suppressed -- no shot this frame.
  if (mem8[rec + 0x06] >= 0x10) return;
  // Below that threshold, proceed to the firing tail.
  return l_3a08(m, rec);
}

// l_3a08 (ROM 0x3a08) -- the shared firing tail. All arms of the gate converge here. It applies the
// global fire suppressor and the per-actor eligibility gates, spends the per-actor cooldown, and then
// computes the tile column the player stands in and fires only when this enemy already occupies it.
function l_3a08(m, rec) {
  const { mem8 } = m;

  // Global fire suppressor: LANE_SPAWN_COUNTDOWN (0x8d75) is nonzero while a lane-spawn sequence is
  // running. During that window enemy fire is held off entirely, so bail out.
  if (mem8[LANE_SPAWN_COUNTDOWN] !== 0) return; // global lane-spawn gate
  // Per-actor eligibility: the high nibble of the actor's status/mode byte (rec+0x08) must be set for
  // the actor to be in a firing state; if it is clear, this actor cannot shoot now.
  if ((mem8[rec + 0x08] & 0xf0) === 0) return; // actor gate
  // Per-actor cooldown: rec+0x15 counts down the recovery between shots. While it is nonzero the
  // enemy is still cooling down -- spend one tick and take no further action this frame.
  const cooldown = mem8[rec + 0x15];
  if (cooldown !== 0) {
    mem8[rec + 0x15] = u8(cooldown - 1); // still cooling down
    return;
  }

  // Cooldown is ready: derive the tile column the player currently occupies, to test alignment.
  // PLAYER_X_COORD (0x8842) is the launcher/player position; FLIP_SCREEN_FLAG (0x881f) is 1 when the
  // cabinet is upright and 0 when the screen is flipped (mirrored). On a flipped screen the position
  // must be mirrored across the axis before it can be turned into a column.
  const flip = mem8[FLIP_SCREEN_FLAG];
  let col = mem8[PLAYER_X_COORD];
  if (flip === 0) col = u8(-col); // mirror the launcher X when the screen is flipped
  // Rotate the 8-bit position right three times: a tile column is 8 pixels wide, so >>3 converts the
  // pixel position into a column index (the low 3 pixel bits wrap into the top and are discarded next).
  col = ((col >> 3) | (col << 5)) & 0xff; // rrca x3
  col &= 0x1f; // -> column 0..31
  // On a flipped screen, nudge the mirrored column back by two to re-register it with the playfield.
  if (flip === 0) col = u8(col - 2);

  // Apply the round-parity offset: the low bit of ROUND_COUNTER (0x8907) alternates the aim point by
  // four columns between successive rounds, so the enemy leads or trails the player differently.
  let target = col;
  if (mem8[ROUND_COUNTER] & 1) target = u8(target + 4); // odd-frame parity offset
  // Alignment test: if the derived target column equals this enemy's own column (rec+0x04), the enemy
  // is lined up with the player and fires -- hand control to the shot spawner, which allocates a free
  // projectile slot and seeds it from this launcher record. Otherwise the frame ends with no shot.
  if (target === mem8[rec + 0x04]) return launchProjectileIntoFreeSlot(m, rec); // tail-jump: spawn a shot
}

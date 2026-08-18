// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchSpriteObjectArmsA  —  ROM 0x29b9  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   "Dispatcher A" for one sprite object. Frogger's moving hazards and rideable creatures are each a
 *   16-byte record in work RAM (the IX base) that the machine advances one step per frame and stages
 *   into a hardware sprite slot (the IY base). This routine advances ONE such object by running its
 *   five per-object arms, in a fixed ROM order, against that one record/slot pair. It is a plain
 *   dispatcher: it holds no logic of its own, only the running order.
 *
 *   Dispatcher A drives the free-drifting, two-tile creatures that sweep a lane and bounce between the
 *   band edges recorded in the object's +0/+1 bytes. (Its structural twin, dispatcher B /
 *   updateSpriteObject (0x2b83), drives the single-tile object that steers toward a fixed lane target
 *   and can be ridden by the frog — same five-arm shape, different behaviour.)
 *
 * WHERE IT SITS
 *   Called by driveSpriteObjectCluster (0x2970) once the life/level counter LIVES_COUNT (0x83b7) has
 *   reached 3. The cluster runs this dispatcher on the active player's record SPRITE_OBJECT_RECORD_A
 *   (0x8440/0x8460) / slot SPRITE_OBJECT_SLOT_A (0x8048), then makes a SECOND dispatcher-A pass — on a
 *   fresh object (record +0x10, slot SPRITE_OBJECT_SLOT_A_SECOND 0x8050) once the count reaches 6, or
 *   re-running the same record/slot below 6. So this routine is invoked once or twice per frame, and
 *   the record/slot it acts on is chosen entirely by its caller and handed in via IX/IY.
 *
 * PARAMETERS
 *   ix — the object's 16-byte record base (defaults to the Z80 IX register).
 *   iy — the object's hardware sprite-slot base (defaults to the Z80 IY register).
 *   The arms read the record's uniform field layout (+6 active/state byte, +8/+9/+0x0a timers, +0..+5
 *   position/band/direction bytes) and stage the results into the sprite slot; every arm early-returns
 *   on an idle object (+6 == 0), so a dead slot costs almost nothing.
 *
 * LIVE-OUT
 *   Memory only. Each arm writes RAM (the record's own bytes, the sprite slot, and — on a frog hit —
 *   the shared flags HOLD_FLAG 0x8004 and the motion gate loc_842c 0x842c). The value returned here is
 *   whatever the final hit-test arm returns, but the caller does not read it; it is forwarded only
 *   because the ROM ends the routine by falling through the last arm (a tail call).
 */
import { spawnSpriteObjectArmA } from "./spawnSpriteObjectArmA.js";
import { animateSpriteObjectFrame } from "./animateSpriteObjectFrame.js";
import { loc_29f9 } from "./loc_29f9.js";
import { placeSpriteObjectSlotAndRetire } from "./placeSpriteObjectSlotAndRetire.js";
import { flagSpriteObjectFrogHit } from "./flagSpriteObjectFrogHit.js";

export function dispatchSpriteObjectArmsA(m, ix = m.regs.ix, iy = m.regs.iy) {
  // Arm 1 — SPAWN (spawnSpriteObjectArmA, 0x2a6a). Timer- and level-gated: counts the record's +0x0a
  // spawn/respawn timer down each frame and, only on expiry with the object idle, rolls the spawn PRNG
  // against the rising density threshold (8*count + 0x80) and walks the placement bands to reveal the
  // object on-screen or park it off-screen, seeding its sprite code and frame/move timers. Running spawn
  // FIRST means a freshly armed object is animated, moved, staged, and hit-tested in the same frame.
  spawnSpriteObjectArmA(m, ix, iy);

  // Arm 2 — ANIMATE FRAME (animateSpriteObjectFrame, 0x29c9). Counts the +8 frame timer down; on expiry
  // it reloads it (12) and, while the phase byte +6 is non-zero, steps the phase (1 wraps back to 4),
  // indexes the phase-tile table SPRITE_OBJECT_PHASE_TILE_TABLE (0x2cd5), folds in the +5 flip bits, and
  // stages the tile/attr pair into the two-entry sprite slot (slot+1 = tile, slot+5 = tile+1). This
  // decides WHICH frame the creature shows before the later arms decide where it sits.
  animateSpriteObjectFrame(m, ix, iy);

  // Arm 3 — MOTION (loc_29f9, 0x29f9 — the dispatcher-A motion arm; role understood, name is still a
  // loc_ placeholder). Runs only while the object is active (+6 != 0) AND the global hit gate loc_842c
  // (0x842c) is clear, so a frog hit freezes all dispatcher-A motion. It counts the +9 move timer down
  // (reload 8), sets the "has-moved / eligible-to-retire" flag +7 = 1, then either steps +3 vertically
  // by +/-2 (for an object on a low sprite row) or drifts +2 toward FREE_RUNNING_POS_COUNTER (0x8014)
  // along the +0/+1 band edges, flipping direction/flip bit +5 at each band edge.
  loc_29f9(m, ix, iy);

  // Arm 4 — PLACE SLOT & RETIRE (placeSpriteObjectSlotAndRetire, 0x2af3). Turns the record's internal
  // position into an actual on-screen sprite: computes the X (a parked object with +4 >= 0x60 uses its
  // fixed +3, a moving object uses FREE_RUNNING_POS_COUNTER (0x8014) - +2), writes it to slot+0, mirrors
  // the row byte to both entries' Y and stashes a +/-15-biased fold X in slot+4. On the fold-wrap with
  // the retire flag +7 set it recycles the object — zeroing the 16-byte record and 8-byte slot and
  // reseeding the spawn timer +0x0a to 0x20. Writing the slot IS drawing the object (the machine mirrors
  // the slot to sprite hardware each frame), so staging happens only AFTER motion has updated position.
  placeSpriteObjectSlotAndRetire(m, ix, iy);

  // Arm 5 — HIT TEST (flagSpriteObjectFrogHit, 0x2b58). The leaf arm, run LAST so it tests the object at
  // its just-staged position. Active only when +6 != 0 and the object's row (+4 plus a 2-row bias)
  // equals the frog row FROG_Y (0x8047); it takes the staged slot X (biased +16 when the +5 direction
  // bit is set) and, if that lands within a 16px window of the frog X FROG_X (0x8044), raises the
  // kill/hold flag HOLD_FLAG (0x8004) and the global gate loc_842c (0x842c) — the latter is exactly what
  // Arm 3 checks, so a catch freezes dispatcher-A motion from the next frame on. Its return value is the
  // routine's (a tail call the caller ignores; see LIVE-OUT above).
  return flagSpriteObjectFrogHit(m, ix, iy);
}

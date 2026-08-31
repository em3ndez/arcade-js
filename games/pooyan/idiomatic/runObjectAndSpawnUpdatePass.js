// SPDX-License-Identifier: GPL-3.0-only
import { blitStackedTwoTileAnimFrameOnHoldTimer } from "./blitStackedTwoTileAnimFrameOnHoldTimer.js";
import { runActorGroupStateHandler } from "./runActorGroupStateHandler.js";
import { updateEnemyActorsAndCycleLaunchFlipAnim } from "./updateEnemyActorsAndCycleLaunchFlipAnim.js";
import { dispatchSpecialObjectRecordState } from "./dispatchSpecialObjectRecordState.js";
import { ENEMY_ACTOR_TABLE, HUNTER_TABLE_BASE } from "./names.js";
/**
 * runObjectAndSpawnUpdatePass — the fountain/spawn subtree driver.
 *
 * WHAT IT IS
 *   One of the two alternating per-frame object passes. The object driver
 *   (driveObjectsByFrameParityThenBuildSprites) splits work by frame parity: the odd-parity
 *   branch runs the group-update pass, and this routine is the even-parity branch. It is a short,
 *   branch-free sequence of four sub-updates that together advance the "fountain" object, the
 *   rope-riding enemies, the launch/flip sprite animation, and the lone climbing special object.
 *   It computes nothing of its own — it simply runs the four sub-drivers in order and hands each
 *   the record pointer it works on. After this routine returns, the object driver rebuilds the
 *   sprite display list for the frame.
 *
 * ROLE IN THE MACHINE
 *   This is the even-frame half of the playfield's moving-object update. The pieces it drives all
 *   live in the actor arena (the flat array of 0x18-byte records the whole game shares): the
 *   fountain is a three-record group based at HUNTER_TABLE_BASE (0x8c78); the enemy pool begins at
 *   ENEMY_ACTOR_TABLE (0x8ae0); and the climbing special object sits at a fixed offset inside that
 *   same pool. Splitting the object work across two frames (this pass and its odd-frame sibling)
 *   halves the per-frame cost while still updating everything at least every other frame.
 *
 * ROM 0x64e2. Grounding: [seen].
 *
 * LIVE-OUT: memory only. Nothing is handed back for the caller to read — every effect is written
 *   into work RAM and video RAM by the four sub-drivers (the fountain's records and shared
 *   animation cells, the enemy records, the flip countdown/toggle and its display command, and the
 *   special object's record and integrity state). The caller reloads its own pointers afterward.
 */
export function runObjectAndSpawnUpdatePass(m) {
  // Step 1 — tick the two-tile fountain flasher animation (ROM 0x6b13). A small self-timed
  // two-frame tile animator: most frames it merely counts its hold timer down, and every twelfth
  // frame it flips the picture to its other frame and restamps the 2x4 image at its fixed screen
  // anchor. Nothing here reads or produces a record pointer.
  blitStackedTwoTileAnimFrameOnHoldTimer(m);
  // Step 2 — run the fountain actor group's state handler (ROM 0x64fb). The fountain is the
  // three-record group based at HUNTER_TABLE_BASE (0x8c78); this reads the group's state byte at
  // its record's +0x02 and fans out to exactly one of three phase handlers — spawn (seat the three
  // records, seed shared timers), grow/shrink pulse, or rise + sprite-frame cycle.
  runActorGroupStateHandler(m, HUNTER_TABLE_BASE); // fountain group at 0x8c78
  // Step 3 — advance the rope-riding enemies and pace the launch/flip animation (ROM 0x66c5).
  // Starting at ENEMY_ACTOR_TABLE (0x8ae0), it steps three consecutive 0x18-byte enemy records one
  // frame each through their per-record state machines, then — only while the lead enemy record is
  // active — ticks the launch/flip cadence countdown, and on expiry toggles the flip frame and
  // queues the display command that repaints the launch sprite.
  updateEnemyActorsAndCycleLaunchFlipAnim(m, ENEMY_ACTOR_TABLE); // enemy pool base 0x8ae0
  // Step 4 — dispatch the climbing special object's state machine (ROM 0x6822). The special object
  // is the single record at 0x8b28 (ENEMY_ACTOR_TABLE + 0x48). A gate byte (0x8afa) must be nonzero
  // or this does nothing; when armed it reads the record's state at +0x02 and takes one step:
  // transition/arm, one ascent step up the playfield (folding in the HUD-strip integrity checksum
  // near the top), or the once-only playfield tile-region tamper checksum.
  return dispatchSpecialObjectRecordState(m); // special-object record at 0x8b28
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagPlayerShotHitsOnObjects — sweep the player's shot against every diving object.
 *
 * WHAT IT IS
 *   One of the two collision passes that close the loop from the player's shot back onto the
 *   field (mechanisms.md "The player's shot against the field"). This is the divers pass: it
 *   walks the seven-record object table and box-tests each object against the single armed
 *   player-shot reference, scoring and retiring any it overlaps. Its sibling pass,
 *   flagPlayerShotHitOnFormation (0x0b0b), handles the standing formation block in grid space.
 *
 * ROLE IN THE MACHINE
 *   Runs each frame in the play pipeline runGameplayFrameAndAdvanceOnFieldClear. The player's
 *   shot is a single hazard tracked by the reference cells 0x4209 (Y) / 0x420a (X) and gated by
 *   the shot-armed flag loc_4208 (0x4208) bit0: while that gate is clear no shot is in flight, so
 *   the whole sweep is skipped. OBJ_TABLE (0x42d0) is the seven-slot "primary" object table the
 *   spawn and AI code share — the objects here are the diving attackers pulled out of formation.
 *
 * ROM 0x1227.  Grounding: [seen].
 *
 * LIVE-OUT: for any overlapped object the per-object test raises shot-retire flag 0x420b=1 and
 * tail-calls awardKillScoreByBandAndDeactivate (score by band, then deactivate). No register out.
 */
import { flagPlayerShotHitOnObject } from "./flagPlayerShotHitOnObject.js";
import { loc_4208, OBJ_TABLE } from "./names.js";

const OBJECT_COUNT = 7;
const OBJECT_STRIDE = 32; // 0x20

export function flagPlayerShotHitsOnObjects(m) {
  const { mem8 } = m;

  // Gate on the shot-armed flag loc_4208 (0x4208) bit0. Clear means no player shot is in flight
  // this frame, so there is nothing to collide — bail before walking the object table at all.
  if ((mem8[loc_4208] & 1) === 0) return; // shot gate closed

  // Walk the seven records of OBJ_TABLE (0x42d0), OBJECT_STRIDE (0x20) bytes apart, handing each
  // object address to the per-object box test. flagPlayerShotHitOnObject reads the shot reference
  // (0x4209/0x420a) and, on a 6-wide x 12-tall overlap, scores and deactivates that object.
  let obj = OBJ_TABLE;
  for (let i = 0; i < OBJECT_COUNT; i++) {
    flagPlayerShotHitOnObject(m, obj);
    obj += OBJECT_STRIDE;
  }
}

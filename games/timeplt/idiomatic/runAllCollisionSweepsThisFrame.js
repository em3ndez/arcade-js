// SPDX-License-Identifier: GPL-3.0-only
/** runAllCollisionSweepsThisFrame — run one round's whole collision-and-destruction pass. First sweep the player's shots
 * against their targets, then sweep the player against a run of objects. A round-state flag then
 * picks the wider pass: when the mother-ship is armed, also run the player-vs-slots contact sweep,
 * the mother-ship's own mutual-kill box, and a three-target attacker sweep; when it is not, run the
 * player-vs-slots sweep over more slots and skip the mother-ship box. Either way finish by marking
 * every object the player is now touching. The object/slot sweeps thread ONE cursor pair (record
 * occupancy in DE's low half, entry pointer in IY), each stage continuing where the last left off.
 * That pair is now threaded through the callees' tuple RETURNS instead of through registers.
 * LIVE-OUT: memory, plus the cursors the final mark leaves. */

import { stagePlayerShotSweepAgainstTargetsAndRun } from "./stagePlayerShotSweepAgainstTargetsAndRun.js";
import { destroyPlayerAndObjectsTouchingIt } from "./destroyPlayerAndObjectsTouchingIt.js";
import { destroySlotsAndPlayerOnContact } from "./destroySlotsAndPlayerOnContact.js";
import { ramTestPlayerVsMotherShip } from "./ramTestPlayerVsMotherShip.js";
import { destroyTargetsReachedByFixedAttacker } from "./destroyTargetsReachedByFixedAttacker.js";
import { markObjectsTouchingPlayer } from "./markObjectsTouchingPlayer.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, MOTHER_SHIP_ARMED } from "./names.js";

// The mark's enter-flags carry is dead here (it only feeds an unread return flag on the player-dead
// guard-bail; this routine's live-out is memory plus the mark cursors), so pass a fixed zero.
const MARK_ENTER_FLAGS = 0;

export function runAllCollisionSweepsThisFrame(m) {
  const { mem8 } = m;
  stagePlayerShotSweepAgainstTargetsAndRun(m);

  // Player against the actor object run; the callee hands back { occupancy, entry } (DE/IY).
  const afterPlayer = destroyPlayerAndObjectsTouchingIt(m, ACTOR_RECORD_SLOT0, ACTOR_ENTRY_SLOT0, 5, 11, 4);

  if (mem8[MOTHER_SHIP_ARMED] !== 0) {
    // Armed: the contact sweep's cursor is discarded (the attacker sweep restarts at the era slots).
    destroySlotsAndPlayerOnContact(m, afterPlayer.occupancy, afterPlayer.entry, 5, 7, 15);
    ramTestPlayerVsMotherShip(m);

    const afterTargets = destroyTargetsReachedByFixedAttacker(m, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT0, 3, 6, 13);
    return markObjectsTouchingPlayer(
      m, MARK_ENTER_FLAGS, 8, 17,
      afterTargets.target & (0xff << 8), afterTargets.target & 0xff, afterTargets.entry, 1,
    );
  }

  // Unarmed: the contact sweep's cursor threads straight into the attacker sweep.
  const afterSlots = destroySlotsAndPlayerOnContact(m, afterPlayer.occupancy, afterPlayer.entry, 7, 7, 15);

  const afterTargets = destroyTargetsReachedByFixedAttacker(m, afterSlots.record, afterSlots.entry, 3, 6, 13);
  return markObjectsTouchingPlayer(
    m, MARK_ENTER_FLAGS, 8, 17,
    afterTargets.target & (0xff << 8), afterTargets.target & 0xff, afterTargets.entry, 1,
  );
}

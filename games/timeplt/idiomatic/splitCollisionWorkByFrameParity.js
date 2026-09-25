// SPDX-License-Identifier: GPL-3.0-only
/** splitCollisionWorkByFrameParity — split the per-frame collision work by frame parity: on odd frames run the shot-versus-
 * target sweeps; on even frames run the player-versus-object collision chain, adding the mother-ship
 * mutual-kill check only while the mother ship is armed. The record/entry cursor and the compare
 * flag are now threaded through the callees' tuple RETURNS instead of read back off regs.e/regs.f.
 * LIVE-OUT: memory only. */

import { dispatchShotSweepByMotherShipArmed } from "./dispatchShotSweepByMotherShipArmed.js";
import { destroyFixedTargetHitByShots } from "./destroyFixedTargetHitByShots.js";
import { destroyPlayerAndObjectsTouchingIt } from "./destroyPlayerAndObjectsTouchingIt.js";
import { destroySlotsAndPlayerOnContact } from "./destroySlotsAndPlayerOnContact.js";
import { ramTestPlayerVsMotherShip } from "./ramTestPlayerVsMotherShip.js";
import { destroyFixedTargetReachedByPlayer } from "./destroyFixedTargetReachedByPlayer.js";
import { markObjectsTouchingPlayer } from "./markObjectsTouchingPlayer.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT2, ERA_OBJECT_RECORD_SLOT2, FRAME_TICK, MOTHER_SHIP_ARMED } from "./names.js";

// The mark's enter-flags carry is dead here (it only feeds an unread return flag on the player-dead
// guard-bail; this routine's live-out is memory only), so pass a fixed zero.
const MARK_ENTER_FLAGS = 0;

export function splitCollisionWorkByFrameParity(m) {
  const { mem8 } = m;
  if (mem8[FRAME_TICK] & 0x01) return dispatchShotSweepByMotherShipArmed(m);

  destroyFixedTargetHitByShots(m);

  const afterSlot0 = destroyPlayerAndObjectsTouchingIt(m, ACTOR_RECORD_SLOT0, ACTOR_ENTRY_SLOT0, 5, 11, 4);

  // The sweep above left the record cursor (page unchanged from ACTOR_RECORD_SLOT0) and the entry
  // cursor; the slot sweep reads them one past its last, now threaded through the returned tuple.
  const armed = mem8[MOTHER_SHIP_ARMED] !== 0;
  destroySlotsAndPlayerOnContact(m, afterSlot0.occupancy, afterSlot0.entry, armed ? 5 : 7, 7, 15);
  if (armed) ramTestPlayerVsMotherShip(m);
  destroyFixedTargetReachedByPlayer(m);

  const afterSlot2 = destroyPlayerAndObjectsTouchingIt(m, ERA_OBJECT_RECORD_SLOT2, ERA_OBJECT_ENTRY_SLOT2, 5, 11, 1);

  // The tail marks objects near the player using the cursors that sweep just left (record page and
  // index from afterSlot2.occupancy, the entry cursor from afterSlot2.entry).
  return markObjectsTouchingPlayer(
    m, MARK_ENTER_FLAGS, 8, 17,
    afterSlot2.occupancy & (0xff << 8), afterSlot2.occupancy & 0xff, afterSlot2.entry, 1,
  );
}

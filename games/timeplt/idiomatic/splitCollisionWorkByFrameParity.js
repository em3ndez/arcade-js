// SPDX-License-Identifier: GPL-3.0-only
/** splitCollisionWorkByFrameParity — split the per-frame collision work by frame parity: on odd frames run the shot-versus-
 * target sweeps; on even frames run the player-versus-object collision chain, adding the mother-ship
 * mutual-kill check only while the mother ship is armed. LIVE-OUT: memory only. */

import { dispatchShotSweepByMotherShipArmed } from "./dispatchShotSweepByMotherShipArmed.js";
import { destroyFixedTargetHitByShots } from "./destroyFixedTargetHitByShots.js";
import { destroyPlayerAndObjectsTouchingIt } from "./destroyPlayerAndObjectsTouchingIt.js";
import { destroySlotsAndPlayerOnContact } from "./destroySlotsAndPlayerOnContact.js";
import { ramTestPlayerVsMotherShip } from "./ramTestPlayerVsMotherShip.js";
import { destroyFixedTargetReachedByPlayer } from "./destroyFixedTargetReachedByPlayer.js";
import { markObjectsTouchingPlayer } from "./markObjectsTouchingPlayer.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT2, ERA_OBJECT_RECORD_SLOT2, FRAME_TICK, MOTHER_SHIP_ARMED } from "./names.js";


export function splitCollisionWorkByFrameParity(m) {
  const { mem8 } = m;
  if (mem8[FRAME_TICK] & 0x01) return dispatchShotSweepByMotherShipArmed(m);

  destroyFixedTargetHitByShots(m);

  destroyPlayerAndObjectsTouchingIt(m, ACTOR_RECORD_SLOT0, ACTOR_ENTRY_SLOT0, 5, 11, 4);

  // The sweep above left the record cursor in the low byte of the record pointer (its page unchanged
  // from ACTOR_RECORD_SLOT0) and the entry cursor in IY; the slot sweep reads them one past its last.
  const armed = mem8[MOTHER_SHIP_ARMED] !== 0;
  destroySlotsAndPlayerOnContact(m, (ACTOR_RECORD_SLOT0 & 0xff00) | m.regs.e, m.regs.iy, armed ? 5 : 7, 7, 15);
  if (armed) ramTestPlayerVsMotherShip(m);
  destroyFixedTargetReachedByPlayer(m);

  destroyPlayerAndObjectsTouchingIt(m, ERA_OBJECT_RECORD_SLOT2, ERA_OBJECT_ENTRY_SLOT2, 5, 11, 1);

  // The tail marks objects near the player using the cursors that sweep just left (record page from
  // ERA_OBJECT_RECORD_SLOT2, index/entry and the compare flags carried in E/IY/F).
  return markObjectsTouchingPlayer(m, m.regs.f, 8, 17, ERA_OBJECT_RECORD_SLOT2 & 0xff00, m.regs.e, m.regs.iy, 1);
}

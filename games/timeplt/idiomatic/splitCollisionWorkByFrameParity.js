// SPDX-License-Identifier: GPL-3.0-only
/** splitCollisionWorkByFrameParity — split the per-frame collision work by frame parity: on odd frames run the shot-versus-
 * target sweeps; on even frames run the player-versus-object collision chain, adding the mother-ship
 * mutual-kill check only while the mother ship is armed. LIVE-OUT: memory only. */

import { loc_4f35 } from "./loc_4f35.js";
import { destroyFixedTargetHitByShots } from "./destroyFixedTargetHitByShots.js";
import { destroyPlayerAndObjectsTouchingIt } from "./destroyPlayerAndObjectsTouchingIt.js";
import { destroySlotsAndPlayerOnContact } from "./destroySlotsAndPlayerOnContact.js";
import { ramTestPlayerVsMotherShip } from "./ramTestPlayerVsMotherShip.js";
import { destroyFixedTargetReachedByPlayer } from "./destroyFixedTargetReachedByPlayer.js";
import { markObjectsTouchingPlayer } from "./markObjectsTouchingPlayer.js";
import { FRAME_TICK, MOTHER_SHIP_ARMED } from "./names.js";

const FIRST_SWEEP_RECORDS = 0xa810;
const FIRST_SWEEP_ENTRIES = 0xaa12;
const SECOND_SWEEP_RECORDS = 0xa8e0;
const SECOND_SWEEP_ENTRIES = 0xaa2c;

export function splitCollisionWorkByFrameParity(m) {
  const { mem8, regs } = m;
  if (mem8[FRAME_TICK] & 0x01) return loc_4f35(m);

  destroyFixedTargetHitByShots(m);

  regs.b = 4;
  regs.de = FIRST_SWEEP_RECORDS;
  regs.iy = FIRST_SWEEP_ENTRIES;
  regs.l = 5;
  regs.h = 11;
  destroyPlayerAndObjectsTouchingIt(m);

  // The slot sweep is handed the record/entry cursors the sweep above left, one past its last.
  const armed = mem8[MOTHER_SHIP_ARMED] !== 0;
  regs.b = armed ? 5 : 7;
  regs.l = 7;
  regs.h = 15;
  destroySlotsAndPlayerOnContact(m);
  if (armed) ramTestPlayerVsMotherShip(m);
  destroyFixedTargetReachedByPlayer(m);

  regs.b = 1;
  regs.de = SECOND_SWEEP_RECORDS;
  regs.iy = SECOND_SWEEP_ENTRIES;
  regs.l = 5;
  regs.h = 11;
  destroyPlayerAndObjectsTouchingIt(m);

  // The tail marks objects near the player using the cursors that sweep just left.
  regs.b = 1;
  regs.l = 8;
  regs.h = 17;
  return markObjectsTouchingPlayer(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/** runAllCollisionSweepsThisFrame — run one round's whole collision-and-destruction pass. First sweep the player's shots
 * against their targets, then sweep the player against a run of objects. A round-state flag then
 * picks the wider pass: when the mother-ship is armed, also run the player-vs-slots contact sweep,
 * the mother-ship's own mutual-kill box, and a three-target attacker sweep; when it is not, run the
 * player-vs-slots sweep over more slots and skip the mother-ship box. Either way finish by marking
 * every object the player is now touching. The object/slot sweeps thread ONE cursor pair through
 * DE/IY, each stage continuing where the last left off, so those two are set only where the run
 * restarts and otherwise carry over. LIVE-OUT: memory, plus the cursors the final mark leaves. */

import { loc_4f5d } from "./loc_4f5d.js";
import { destroyPlayerAndObjectsTouchingIt } from "./destroyPlayerAndObjectsTouchingIt.js";
import { destroySlotsAndPlayerOnContact } from "./destroySlotsAndPlayerOnContact.js";
import { ramTestPlayerVsMotherShip } from "./ramTestPlayerVsMotherShip.js";
import { destroyTargetsReachedByFixedAttacker } from "./destroyTargetsReachedByFixedAttacker.js";
import { markObjectsTouchingPlayer } from "./markObjectsTouchingPlayer.js";
import { MOTHER_SHIP_ARMED } from "./names.js";

export function runAllCollisionSweepsThisFrame(m) {
  const { regs, mem8 } = m;
  loc_4f5d(m);

  regs.b = 4;
  regs.de = 0xa810;
  regs.iy = 0xaa12;
  regs.l = 5;
  regs.h = 11;
  destroyPlayerAndObjectsTouchingIt(m);

  if (mem8[MOTHER_SHIP_ARMED] !== 0) {
    regs.b = 5;
    regs.l = 7;
    regs.h = 15;
    destroySlotsAndPlayerOnContact(m);
    ramTestPlayerVsMotherShip(m);

    regs.b = 3;
    regs.de = 0xa8c0;
    regs.iy = 0xaa28;
    regs.l = 6;
    regs.h = 13;
    destroyTargetsReachedByFixedAttacker(m);

    regs.b = 1;
    regs.l = 8;
    regs.h = 17;
    return markObjectsTouchingPlayer(m);
  }

  regs.b = 7;
  regs.l = 7;
  regs.h = 15;
  destroySlotsAndPlayerOnContact(m);

  regs.b = 3;
  regs.l = 6;
  regs.h = 13;
  destroyTargetsReachedByFixedAttacker(m);

  regs.b = 1;
  regs.l = 8;
  regs.h = 17;
  return markObjectsTouchingPlayer(m);
}

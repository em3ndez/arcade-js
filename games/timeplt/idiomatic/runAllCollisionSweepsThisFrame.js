// SPDX-License-Identifier: GPL-3.0-only
/** runAllCollisionSweepsThisFrame — run one round's whole collision-and-destruction pass. First sweep the player's shots
 * against their targets, then sweep the player against a run of objects. A round-state flag then
 * picks the wider pass: when the mother-ship is armed, also run the player-vs-slots contact sweep,
 * the mother-ship's own mutual-kill box, and a three-target attacker sweep; when it is not, run the
 * player-vs-slots sweep over more slots and skip the mother-ship box. Either way finish by marking
 * every object the player is now touching. The object/slot sweeps thread ONE cursor pair through
 * DE/IY, each stage continuing where the last left off, so those two are set only where the run
 * restarts and otherwise carry over. LIVE-OUT: memory, plus the cursors the final mark leaves. */

import { stagePlayerShotSweepAgainstTargetsAndRun } from "./stagePlayerShotSweepAgainstTargetsAndRun.js";
import { destroyPlayerAndObjectsTouchingIt } from "./destroyPlayerAndObjectsTouchingIt.js";
import { destroySlotsAndPlayerOnContact } from "./destroySlotsAndPlayerOnContact.js";
import { ramTestPlayerVsMotherShip } from "./ramTestPlayerVsMotherShip.js";
import { destroyTargetsReachedByFixedAttacker } from "./destroyTargetsReachedByFixedAttacker.js";
import { markObjectsTouchingPlayer } from "./markObjectsTouchingPlayer.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, MOTHER_SHIP_ARMED } from "./names.js";

export function runAllCollisionSweepsThisFrame(m) {
  const { regs, mem8 } = m;
  stagePlayerShotSweepAgainstTargetsAndRun(m);

  regs.de = ACTOR_RECORD_SLOT0; // callee writes back only regs.e; regs.d must persist for the later cursor reads
  destroyPlayerAndObjectsTouchingIt(m, ACTOR_RECORD_SLOT0, ACTOR_ENTRY_SLOT0, 5, 11, 4);

  if (mem8[MOTHER_SHIP_ARMED] !== 0) {
    destroySlotsAndPlayerOnContact(m, regs.de, regs.iy, 5, 7, 15);
    ramTestPlayerVsMotherShip(m);

    regs.de = ERA_OBJECT_RECORD_SLOT0; // cursor pair must survive an early attacker-not-live return into the final mark
    regs.iy = ERA_OBJECT_ENTRY_SLOT0;
    destroyTargetsReachedByFixedAttacker(m, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT0, 3, 6, 13);

    return (regs.b = 1, regs.l = 8, regs.h = 17, markObjectsTouchingPlayer(m));
  }

  destroySlotsAndPlayerOnContact(m, regs.de, regs.iy, 7, 7, 15);

  destroyTargetsReachedByFixedAttacker(m, regs.de, regs.iy, 3, 6, 13);

  return (regs.b = 1, regs.l = 8, regs.h = 17, markObjectsTouchingPlayer(m));
}

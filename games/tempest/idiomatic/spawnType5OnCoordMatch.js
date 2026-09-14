// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SEGMENT, PLAYER_FINE_ANGLE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, ENEMY_PHASE } from "./names.js";
import { insertType5AndDrainPending } from "./insertType5AndDrainPending.js";

/**
 * spawnType5OnCoordMatch — spawn a type-5 object when an enemy slot sits exactly on the player. ROM 0x9e2f.
 *
 * Role in the machine: type-5 is the object the game seeds when an enemy has closed all the way to the
 * player's position on the tube rim — same lane segment AND same fine angle. This is the per-slot guard
 * for that event: it fires only for a live slot whose two coordinate cells both equal the current player
 * coordinates, and otherwise leaves the world untouched (the caller sweeps it across every slot).
 *
 * Behavior: three early-outs, all leaving state unchanged. First, if ENEMY_SLOT_FLAGS,x has bit7 set the
 * slot is dead — return. Second, if the slot's ENEMY_SEGMENT,x differs from the player's PLAYER_SEGMENT the
 * lanes don't coincide — return. Third, if the slot's ENEMY_PHASE,x differs from the player's
 * PLAYER_FINE_ANGLE the fine angles don't coincide — return. Only when the slot is live and both coordinates
 * match does it hand off to insertType5AndDrainPending, passing the dispatch index seedY as the object's Y.
 *
 * Live-out: nothing on the three guard paths; on the match path, whatever insertType5AndDrainPending stages
 * (the type-5 object plus draining the pending queue). Grounding: [seen].
 */
export function spawnType5OnCoordMatch(m, x = m.regs.x, seedY = m.regs.y) {
  const { mem8 } = m;
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) return;             // dead slot
  if (mem8[u16(ENEMY_SEGMENT + x)] !== mem8[PLAYER_SEGMENT]) return;  // lane (segment) mismatch
  if (mem8[u16(ENEMY_PHASE + x)] !== mem8[PLAYER_FINE_ANGLE]) return;  // fine-angle mismatch
  insertType5AndDrainPending(m, x, seedY); // on-player: seed type-5, seedY threaded as the object's Y
}

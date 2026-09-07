// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnObjectsOnDelayedEvent — the delayed-event spawn dispatcher, run once per gameplay frame.
 *
 * WHAT IT IS
 *   The consumer end of the delayed-event mechanism. fireDelayedEventRequest (0x15c3) raises
 *   DELAYED_EVENT_REQUEST (0x4229) when a scheduled timer elapses; this routine, called each frame from
 *   the play pipeline runGameplayFrameAndAdvanceOnFieldClear, checks whether it may act, consumes that
 *   request as a one-shot, and routes to one of three spawn paths (see mechanisms.md "Spawning
 *   secondary objects and delayed events").
 *
 * ROLE IN THE MACHINE
 *   Four guards must all pass before anything spawns:
 *     - loc_4220 bit0 clear   — the region-clear flag is NOT set (not mid board-clear).
 *     - OBJ_ACTIVE_FLAG (0x4200) bit0 set — the object/AI/projectile subsystem is switched on.
 *     - DELAYED_EVENT_REQUEST (0x4229) bit0 set — a delayed event is actually pending. It is then
 *       cleared unconditionally, so the request fires at most once even if a later guard rejects it.
 *     - OBJ_TABLE (0x42d0) head word even — the primary object table's first two bytes OR to an even
 *       value; an odd head word means the table is busy and the spawn is held for a later frame.
 *   Then it routes by the launch direction loc_4215 (set by chooseNextAttackerDirection): if bit0 is
 *   set it runs the full trigger-block spawn (spawnObjectsFromTriggerFlags 0x14be); otherwise it scans
 *   the primary trigger block PRIMARY_TRIGGER_BLOCK (0x4176) high -> low and, on the first set flag,
 *   spawns a primary plus its secondaries (spawnPrimaryAndSecondaryObjects 0x1472); failing that it
 *   scans the secondary window (15 cells below the primary block) high -> low and seeds a free
 *   descriptor slot (spawnIntoFreeDescriptorSlot 0x1446). The direction value doubles as the spawn code
 *   passed down each path.
 *
 * ROM 0x140c.  Grounding: [seen]. Cells: loc_4220, OBJ_ACTIVE_FLAG, DELAYED_EVENT_REQUEST, OBJ_TABLE,
 *   loc_4215, PRIMARY_TRIGGER_BLOCK.
 *
 * LIVE-OUT: DELAYED_EVENT_REQUEST cleared, plus whatever the chosen spawn path writes. No register contract.
 */
import { spawnObjectsFromTriggerFlags } from "./spawnObjectsFromTriggerFlags.js";
import { spawnPrimaryAndSecondaryObjects } from "./spawnPrimaryAndSecondaryObjects.js";
import { spawnIntoFreeDescriptorSlot } from "./spawnIntoFreeDescriptorSlot.js";
import {
  loc_4220,
  OBJ_ACTIVE_FLAG,
  DELAYED_EVENT_REQUEST,
  OBJ_TABLE,
  loc_4215,
  PRIMARY_TRIGGER_BLOCK,
} from "./names.js";

const GROUP_SIZE = 4;
const SECONDARY_BACKOFF = 15; // the secondary window sits 15 below the primary trigger block

export function spawnObjectsOnDelayedEvent(m) {
  const { mem8 } = m;

  // Guard 1: hold while a board-clear/region-clear is in progress (loc_4220 bit0 set).
  if (mem8[loc_4220] & 1) return;
  // Guard 2: the object subsystem must be enabled, or there is nothing to spawn into.
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return;
  // Guard 3: only act when a delayed event is actually pending.
  if ((mem8[DELAYED_EVENT_REQUEST] & 1) === 0) return;
  mem8[DELAYED_EVENT_REQUEST] = 0; // consume the one-shot request
  // Guard 4: an odd object-table head word means the table is mid-update — defer this spawn a frame.
  if ((mem8[OBJ_TABLE] | mem8[OBJ_TABLE + 1]) & 1) return; // object-table head word odd -> hold

  // Route by the shared launch direction. A set low bit takes the full trigger-block spawn path.
  const direction = mem8[loc_4215];
  if (direction & 1) return spawnObjectsFromTriggerFlags(m, direction);

  // Otherwise scan the four primary trigger cells high -> low; the first set flag spawns a primary plus
  // up to two secondaries and returns.
  for (let i = GROUP_SIZE - 1; i >= 0; i--) {
    const cell = PRIMARY_TRIGGER_BLOCK + i;
    if (mem8[cell] & 1) return spawnPrimaryAndSecondaryObjects(m, cell, direction);
  }

  // No primary flag set: scan the secondary window (15 cells below the primary block) high -> low; the
  // first set flag seeds a free descriptor slot instead.
  const secondaryBase = PRIMARY_TRIGGER_BLOCK - SECONDARY_BACKOFF;
  for (let i = GROUP_SIZE - 1; i >= 0; i--) {
    const cell = secondaryBase + i;
    if (mem8[cell] & 1) return spawnIntoFreeDescriptorSlot(m, cell, direction);
  }
}

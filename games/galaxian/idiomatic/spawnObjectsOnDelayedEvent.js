// SPDX-License-Identifier: GPL-3.0-only
// Delayed-spawn dispatch. Gated on the region-clear flag being clear, the object subsystem enabled, and a
// pending delayed-event request (consumed here as a one-shot), and only while the object-table head word is
// even. When armed, the launch direction's low bit routes a full trigger-block spawn; otherwise scan the
// primary trigger block high->low for a set flag (spawn a primary plus its secondaries), then the secondary
// window high->low (seed a free descriptor slot). No flag anywhere spawns nothing.
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

  if (mem8[loc_4220] & 1) return;
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return;
  if ((mem8[DELAYED_EVENT_REQUEST] & 1) === 0) return;
  mem8[DELAYED_EVENT_REQUEST] = 0; // consume the one-shot request
  if ((mem8[OBJ_TABLE] | mem8[OBJ_TABLE + 1]) & 1) return; // object-table head word odd -> hold

  const direction = mem8[loc_4215];
  if (direction & 1) return spawnObjectsFromTriggerFlags(m, direction);

  for (let i = GROUP_SIZE - 1; i >= 0; i--) {
    const cell = PRIMARY_TRIGGER_BLOCK + i;
    if (mem8[cell] & 1) return spawnPrimaryAndSecondaryObjects(m, cell, direction);
  }

  const secondaryBase = PRIMARY_TRIGGER_BLOCK - SECONDARY_BACKOFF;
  for (let i = GROUP_SIZE - 1; i >= 0; i--) {
    const cell = secondaryBase + i;
    if (mem8[cell] & 1) return spawnIntoFreeDescriptorSlot(m, cell, direction);
  }
}

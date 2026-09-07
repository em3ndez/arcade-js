// SPDX-License-Identifier: GPL-3.0-only
//
// spawnPrimaryAndSecondaryObjects -- ROM 0x1472. Grounding: [seen].
//
// WHAT IT IS
//   One of Galaxian's object spawners. Given a pointer into a block of "trigger flags" (one flag per
//   pending spawn), it materialises a primary attacker plus, optionally, up to two secondaries that ride
//   in alongside it. This is the branch the delayed-event dispatcher takes when the launch-direction bit
//   is clear (spawnObjectsOnDelayedEvent, ROM 0x140c), scanning the primary trigger block high-to-low.
//
// ROLE IN THE MACHINE
//   The object field is an eight-slot array of 32-byte records; OBJ_TABLE (0x42d0, names.js) names the
//   primary table inside it, and the secondaries land in the records just past it (0x42f0 onward). A live
//   object is later turned into a sprite by stageObjectsToSpriteShadow and driven by the per-frame AI.
//   The actual slot activation and the type-1 spawn command word are done by the shared core
//   activateObjectSlotAndEnqueueSpawn (0x145c); a secondary is done by spawnSecondaryObjectIntoSlot
//   (0x149b). Nothing is drawn here -- objects become visible only once their spawn command drains.
//
// LIVE-OUT
//   Populated OBJ_TABLE records (primary + any secondaries) and appended command-queue words; no return
//   value is used. The primary's trigger pointer is consumed (zeroed) by the core, as is each secondary's.
import { u8, u16 } from "../../../core/int.js";
import { activateObjectSlotAndEnqueueSpawn } from "./activateObjectSlotAndEnqueueSpawn.js";
import { spawnSecondaryObjectIntoSlot } from "./spawnSecondaryObjectIntoSlot.js";
import { OBJ_TABLE } from "./names.js";

// Record layout and the fixed walk shape, lifted out of the Z80's immediate operands.
const SLOT_STRIDE = 32; // bytes per object record
const SECONDARY_SLOT_BASE = OBJ_TABLE + SLOT_STRIDE; // first secondary slot (deserves its own name)
const TRIGGER_BLOCK_BACKOFF = 15; // primary trigger low byte -> top of the trigger-flag block
const TRIGGER_WALK = 3; // flags examined
const SECONDARY_BUDGET = 2; // secondaries this pass may spawn

export function spawnPrimaryAndSecondaryObjects(m, trigger = m.regs.hl, spawnCode = m.regs.c) {
  const { mem8 } = m;

  // Step 1: spawn the primary into OBJ_TABLE. The shared core claims the slot, consumes the trigger flag,
  // records the spawn code (C), and enqueues the type-1 spawn word; it hands the trigger pointer back.
  // Spawn the primary; the trigger pointer is returned unchanged.
  const primary = activateObjectSlotAndEnqueueSpawn(m, trigger, OBJ_TABLE, spawnCode);

  // Step 2: locate the secondary trigger-flag block. The block sits below the primary's low byte within
  // the same 256-byte page, so the high byte never changes -- the original walked it with `dec l`, which
  // is why only the low byte counts down here and `base` is the page floor of the primary pointer.
  // The flag block shares the primary trigger's high byte; only the low byte walks (Z80 `dec l`).
  const base = u16(primary - u8(primary));
  let low = u8(primary - TRIGGER_BLOCK_BACKOFF);
  let slot = SECONDARY_SLOT_BASE;
  let budget = SECONDARY_BUDGET;
  let counter = TRIGGER_WALK;

  // Step 3: walk the flag block (three flags). For each set flag spawn one secondary into the next record;
  // spending the last of the two-secondary budget collapses the loop counter to 1, so the walk stops on
  // this pass. Every iteration steps the low byte down one, matching the ROM's descending scan.
  do {
    if (mem8[base + low] & 1) {
      spawnSecondaryObjectIntoSlot(m, slot, OBJ_TABLE, base + low);
      slot = u16(slot + SLOT_STRIDE);
      budget = u8(budget - 1);
      if (budget === 0) counter = 1; // budget spent -> this is the last pass
    }
    low = u8(low - 1);
    counter = u8(counter - 1);
  } while (counter !== 0);
}

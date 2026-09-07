// SPDX-License-Identifier: GPL-3.0-only
//
// spawnSecondaryObjectIntoSlot -- ROM 0x149b. Grounding: [seen].
//
// WHAT IT IS
//   Activates one secondary object into a specific object-record slot. A "secondary" is the extra attacker
//   that rides in alongside a freshly spawned primary. It is called per-slot from the secondary spawn walk
//   (spawnSecondaryObjectAndAdvanceWalk, 0x148e) and directly from the trigger-block spawners.
//
// ROLE IN THE MACHINE
//   Object records are 32-byte structs based in the 0x42xx region (OBJ_TABLE 0x42d0 names the primary
//   table). This routine refuses to clobber a live slot -- it checks the record's two live flags (byte 0
//   bit 0 = primary/active, byte 1 bit 0 = secondary/dying-animation) and bails if either is set. When the
//   slot is free it marks it alive, zeroes the AI state index, copies the direction/spawn-code field from
//   the source record (IX, the primary), and records which trigger flag spawned it. Finally it appends a
//   deferred activation command word (channel 1, low byte = the trigger index) via enqueueCommandWord
//   (0x08f2), which the per-frame command drain later turns into the object's on-screen appearance.
//
// LIVE-OUT
//   The IY slot record (bytes 0/2/6/7 written); the trigger flag at HL cleared to 0 (consumed); one word
//   appended to the display/sound command queue. Register mirrors: IY slot, IX source, HL trigger pointer.
import { enqueueCommandWord } from "./enqueueCommandWord.js";

// Object-record field offsets (bytes from the slot base).
const LIVE_A = 0;   // primary live flag (bit 0)
const LIVE_B = 1;   // secondary live flag (bit 0)
const STATE = 2;
const INHERIT = 6;
const TRIGGER_IDX = 7;

export function spawnSecondaryObjectIntoSlot(m, slot = m.regs.iy, source = m.regs.ix, trigger = m.regs.hl) {
  const { mem8 } = m;

  // Guard: never overwrite a slot that is already occupied. Either live flag being set aborts the spawn,
  // so an in-flight attacker (active) or one mid dying-animation (secondary flag) is left untouched.
  if (mem8[slot + LIVE_A] & 1) return;
  if (mem8[slot + LIVE_B] & 1) return;

  // The trigger's low byte is the "source index" -- it names which flag in the block spawned this object,
  // and is echoed into the activation command so the drain knows what to build.
  const index = trigger & 0xff;
  mem8[trigger] = 0; // consume the trigger flag
  // Mark the slot alive and reset it to state 0 (the spawn-init AI handler runs on its first tick).
  mem8[slot + LIVE_A] = 1;
  mem8[slot + STATE] = 0;
  // Inherit field 6 (direction bit / spawn code) from the primary so the secondary shares its heading.
  mem8[slot + INHERIT] = mem8[source + INHERIT];
  mem8[slot + TRIGGER_IDX] = index;
  // Queue the deferred activation: high byte 1 selects the object-spawn channel, low byte is the index.
  return enqueueCommandWord(m, (1 << 8) | index, trigger);
}

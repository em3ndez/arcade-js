// SPDX-License-Identifier: GPL-3.0-only
import { scanTargetSlotsAndSpawnOnProximityHit } from "./scanTargetSlotsAndSpawnOnProximityHit.js";
import { SPRITE_TARGET_SLOTS, PROJECTILE_TABLE } from "./names.js";
/**
 * seedAndRunTargetProximityScan — set up and run one object-proximity scan over a target box.
 *
 * WHAT IT IS
 *   The entry point that arms a single proximity sweep. Once a frame the machine has to ask
 *   whether any of its live target coordinates has drifted close enough to a moving actor to
 *   count as a contact. This routine does none of the comparing itself; it only loads the
 *   three things the per-slot scan needs before it can start — where the candidate coordinates
 *   live, where the record list lives, and how many slots to walk — then runs the scan and
 *   passes back whatever verdict it produces. It is a thin seeder with no work of its own
 *   after the hand-off, so its result is exactly the scan's result.
 *
 * ROLE IN THE MACHINE
 *   One inner loop of the per-frame object-collision pipeline. The proximity scan walks three
 *   stride-4 coordinate slots and, for each, measures the on-screen distance from that
 *   candidate to the actor box; the first slot that falls inside the proximity window is
 *   claimed — its record is stamped with fresh state bytes, its animation is set, its hit
 *   flag raised, and a spawn tile plus display command are queued — and the sweep aborts on
 *   that hit. This routine is what points the scan at the sprite target-slot table and the
 *   projectile record list, and fixes the slot count, before any of that can happen.
 *
 * ROM 0x6381 (0x6381-0x6389: the register-seeding preamble that runs into the scan at 0x638a).
 * Grounding: [seen].
 *
 * INPUTS
 *   box  — the actor/source box (IY) whose screen X (+0) and Y (+2) every candidate slot is
 *          measured against; defaults to the live IY register.
 *   ireg — the interrupt register (I), read by the scan as a parity selector: on a claim it
 *          decides which of the paired per-slot hit flags (0x8d1b when I is zero, 0x8d1c
 *          otherwise) is raised; defaults to the live I register.
 *
 * LIVE-OUT
 *   The boolean forwarded straight through from the scan: false = a slot was claimed (a
 *   contact connected) and the outer sweep must abort; true = all three slots were exhausted
 *   with no contact. The claim itself is left in memory by the scan (the claimed record's
 *   state bytes, its animation, the selected hit flag, and the queued spawn), not returned here.
 */

// The scan always walks a fixed three coordinate slots. SPRITE_TARGET_SLOTS is stride-4, so
// the three slots span 0x887c-0x8887; this constant is the loop count that bounds that walk.
const SLOT_COUNT = 0x03;

export function seedAndRunTargetProximityScan(m, box = m.regs.iy, ireg = m.regs.i) {
  // Seed the two cursors and the count, then run the scan and forward its verdict verbatim:
  //   - the coordinate cursor is aimed at SPRITE_TARGET_SLOTS (0x887c), the stride-4
  //     target/collision coordinate slots holding each candidate's screen X (+0) and Y (+2);
  //   - the record cursor is aimed at PROJECTILE_TABLE (0x8be8), the stride-0x18 record list
  //     that a claimed slot's state bytes and spawn are written into;
  //   - SLOT_COUNT (3) caps how many slots the walk covers.
  // The actor box and interrupt-parity register pass through unchanged. Nothing runs after the
  // scan returns, so its boolean is this routine's result.
  return scanTargetSlotsAndSpawnOnProximityHit(m, SPRITE_TARGET_SLOTS, SLOT_COUNT, PROJECTILE_TABLE, box, ireg);
}

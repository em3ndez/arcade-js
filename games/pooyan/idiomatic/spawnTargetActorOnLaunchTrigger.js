// SPDX-License-Identifier: GPL-3.0-only
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { advanceActorAnimationsUnlessGrabbing } from "./advanceActorAnimationsUnlessGrabbing.js";
import {
  ACTOR_TABLE,
  ACTOR_TABLE_SLOT1,
  ENEMY_TARGET_REC0,
  LAUNCH_STATE,
  FLASH_CELL_BASE,
  TAMPER_STRIKES_HUD_GUARD,
  TARGET_SPAWN_ARM_LATCH,
  loc_8d77,
} from "./names.js";
/**
 * spawnTargetActorOnLaunchTrigger — one-shot spawn of a launch-target actor into the two-slot
 * target-record pair, gated by a trigger bit on the lead actor and a fire-once latch.
 *
 * WHAT IT IS
 *   A single pass of the launch/target pipeline. When the player fires the arrow/rope, the machine
 *   raises a trigger bit on the player/lead actor record. This routine notices that edge exactly
 *   once and, if one of the two target slots is free, seeds a fresh target actor (a hunter/eagle
 *   target record) at the launch position so the per-frame target mover can carry it across the
 *   screen. It fires at most once per trigger: the latch it sets here is cleared again by the
 *   active-target step every frame, so a new spawn can arm only after a full pass has run.
 *
 * ROLE IN THE MACHINE
 *   Second of the three launch sub-passes the machine runs each frame — the launch state driver
 *   raises the arrow, THIS routine turns a fire event into an actual target-slot record, and the
 *   active-target step then advances the records that exist. After seeding a slot it hands off to the
 *   actor-animation stepper so the freshly spawned actor is drawn in step with the rest.
 *
 * ROM 0x210b (body spans 0x210b-0x2156 and 0x2184-0x21cc).
 * Grounding: [seen]
 *
 * LIVE-OUT: none — this is a spawn step, not a value producer. Its lasting effects are the target
 *   record it claims and seeds (presence bit, position copied from the launch source, two record
 *   timers, and for a "special" target an extra marker plus a companion-buffer wipe), the pair of
 *   flash/hit cells it clears, and the actor state advanced by the stepper it tails into.
 */
const SLOT_STRIDE = 0x18; // pitch between the two target records (0x8c90 -> 0x8ca8); the game's actor-record size
const SLOT_COUNT = 0x02; // there are two target slots to scan: ENEMY_TARGET_REC0 and ENEMY_TARGET_REC1
const TRIGGER_BIT = 0x10; // bit4 of the lead-actor state byte (ACTOR_TABLE+7, 0x8a87) — the player's fire edge
const IN_USE_BIT = 0x01; // byte0 bit0 of a target record: set = the slot is occupied
const SPECIAL_BIT = 0x02; // byte0 bit1 of a target record: set = this is the "special" target
const READY_IDLE = 0x02; // presence value the second slot must read for the special mark to arm
const LAUNCH_THRESHOLD = 0x02; // LAUNCH_STATE must have climbed to >= 2 (past the arm phase) to arm special
const LANE_BIT = 0x08; // bit3 of the slot address: selects which flash / hit-flag lane belongs to this slot

export function spawnTargetActorOnLaunchTrigger(m) {
  const { mem8 } = m;

  // --- Sample and consume the fire trigger ---
  // The player/lead actor's state byte sits at ACTOR_TABLE+7 (0x8a87). Bit4 there is raised when the
  // player fires. Read that bit, then blank the whole byte so the edge is consumed and cannot fire
  // again on a later frame. If the bit was clear there was no fire this pass, so there is nothing to
  // spawn — return.
  const triggered = (mem8[ACTOR_TABLE + 0x07] & TRIGGER_BIT) !== 0;
  mem8[ACTOR_TABLE + 0x07] = 0x00; // consume the trigger by clearing the entire lead-actor state byte
  if (!triggered) return; // no fire this frame

  // --- Fire-once latch ---
  // TARGET_SPAWN_ARM_LATCH (0x8f02) blocks re-entry. If it is already set, a spawn is in flight for
  // the current trigger, so stop. Otherwise raise it. The active-target step clears this latch again
  // each frame, so the machine spawns at most one target per fire until a full pipeline pass has run.
  if (mem8[TARGET_SPAWN_ARM_LATCH] !== 0) return; // a spawn is already armed for this trigger
  mem8[TARGET_SPAWN_ARM_LATCH]++; // arm the once-latch (cleared by the active-target step each pass)

  // Begin at the first of the two target records (ENEMY_TARGET_REC0, 0x8c90).
  let slot = ENEMY_TARGET_REC0;

  // --- Promote the first slot to "special" when the launch is ripe ---
  // If the launch has climbed past its arming phase (LAUNCH_STATE >= 2) AND the second target slot
  // (0x8ca8, at slot+0x18) is sitting at the ready-idle presence value AND the first slot is fully
  // free (byte0 == 0), then retire the second slot (clear its byte0) and mark the first slot special
  // (byte0 bit1). A special target gets a shorter timer and its own companion-buffer wipe below.
  if (
    mem8[LAUNCH_STATE] >= LAUNCH_THRESHOLD &&
    mem8[slot + SLOT_STRIDE] === READY_IDLE &&
    mem8[slot] === 0x00
  ) {
    mem8[slot + SLOT_STRIDE] = 0x00; // retire the second slot's presence byte
    mem8[slot] |= SPECIAL_BIT; // tag the first slot as the special target
  }

  // --- Claim the first free slot and seed a target record ---
  // Walk the two records at stride 0x18; the first one whose in-use bit (byte0 bit0) is clear is
  // claimed and seeded, and the routine tails out immediately after seeding it.
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((mem8[slot] & IN_USE_BIT) === 0) {
      mem8[slot] |= IN_USE_BIT; // claim the slot: mark the record occupied

      // Seed the new target's position from the launch source (the lead actor at ACTOR_TABLE,
      // 0x8a80). Its Y field (rec+4, e.g. EAGLE_Y_COORD 0x8c94) comes from the player Y (0x8a84)
      // minus 3, and its X field (rec+6, e.g. EAGLE_X_COORD 0x8c96) from the source's +6 byte
      // (0x8a86) plus 4 — small biases so the target appears just off the launch point.
      mem8[slot + 0x04] = mem8[ACTOR_TABLE + 0x04] - 0x03; // Y = source Y - 3
      mem8[slot + 0x06] = mem8[ACTOR_TABLE + 0x06] + 0x04; // X = source X + 4

      // Seed the record's two timers (rec+0x0f and rec+0x10). A special target counts its primary
      // timer down faster (0x10), also raises the marker cell loc_8d77 (0x8d77) and wipes the 0x18
      // bytes of the companion actor record at ACTOR_TABLE_SLOT1 (0x8a98); an ordinary target uses
      // the slower 0x14. Both share the same 0x40 secondary timer.
      if ((mem8[slot] & SPECIAL_BIT) !== 0) {
        mem8[slot + 0x0f] = 0x10; // special target: short primary timer
        mem8[slot + 0x10] = 0x40; // shared secondary timer
        mem8[loc_8d77] = 0x01; // raise the special-target marker cell (0x8d77)
        fillByteRun(m, ACTOR_TABLE_SLOT1, 0x00, SLOT_STRIDE); // wipe the 0x18-byte companion buffer at 0x8a98
      } else {
        mem8[slot + 0x0f] = 0x14; // ordinary target: slower primary timer
        mem8[slot + 0x10] = 0x40; // shared secondary timer
      }

      // Clear this slot's collision-flash cell and its paired hit flag so the fresh target starts
      // clean. The lane is picked by bit3 of the slot address: slot 0 (0x8c90) uses FLASH_CELL_BASE
      // (0x8d19) with hit flag two cells along (0x8d1b); slot 1 (0x8ca8, bit3 set) uses 0x8d1a with
      // hit flag 0x8d1c.
      let flag = FLASH_CELL_BASE;
      if ((slot & LANE_BIT) !== 0) flag = u16(flag + 1); // second lane sits one cell along
      mem8[flag] = 0x00; // clear the flash cell for this lane
      mem8[u16(flag + 2)] = 0x00; // clear the paired hit flag two cells along

      // Spawn complete — tail into the actor-animation stepper, which walks the actor records and
      // advances each one's animation script (skipped while a rope-grab is in progress) so the new
      // target animates in step with everything else this frame.
      return advanceActorAnimationsUnlessGrabbing(m); // hand off to the actor-animation stepper
    }
    slot = u16(slot + SLOT_STRIDE); // advance to the next target record
  }

  // --- Both slots occupied ---
  // No free target this frame; nothing was spawned. On an intact machine this simply returns.
  // TAMPER_STRIKES_HUD_GUARD (0x8a3c) is an anti-tamper strike counter that stays zero while the ROM
  // checks pass; a checksum tripwire elsewhere bumps it nonzero on a modified ROM. When it is
  // nonzero, control is diverted here into stepActiveTargetActorRecords (the active-target step)
  // instead of returning — an out-of-order re-entry that quietly derails the pipeline on a tampered ROM.
  if (mem8[TAMPER_STRIKES_HUD_GUARD] !== 0) return stepActiveTargetActorRecords(m); // tamper divert
  return;
}

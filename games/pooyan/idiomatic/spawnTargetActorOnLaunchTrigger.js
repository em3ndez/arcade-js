// SPDX-License-Identifier: GPL-3.0-only
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
import { u16 } from "../../../core/int.js";
import { loc_0010 } from "./loc_0010.js";
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
 * spawnTargetActorOnLaunchTrigger — one-shot target-slot spawn, gated by a trigger bit and a once latch.
 *
 * Samples and clears the actor-table trigger bit; if it was clear, or the once latch is already
 * set, it stops. Otherwise it arms the latch and — when launch has reached its threshold and the
 * second target slot reads ready-but-idle — marks the first slot special. It then scans the two
 * target slots for the first free one and seeds it: position from the actor source, two timers, an
 * optional buffer clear for a special slot, and a pair of side flags, then tails to the actor
 * animation stepper. If both slots are busy the tamper guard decides — nonzero tails to the
 * (unlifted) tamper re-scan, else it returns.
 *
 * LIVE-OUT: none — a spawn step; effects land in the slot records and the delegatee.
 */
const SLOT_STRIDE = 0x18; // target-slot record pitch
const SLOT_COUNT = 0x02; // target slots scanned
const TRIGGER_BIT = 0x10; // sampled bit of the trigger byte
const IN_USE_BIT = 0x01; // slot claimed bit
const SPECIAL_BIT = 0x02; // slot special-marker bit
const READY_IDLE = 0x02; // second-slot value that arms the special mark
const LAUNCH_THRESHOLD = 0x02;
const LANE_BIT = 0x08; // low-address bit selecting the second side-flag lane

export function spawnTargetActorOnLaunchTrigger(m) {
  const { mem8 } = m;

  const triggered = (mem8[ACTOR_TABLE + 0x07] & TRIGGER_BIT) !== 0;
  mem8[ACTOR_TABLE + 0x07] = 0x00; // clear the whole trigger byte
  if (!triggered) return; // trigger was clear
  if (mem8[TARGET_SPAWN_ARM_LATCH] !== 0) return; // already latched
  mem8[TARGET_SPAWN_ARM_LATCH]++; // arm the once latch

  let slot = ENEMY_TARGET_REC0;

  // arm the special mark on the first slot when launch is ready and the second slot is ready-idle
  if (
    mem8[LAUNCH_STATE] >= LAUNCH_THRESHOLD &&
    mem8[slot + SLOT_STRIDE] === READY_IDLE &&
    mem8[slot] === 0x00
  ) {
    mem8[slot + SLOT_STRIDE] = 0x00;
    mem8[slot] |= SPECIAL_BIT;
  }

  // scan for the first free slot (in-use bit clear) and initialise it
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((mem8[slot] & IN_USE_BIT) === 0) {
      mem8[slot] |= IN_USE_BIT; // claim the slot
      mem8[slot + 0x04] = mem8[ACTOR_TABLE + 0x04] - 0x03; // seed one axis from the source
      mem8[slot + 0x06] = mem8[ACTOR_TABLE + 0x06] + 0x04; // seed the other axis from the source
      if ((mem8[slot] & SPECIAL_BIT) !== 0) {
        mem8[slot + 0x0f] = 0x10; // special-slot timers
        mem8[slot + 0x10] = 0x40;
        mem8[loc_8d77] = 0x01;
        loc_0010(m, ACTOR_TABLE_SLOT1, 0x00, SLOT_STRIDE); // clear the special buffer
      } else {
        mem8[slot + 0x0f] = 0x14; // ordinary-slot timers
        mem8[slot + 0x10] = 0x40;
      }
      // clear a pair of side flags; the second lane sits one cell along
      let flag = FLASH_CELL_BASE;
      if ((slot & LANE_BIT) !== 0) flag = u16(flag + 1);
      mem8[flag] = 0x00;
      mem8[u16(flag + 2)] = 0x00;
      return advanceActorAnimationsUnlessGrabbing(m); // tail to the actor animation stepper
    }
    slot = u16(slot + SLOT_STRIDE);
  }

  // both slots busy: the tamper guard decides
  if (mem8[TAMPER_STRIKES_HUD_GUARD] !== 0) return stepActiveTargetActorRecords(m); // tail to the (unlifted) tamper re-scan
  return;
}

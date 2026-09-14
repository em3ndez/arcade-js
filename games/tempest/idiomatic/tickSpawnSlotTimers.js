// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2f, FRAME_COUNTER, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, ENEMY_SLOT_TOP, WAVE_PHASE_LATCH, SPIKE_LANE_MASK_ACC, SPIKE_LANE_MASK_OUT, OBJECT_INDEX_TABLE, OBJECT_RECORD_TABLE, SLOT_BIT_MASK } from "./names.js";
import { spawnEnemyOnTimerExpiry } from "./spawnEnemyOnTimerExpiry.js";

// Scans the 64-entry slot-timer table OBJECT_RECORD_TABLE (slot 63..0), ageing each active slot, and accumulates a
// per-slot bit mask into SPIKE_LANE_MASK_ACC which it copies out to SPIKE_LANE_MASK_OUT. loc_2f is a gate byte: 0xff (bit7 set)
// freezes ageing this pass; it is set when the ENEMY_TOTAL_COUNT+ENEMY_TYPE_COUNT pair overshoots ENEMY_SLOT_TOP, or WAVE_PHASE_LATCH is set.
// An expired slot (timer reaches 0) fires the expiry handler, which may itself raise the loc_2f gate mid-scan.
export function tickSpawnSlotTimers(m) {
  const { mem8 } = m;

  mem8[SPIKE_LANE_MASK_ACC] = 0;

  const pairedSum = u8(mem8[ENEMY_TOTAL_COUNT] + mem8[ENEMY_TYPE_COUNT]);
  mem8[loc_2f] = (pairedSum > mem8[ENEMY_SLOT_TOP] || mem8[WAVE_PHASE_LATCH] !== 0) ? 0xff : 0x00;

  for (let slot = 0x3f; slot >= 0; slot--) {
    const timer = mem8[u16(OBJECT_RECORD_TABLE + slot)];
    if (timer === 0) continue;

    // Age the slot unless the gate is raised.
    if ((mem8[loc_2f] & 0x80) === 0) {
      const aged = timer - 1;
      mem8[u16(OBJECT_RECORD_TABLE + slot)] = aged;
      if (aged === 0) {
        spawnEnemyOnTimerExpiry(m, slot);
      } else if (aged === 0x3f) {
        const bit = mem8[u16(OBJECT_INDEX_TABLE + slot)];
        if ((mem8[SPIKE_LANE_MASK_ACC] & mem8[u16(SLOT_BIT_MASK + bit)]) !== 0) {
          mem8[u16(OBJECT_RECORD_TABLE + slot)] = aged + 1;
        }
      }
    }

    // Classify the (possibly re-armed or expired) timer.
    const t = mem8[u16(OBJECT_RECORD_TABLE + slot)];
    if (t < 0x40) {
      if (t >= 0x20) {
        const bit = mem8[u16(OBJECT_INDEX_TABLE + slot)];
        mem8[SPIKE_LANE_MASK_ACC] = mem8[SPIKE_LANE_MASK_ACC] | mem8[u16(SLOT_BIT_MASK + bit)];
      }
    } else if ((mem8[FRAME_COUNTER] & 0x01) === 0) {
      mem8[u16(OBJECT_INDEX_TABLE + slot)] = (mem8[u16(OBJECT_INDEX_TABLE + slot)] + 1) & 0x0f;
    }
  }

  mem8[SPIKE_LANE_MASK_OUT] = mem8[SPIKE_LANE_MASK_ACC];
}

// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  STATUS_FLAGS, loc_29, INPUT_DEBOUNCED, SPIKE_ACTIVE_FLAG, ACTIVE_OBJECT_COUNT,
  PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH, TARGET_SEG, loc_2b5, loc_2c0, SLOT_STATE, loc_2db, HIT_TALLY,
} from "./names.js";
import { requestEnemySpawnSound } from "./requestEnemySpawnSound.js";
import { resolveSlotProximityInteractions } from "./resolveSlotProximityInteractions.js";

// Try to spawn into a free slot. Bails when PLAYER_FINE_ANGLE is negative. Then forms a gate: when STATUS_FLAGS is
// negative the gate is INPUT_DEBOUNCED & 0x10, otherwise it seeds loc_29 from SPIKE_ACTIVE_FLAG and adds one per slot of
// loc_2b5 (x = 10..0, gated by loc_2db nonzero) whose value sits within 1 of PLAYER_SEGMENT. A zero gate bails.
// Otherwise it scans SLOT_STATE (x = 7..0) for the first free (zero) slot, seeds that slot across SLOT_STATE/
// TARGET_SEG/loc_2c0/HIT_TALLY, bumps the live count ACTIVE_OBJECT_COUNT, and fires the two spawn helpers.
export function spawnEntityIntoFreeSlot(m) {
  const { mem8 } = m;

  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return;

  let gate;
  if (mem8[STATUS_FLAGS] & 0x80) {
    gate = mem8[INPUT_DEBOUNCED] & 0x10;
  } else {
    mem8[loc_29] = mem8[SPIKE_ACTIVE_FLAG];
    for (let x = 10; x >= 0; x--) {
      if (mem8[u16(loc_2db + x)] === 0) continue;
      let delta = u8(mem8[u16(loc_2b5 + x)] - mem8[PLAYER_SEGMENT]);
      if (delta & 0x80) delta = u8((delta ^ 0xff) + 1); // abs of the signed difference
      if (delta < 2) mem8[loc_29] = u8(mem8[loc_29] + 1);
    }
    gate = mem8[loc_29];
  }

  if (gate === 0) return;

  for (let x = 7; x >= 0; x--) {
    if (mem8[u16(SLOT_STATE + x)] !== 0) continue;
    mem8[ACTIVE_OBJECT_COUNT] = u8(mem8[ACTIVE_OBJECT_COUNT] + 1);
    mem8[u16(SLOT_STATE + x)] = mem8[PLAYER_SHOT_DEPTH];
    mem8[u16(TARGET_SEG + x)] = mem8[PLAYER_SEGMENT];
    mem8[u16(loc_2c0 + x)] = mem8[PLAYER_FINE_ANGLE];
    mem8[u16(HIT_TALLY + x)] = 0;
    // The spawn/sound chain stamps the slot index into loc_31/loc_32; pass it explicitly.
    requestEnemySpawnSound(m, x);
    resolveSlotProximityInteractions(m, mem8[PLAYER_SHOT_DEPTH], x);
    break; // only the first free slot is filled
  }
}

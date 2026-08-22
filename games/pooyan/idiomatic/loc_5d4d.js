// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5d68 } from "./loc_5d68.js";
import { PROXIMITY_SOURCE_OBJECT, SPRITE_TARGET_SLOTS, PROJECTILE_TABLE } from "./names.js";
/**
 * loc_5d4d — proximity-scan three target/record pairs against a fixed source.
 *
 * Walks three sprite target slots (stride 4) paired with three object records
 * (stride 0x18), testing each against the fixed source object. A hit re-seeds the
 * struck record and aborts the whole scan immediately; with no hit all three pairs
 * are tested.
 *
 * LIVE-OUT: none — a scan driver whose registers are loop artifacts.
 */

const PAIR_COUNT = 3; // target/record pairs tested per frame
const TARGET_STRIDE = 0x04; // stride between sprite target slots
const RECORD_STRIDE = 0x18; // stride between object records

export function loc_5d4d(m) {
  let target = SPRITE_TARGET_SLOTS;
  let record = PROJECTILE_TABLE;
  for (let i = 0; i < PAIR_COUNT; i++) {
    if (!loc_5d68(m, PROXIMITY_SOURCE_OBJECT, target, record)) return; // hit -> abort scan
    target = u16(target + TARGET_STRIDE);
    record = u16(record + RECORD_STRIDE);
  }
}

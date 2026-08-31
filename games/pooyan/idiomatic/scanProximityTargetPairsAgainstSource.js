// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5d68 } from "./loc_5d68.js";
import { PROXIMITY_SOURCE_OBJECT, SPRITE_TARGET_SLOTS, PROJECTILE_TABLE } from "./names.js";
/**
 * scanProximityTargetPairsAgainstSource — proximity-scan three target/record pairs against a fixed source.
 *
 * WHAT IT IS
 *   A driver in Pooyan's per-frame object-proximity collision machinery. It measures three moving
 *   objects against one fixed reference object and asks, for each, "is this one close enough to
 *   count as a hit?". It does not do the geometry itself; it walks the three candidates and hands
 *   each in turn to the per-pair overlap test at ROM 0x5d68, which decides the hit and, when one
 *   connects, claims the object. This routine's whole job is to pick the pairs, feed them through,
 *   and stop the moment one of them lands.
 *
 * ROLE IN THE MACHINE
 *   Each candidate is a two-part thing: a TARGET — a live sprite coordinate slot (screen X at +0,
 *   screen Y at +2) drawn from SPRITE_TARGET_SLOTS (0x887c), the coordinates the collision drivers
 *   rewrite every frame — paired with a RECORD, the object bookkeeping struct at PROJECTILE_TABLE
 *   (0x8be8) that gets re-seeded when the pair connects. Everything is measured against one fixed
 *   SOURCE object, PROXIMITY_SOURCE_OBJECT (0x889c), which sits inside the sprite display list and
 *   carries its own screen X at +0 / screen Y at +2. The source never moves during the scan; only
 *   the target and record pointers walk forward, in lockstep, from one candidate to the next.
 *
 *   "Close enough" is entirely the overlap test's call: it builds a narrow box around the source
 *   and reports a hit when the target lands inside it on both axes. A hit re-seeds the struck
 *   record (marking it caught and installing its post-hit reaction) and queues the hit sound; the
 *   overlap test then reports back so this driver aborts. Because the scan stops on the first hit,
 *   at most one pair is claimed per frame and the remaining pairs go untested — a deliberate
 *   one-hit-per-pass discipline shared across Pooyan's proximity sweeps.
 *
 * ROM: 0x5d4d-0x5d67.
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a scan driver whose registers are loop artifacts. No register or memory value
 *   survives to the caller; the only lasting effects are the record writes and the queued sound
 *   that happen inside the overlap test on a hit. A no-hit pass leaves memory untouched.
 */

const PAIR_COUNT = 3; // target/record pairs tested per frame
const TARGET_STRIDE = 0x04; // stride between sprite target slots
const RECORD_STRIDE = 0x18; // stride between object records

export function scanProximityTargetPairsAgainstSource(m) {
  // Seed the two walking pointers at the head of their arrays. The target pointer starts at the
  // first sprite coordinate slot (SPRITE_TARGET_SLOTS, 0x887c) and the record pointer at the first
  // object record (PROJECTILE_TABLE, 0x8be8). The source object (PROXIMITY_SOURCE_OBJECT, 0x889c)
  // is fixed and never advances — every pair is measured against that same reference.
  let target = SPRITE_TARGET_SLOTS;
  let record = PROJECTILE_TABLE;
  for (let i = 0; i < PAIR_COUNT; i++) {
    // Run the per-pair overlap test (ROM 0x5d68) for the current target/record against the fixed
    // source. It returns true on a miss (keep scanning) and false on a hit — a hit means it has
    // already claimed the struck record and queued the hit sound, so we abort the entire scan at
    // once and test no further pair this frame (the one-hit-per-pass rule).
    if (!loc_5d68(m, PROXIMITY_SOURCE_OBJECT, target, record)) return; // hit -> abort scan
    // On a miss, step both pointers forward to the next candidate: the target advances one sprite
    // coordinate slot (TARGET_STRIDE = 4 bytes) and the record advances one object struct
    // (RECORD_STRIDE = 0x18 bytes). Each is wrapped to a 16-bit address, matching how the hardware
    // indexes these arrays, before the next pair is tested.
    target = u16(target + TARGET_STRIDE);
    record = u16(record + RECORD_STRIDE);
  }
}

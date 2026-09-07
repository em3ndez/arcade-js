// SPDX-License-Identifier: GPL-3.0-only
//
// selectAttackerRowScan — decide which formation row a diving attacker fires from.
//
// WHAT IT IS
//   Scans ROW_OCCUPANCY (0x41e8) — the per-row OR summary of the standing formation — for the
//   first still-occupied row, then publishes a (slot index, base value) pair to loc_4213 (0x4213).
//   The starting slot/base is seeded from the alt flag loc_421b: nonzero -> slot 2 / base 157,
//   else slot 1 / base 132.
//
// ROLE IN THE MACHINE
//   The pair at loc_4213 is read by the object-AI flight-and-fire handlers
//   (advanceObjectFlightAndFire 0x0e2b, advanceHomingObjectFlightAndFire 0x0faf) as their
//   row-match count and value: when a diver's per-object counter matches the count, it releases
//   an aimed shot. So the standing formation's occupancy is what decides at which screen row the
//   divers open fire.
//
// ROM 0x15f4.  Grounding: [seen].
// LIVE-OUT: loc_4213 (slot index) and loc_4213+1 (base value).
import { loc_421b, ROW_OCCUPANCY, loc_4213 } from "./names.js";

// Up to four two-byte occupancy slots are examined before giving up.
const SLOT_COUNT = 4;

export function selectAttackerRowScan(m) {
  const { mem8 } = m;

  // Seed slot index and base from the alt flag: the two configurations pick different starting
  // rows (2/157 vs 1/132) so the two attacker variants scan from different points in the block.
  const alt = mem8[loc_421b] !== 0;
  let slot = alt ? 2 : 1;
  const base = alt ? 157 : 132;

  // Walk ROW_OCCUPANCY two bytes per slot. Both bytes of a slot share its index; a slot counts
  // as OCCUPIED if either byte has bit0 set. Advance only while a slot is fully empty, so the
  // loop stops on (and `slot` names) the first occupied row — or exhausts all four.
  let p = ROW_OCCUPANCY;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (mem8[p] & 1 || mem8[p + 1] & 1) break;
    p += 2;
    slot++;
  }

  // Publish the resulting (slot index, base value) pair for the flight-and-fire handlers to read.
  mem8[loc_4213] = slot;
  mem8[loc_4213 + 1] = base;
}

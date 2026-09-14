// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { POKEY1_RANDOM, loc_2b, loc_39, CANDIDATE_LANE_0, OBJECT_ANIM_TIMER, COORD_LIST_PTR_LO, LIST_PTR_TABLE_HI, COORD_LIST_PTR_HI, loc_29 } from "./names.js";

/**
 * selectClimberSpawnLane — choose which tube lane a new climber will spawn into. ROM 0x9abb.
 *
 * Role in the machine: when the spawner wants to release a climber it must pick one of the
 * four candidate lanes, but only a lane that already has activity (a non-empty occupancy
 * cell) is eligible. This routine starts at a POKEY-random lane and rotates through the
 * four-entry candidate table looking for the first occupied lane, giving each try a bounded
 * number of attempts. On success it builds the coordinate-list pointer for the chosen lane
 * and reports it; if no lane qualifies in four tries it reports 0 (no spawn).
 *
 * Behavior: seed the wrapping table index Y from a POKEY random ($60ca & 3) and set a
 * four-step countdown in $2b; stash the caller's X in $39. Each pass decrement the countdown
 * $2b — if it underflows (0x80 set) give up and return A = 0x00. Otherwise step Y down,
 * wrapping 0->3 at the top, read the lane id from the candidate table $149,Y (mapping the
 * value 0x03 to 0x05), and accept the lane when its occupancy/anim cell $13c,idx is non-zero.
 * On a hit, form the low pointer byte $2c = lane|0x40, set Y = 2, seat the list-high byte
 * from $9afd[2] into $2d, store index 2 back into $2b, and return A = $29.
 *
 * Live-out on a hit: $2c (coord-list pointer low = lane|0x40), $2d (coord-list pointer high),
 * $2b = 2, $39 (saved caller X); returns A = $29 (the list id). On underflow only $2b/$39 are
 * touched and A = 0. Grounding: [seen].
 */
export function selectClimberSpawnLane(m, x = m.regs.x) {
  const { mem8 } = m;
  let y = mem8[POKEY1_RANDOM] & 0x03; // POKEY random start lane (table index 0..3)
  mem8[loc_2b] = 0x04;                // four-step attempt countdown
  mem8[loc_39] = x; // stash caller X
  let idx;
  while (true) {
    const tag = u8(mem8[loc_2b] - 1); // decrement the attempt countdown
    mem8[loc_2b] = tag;
    if (tag & 0x80) return (m.regs.a = 0x00); // countdown underflow -> no eligible lane
    y = u8(y - 1);
    if (y & 0x80) y = 0x03; // wrap index to top
    idx = mem8[u16(CANDIDATE_LANE_0 + y)]; // candidate lane id from table $149,Y
    if (idx === 0x03) idx = 0x05;          // remap lane 0x03 to 0x05
    if (mem8[u16(OBJECT_ANIM_TIMER + idx)] !== 0) break; // non-empty lane qualifies
  }
  let a = mem8[u16(CANDIDATE_LANE_0 + y)] | 0x40; // low pointer byte: chosen lane | 0x40
  y = 0x02;
  mem8[COORD_LIST_PTR_LO] = a;            // seat coord-list pointer low $2c
  a = mem8[u16(LIST_PTR_TABLE_HI + y)]; // list-hi table
  mem8[loc_2b] = y;                       // leave index 2 in $2b
  mem8[COORD_LIST_PTR_HI] = a;            // seat coord-list pointer high $2d
  return (m.regs.a = mem8[loc_29]); // report the list id from $29
}

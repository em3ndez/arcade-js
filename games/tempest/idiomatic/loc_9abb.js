// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { POKEY1_RANDOM, loc_2b, loc_39, CANDIDATE_LANE_0, OBJECT_ANIM_TIMER, COORD_LIST_PTR_LO, LIST_PTR_TABLE_HI, COORD_LIST_PTR_HI, loc_29 } from "./names.js";

// Pick a random start lane, then walk four candidate lists (a countdown tag and
// a wrapping index) skipping empty lanes until one qualifies or the countdown
// underflows. On a hit, build the selected list pointer plus its tag and report
// the list id. Report 0 on underflow.
export function loc_9abb(m, x = m.regs.x) {
  const { mem8 } = m;
  let y = mem8[POKEY1_RANDOM] & 0x03; // POKEY random start lane
  mem8[loc_2b] = 0x04;
  mem8[loc_39] = x; // stash caller X
  let idx;
  while (true) {
    const tag = u8(mem8[loc_2b] - 1);
    mem8[loc_2b] = tag;
    if (tag & 0x80) return (m.regs.a = 0x00); // countdown underflow
    y = u8(y - 1);
    if (y & 0x80) y = 0x03; // wrap index to top
    idx = mem8[u16(CANDIDATE_LANE_0 + y)];
    if (idx === 0x03) idx = 0x05;
    if (mem8[u16(OBJECT_ANIM_TIMER + idx)] !== 0) break; // non-empty lane qualifies
  }
  let a = mem8[u16(CANDIDATE_LANE_0 + y)] | 0x40;
  y = 0x02;
  mem8[COORD_LIST_PTR_LO] = a;
  a = mem8[u16(LIST_PTR_TABLE_HI + y)]; // list-hi table
  mem8[loc_2b] = y;
  mem8[COORD_LIST_PTR_HI] = a;
  return (m.regs.a = mem8[loc_29]);
}

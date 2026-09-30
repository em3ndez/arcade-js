// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyAtFastestSpeed — fly one object a single step at the fastest pace in the velocity-table ladder.
 *
 * WHAT IT IS: ROM 0x58A4-0x58A9, tag [seen] (names.js ROUTINES 0x58a4). The whole ROM routine is two
 * instructions, `ld hl,0x08fa / jp 0x58bc`: it picks one fixed table of velocity samples and hands over
 * to the shared flier, flyAlongHeading. Choosing that table is the whole of what this entry does; a
 * pointer a caller held on the way in (the ROM's HL) is discarded.
 *
 * WHY "FASTEST": every entry into flyAlongHeading is a shim like this one fixing one table, and the
 * tables are one waveform scaled by its own peak, so a table IS a speed. The ROM holds a six-rung ladder
 * of peaks, 206/231/256/281/306/331; this table, VELOCITY_TABLE_08FA, peaks at 331, the top rung.
 * "Fastest" is a rank over the tables: a double-velocity mover on a slower table can still move farther
 * per step (names.js "why" for 0x58a4).
 *
 * ROLE IN THE MACHINE: its one caller is serviceEra3EnemyCraftSlot, the fourth era's per-slot enemy
 * handler -- gameplay.md's fourth-era jets that are "as fast ... as you".
 *
 * LIVE-OUT: memory (the object's coordinates, written by the flier).
 */

import { flyAlongHeading } from "./flyAlongHeading.js";
import { VELOCITY_TABLE_08FA } from "./names.js";

/*
 * The velocity table at ROM 0x08FA -- also the pace scrollWorldAtTheEraPace uses from era 3 up. The same
 * address doubles as the anti-tamper checksum-failure landing (names.js), which is why its name is an
 * address rather than a role.
 */
const VELOCITY_TABLE = VELOCITY_TABLE_08FA;

/*
 * `object` is the object's record (the ROM's IX) and `sprite` its sprite entry (the ROM's IY), both
 * passed straight through; flyAlongHeading reads the heading from the record and moves the sprite entry
 * one step, the world scroll included.
 */
export function flyAtFastestSpeed(m, object = m.regs.ix, sprite = m.regs.iy) {
  flyAlongHeading(m, VELOCITY_TABLE, object, sprite);
}

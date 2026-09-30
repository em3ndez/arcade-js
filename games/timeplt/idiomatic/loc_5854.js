// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_5854 — fly one object a single step at the pace the velocity samples based at 0x5E00 set.
 *
 * WHAT IT IS: ROM 0x5854-0x5859, tag [seen] (names.js ROUTINES 0x5854). The whole ROM routine is
 * `ld hl,0x5e00 / jp 0x58bc`: it fixes one table of velocity samples and hands over to the shared flier,
 * flyAlongHeading. Choosing that table is the whole of what this entry does; a pointer a caller held on
 * the way in (the ROM's HL) is discarded.
 *
 * ROLE IN THE MACHINE: one of the two-instruction shims into flyAlongHeading, each of which fixes one
 * table and so one speed. This one uses the opening era's table -- the pace scrollWorldAtTheEraPace
 * gives era 0 (names.js OPENING_ERA_VELOCITY_TABLE). It keeps a hex name: names.js records its role but
 * gives it no descriptive name.
 *
 * LIVE-OUT: memory (the object's coordinates, written by the flier).
 */

import { flyAlongHeading } from "./flyAlongHeading.js";
import { OPENING_ERA_VELOCITY_TABLE } from "./names.js";

/* The velocity table at ROM 0x5E00, the opening era's pace. */
const VELOCITY_TABLE = OPENING_ERA_VELOCITY_TABLE;

/*
 * `object` is the object's record (the ROM's IX) and `sprite` its sprite entry (the ROM's IY), passed
 * straight through; the flier reads the heading from the record and moves the sprite entry one step,
 * the world scroll included.
 */
export function loc_5854(m, object = m.regs.ix, sprite = m.regs.iy) {
  flyAlongHeading(m, VELOCITY_TABLE, object, sprite);
}

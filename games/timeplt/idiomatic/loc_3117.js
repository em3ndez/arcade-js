// SPDX-License-Identifier: GPL-3.0-only
/** loc_3117 — seat four scenery objects, then run the frame's scenery. A sentinel pair guards the
 * entry: unless the first byte reads exactly and the second is one of two values, control leaves
 * without seating anything. When it passes, four rows of a packed table each fill a sprite cell and
 * the shadow cell above it, stepping the entry cursor by four a row, and control hands on to the
 * scenery run. LIVE-OUT: memory. */

import { loc_3114 } from "./loc_3114.js";
import { runSceneryForEra } from "./runSceneryForEra.js";

const SENTINEL = 0xad39;
const OBJECT_TABLE = 0x316e;
const FIRST_ENTRY = 0xaa30;
const OBJECTS = 4;

export function loc_3117(m) {
  const { regs, mem8 } = m;

  // The sentinel pointer and the byte under it both ride on into the transfer, which reads them,
  // so walk the pair with the real cursor and value.
  regs.hl = SENTINEL;
  regs.a = mem8[regs.hl];
  if (regs.a !== 0x68) return loc_3114(m);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem8[regs.hl];
  if (regs.a !== 0x10 && regs.a !== 0x05) return loc_3114(m);

  regs.hl = OBJECT_TABLE;
  regs.iy = FIRST_ENTRY;
  regs.b = OBJECTS;
  do {
    const tint = mem8[regs.hl];
    mem8[(regs.iy + 0x31) & 0xffff] = tint;
    mem8[(regs.iy + 0x33) & 0xffff] = (tint + 0x10) & 0xff;
    const shape = mem8[(regs.hl + 1) & 0xffff];
    mem8[regs.iy & 0xffff] = shape;
    mem8[(regs.iy + 2) & 0xffff] = shape;
    regs.hl = (regs.hl + 2) & 0xffff;
    regs.iy = (regs.iy + 4) & 0xffff;
    regs.b = (regs.b - 1) & 0xff;
  } while (regs.b !== 0);

  return runSceneryForEra(m);
}

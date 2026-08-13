// SPDX-License-Identifier: GPL-3.0-only
/** seedSceneryEntriesThenRunScenery — seat four scenery objects, then run the frame's scenery. A sentinel pair guards the
 * entry: unless the first byte reads exactly and the second is one of two values, control leaves
 * without seating anything. When it passes, four rows of a packed table each fill a sprite cell and
 * the shadow cell above it, stepping the entry cursor by four a row, and control hands on to the
 * scenery run. LIVE-OUT: memory. */

import { trampolineToLoc_307f } from "./trampolineToLoc_307f.js";
import { runSceneryForEra } from "./runSceneryForEra.js";
import { SCENERY_ENTRY_SLOT0, TAMPER_WITNESS, SCENERY_SEED_TABLE } from "./names.js";

const OBJECTS = 4;

export function seedSceneryEntriesThenRunScenery(m) {
  const { regs, mem8 } = m;

  // The sentinel pointer and the byte under it both ride on into the transfer, which reads them,
  // so walk the pair with the real cursor and value.
  regs.hl = TAMPER_WITNESS;
  regs.a = mem8[regs.hl];
  if (regs.a !== 0x68) return trampolineToLoc_307f(m);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem8[regs.hl];
  if (regs.a !== 0x10 && regs.a !== 0x05) return trampolineToLoc_307f(m);

  regs.hl = SCENERY_SEED_TABLE;
  regs.iy = SCENERY_ENTRY_SLOT0;
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

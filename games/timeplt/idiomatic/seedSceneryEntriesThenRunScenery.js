// SPDX-License-Identifier: GPL-3.0-only
/** seedSceneryEntriesThenRunScenery — seat four scenery objects, then run the frame's scenery. A sentinel pair guards the
 * entry: unless the first byte reads exactly and the second is one of two values, control leaves
 * without seating anything. When it passes, four rows of a packed table each fill a sprite cell and
 * the shadow cell above it, stepping the entry cursor by four a row, and control hands on to the
 * scenery run. On the seat arm every register the body touches is dead-after-return scratch — the
 * scenery run reseats both cursors before reading either — so it lives here as JS locals. The divert
 * arm is different: the lifted destination stores the caller's clear stride through the walked pointer,
 * folds the byte under it, counts the caller's spent clear count down (wrapping, so it keeps to its
 * one-tile arm) and places one tile through the caller's entry cursor offset by the era -- so the
 * pointer, the byte, the era, the cursor, the stride and the count are all handed across.
 * LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { trampolineToLoc_307f } from "./trampolineToLoc_307f.js";
import { runSceneryForEra } from "./runSceneryForEra.js";
import { SCENERY_ENTRY_SLOT0, TAMPER_WITNESS, SCENERY_SEED_TABLE } from "./names.js";

const OBJECTS = 4;
const SENTINEL_MATCH = 0x68;
const SUBGUARD_A = 0x10;
const SUBGUARD_B = 0x05;
const SEED_STRIDE = 2; // packed (tint,shape) pair a row
const SEAT_STRIDE = 4; // entry cursor steps four slots a row
const SPRITE_TINT = 0x31; // tint lands at entry +value 0x31
const SHADOW_TINT = 0x33; // the shadow cell above it
const TINT_STEP = 0x10; // shadow tint = sprite tint plus this

export function seedSceneryEntriesThenRunScenery(m, era = m.regs.c, entryCursor = m.regs.iy, clearStride = m.regs.e, clearCount = m.regs.b) {
  const { mem8 } = m;

  // The sentinel pointer and the byte under it both ride on into the divert, with the caller's inputs.
  const divert = (guard, sentinel) =>
    trampolineToLoc_307f(m, guard, clearStride, sentinel, clearCount, entryCursor, era);
  let guard = TAMPER_WITNESS;
  let sentinel = mem8[guard];
  if (sentinel !== SENTINEL_MATCH) return divert(guard, sentinel);
  guard = u16(guard + 1);
  sentinel = mem8[guard];
  if (sentinel !== SUBGUARD_A && sentinel !== SUBGUARD_B) return divert(guard, sentinel);

  let src = SCENERY_SEED_TABLE;
  let entry = SCENERY_ENTRY_SLOT0;
  for (let n = OBJECTS; n !== 0; n--) {
    const tint = mem8[src];
    mem8[u16(entry + SPRITE_TINT)] = tint;
    mem8[u16(entry + SHADOW_TINT)] = tint + TINT_STEP;
    const shape = mem8[u16(src + 1)];
    mem8[entry] = shape;
    mem8[u16(entry + 2)] = shape;
    src = u16(src + SEED_STRIDE);
    entry = u16(entry + SEAT_STRIDE);
  }

  return runSceneryForEra(m);
}

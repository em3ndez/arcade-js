// SPDX-License-Identifier: GPL-3.0-only
/** clearSceneryEntriesThenRunEraScenery — clear a stride-two run of eight object cells to the fill byte the caller hands in A,
 * then branch on the era and two runtime guards. Below era four one path seats and runs the whole
 * frame's scenery; at era four and up, when the guard pair reads its expected values a second packed
 * table fills eight entry cells before the scenery runs; a guard that reads wrong transfers into a
 * data table and faults. LIVE-OUT: memory. Every register the body touches is dead-after-return
 * scratch — each returning arm hands on to a callee (seedScenery / runSceneryForEra) that reseats
 * both cursors, and the guard-fail arm transfers into a fault — so the scratch lives here as JS
 * locals; only the two caller inputs (fill byte in A, era in C) stay boundary-seated. */

import { u16 } from "../../../core/int.js";
import { seedSceneryEntriesThenRunScenery } from "./seedSceneryEntriesThenRunScenery.js";
import { loc_315b } from "./loc_315b.js";
import { runSceneryForEra } from "./runSceneryForEra.js";
import { SCENERY_ENTRY_SLOT0, SCENERY_SPRITE_ATTRIBUTE_SLOT0, TAMPER_GLYPH_KONAMI, ERA4_SCENERY_SEED_TABLE } from "./names.js";

const CLEAR_COUNT = 8;
const CLEAR_STRIDE = 2;
const ERA_FLOOR = 0x04;
const GUARD_OK = 0x3b;
const SUBGUARD_A = 0x05;
const SUBGUARD_B = 0x10;
const SEAT_COUNT = 8;
const SEAT_SHADOW = 0x31; // byte0 of each packed pair lands at the entry cell +0x31

export function clearSceneryEntriesThenRunEraScenery(m, fillByte = m.regs.a, era = m.regs.c) {
  const { mem8 } = m;

  // clear eight object cells, stride two, to the fill byte
  let clearAddr = SCENERY_SPRITE_ATTRIBUTE_SLOT0;
  for (let n = CLEAR_COUNT; n !== 0; n--) {
    mem8[clearAddr] = fillByte;
    clearAddr = u16(clearAddr + CLEAR_STRIDE);
  }

  if (era < ERA_FLOOR) return seedSceneryEntriesThenRunScenery(m);

  let guardAddr = TAMPER_GLYPH_KONAMI;
  if (mem8[guardAddr] !== GUARD_OK) return loc_315b(m);
  guardAddr = u16(guardAddr + 1);
  const sub = mem8[guardAddr];
  if (sub !== SUBGUARD_A && sub !== SUBGUARD_B) return loc_315b(m);

  // era-four seed: eight packed pairs fill each entry cell and its shadow at +0x31
  let src = ERA4_SCENERY_SEED_TABLE;
  let entry = SCENERY_ENTRY_SLOT0;
  for (let n = SEAT_COUNT; n !== 0; n--) {
    mem8[u16(entry + SEAT_SHADOW)] = mem8[src];
    src = u16(src + 1);
    mem8[entry] = mem8[src];
    src = u16(src + 1);
    entry = u16(entry + 2);
  }

  return runSceneryForEra(m);
}

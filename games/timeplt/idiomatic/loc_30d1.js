// SPDX-License-Identifier: GPL-3.0-only
/** loc_30d1 — clear a stride-two run of eight object cells to the fill byte the caller hands in A,
 * then branch on the era and two runtime guards. Below era four one path seats and runs the whole
 * frame's scenery; at era four and up, when the guard pair reads its expected values a second packed
 * table fills eight entry cells before the scenery runs; a guard that reads wrong transfers into a
 * data table and faults. LIVE-OUT: memory. */

import { seedSceneryEntriesThenRunScenery } from "./seedSceneryEntriesThenRunScenery.js";
import { loc_315b } from "./loc_315b.js";
import { runSceneryForEra } from "./runSceneryForEra.js";

const CLEAR_BASE = 0xaa60;
const CLEAR_COUNT = 8;
const ERA_FLOOR = 0x04;
const GUARD = 0xacc7;
const GUARD_OK = 0x3b;
const SUBGUARD_A = 0x05;
const SUBGUARD_B = 0x10;
const SEAT_TABLE = 0x315e;
const FIRST_ENTRY = 0xaa30;
const SEAT_COUNT = 8;

export function loc_30d1(m) {
  const { regs, mem8 } = m;

  regs.hl = CLEAR_BASE;
  regs.de = 0x0002;
  regs.b = CLEAR_COUNT;
  do {
    mem8[regs.hl] = regs.a;
    regs.hl = (regs.hl + regs.de) & 0xffff;
    regs.b = (regs.b - 1) & 0xff;
  } while (regs.b !== 0);

  regs.a = regs.c;
  regs.cp(ERA_FLOOR);
  if (regs.fC) return seedSceneryEntriesThenRunScenery(m);

  regs.hl = GUARD;
  regs.a = mem8[regs.hl];
  regs.cp(GUARD_OK);
  if (regs.fNZ) return loc_315b(m);

  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem8[regs.hl];
  regs.cp(SUBGUARD_A);
  if (regs.fNZ) {
    regs.cp(SUBGUARD_B);
    if (regs.fNZ) return loc_315b(m);
  }

  regs.b = SEAT_COUNT;
  regs.iy = FIRST_ENTRY;
  regs.hl = SEAT_TABLE;
  do {
    regs.a = mem8[regs.hl];
    mem8[(regs.iy + 0x31) & 0xffff] = regs.a;
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.a = mem8[regs.hl];
    mem8[regs.iy & 0xffff] = regs.a;
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.iy = (regs.iy + 2) & 0xffff;
    regs.b = (regs.b - 1) & 0xff;
  } while (regs.b !== 0);

  return runSceneryForEra(m);
}

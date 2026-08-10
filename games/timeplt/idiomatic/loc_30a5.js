// SPDX-License-Identifier: GPL-3.0-only
/** loc_30a5 — seat one era-keyed object band, then hand the frame's scenery on. A fixed run is
 * summed against a constant as a tamper tripwire whose answer is dropped, eight bytes of the row the
 * era indexes are copied into a stride-two cell run, and control transfers into the scenery clear +
 * run: at era four with the fill byte 0x28, otherwise 0xCC. LIVE-OUT: memory (the seated band and
 * whatever the scenery chain leaves); control leaves through the tail and does not return. */

import { sumByteRunAndCompareToExpected } from "./sumByteRunAndCompareToExpected.js";
import { offsetAddress } from "./offsetAddress.js";
import { seatSceneryFillByte0x28ThenClearEraScenery } from "./seatSceneryFillByte0x28ThenClearEraScenery.js";
import { clearSceneryEntriesThenRunEraScenery } from "./clearSceneryEntriesThenRunEraScenery.js";
import { u8, u16 } from "../../../core/int.js";

const CHECK_BASE = 0x086b;
const CHECK_LEN = 0x10;
const CHECK_EXPECTED = 0x22;
const ERA_INDEX = 0xad04;
const ROW_TABLE = 0x3176;
const ROW_STRIDE = 8;
const SEAT_BASE = 0xaa31;
const SEAT_STRIDE = 2;
const SEAT_COUNT = 8;
const ERA_FOUR = 0x04;
const FILL_BYTE = 0xcc;

export function loc_30a5(m) {
  const { regs, mem8 } = m;

  regs.hl = CHECK_BASE;
  regs.c = CHECK_EXPECTED;
  regs.b = CHECK_LEN;
  sumByteRunAndCompareToExpected(m); // tamper checksum; its answer is discarded here

  regs.a = u8(mem8[ERA_INDEX] * ROW_STRIDE);
  regs.c = regs.a;
  regs.hl = ROW_TABLE;
  offsetAddress(m); // hl = ROW_TABLE + 8*era

  regs.de = SEAT_BASE;
  regs.b = SEAT_COUNT;
  do {
    regs.a = mem8[regs.hl];
    mem8[regs.de] = regs.a;
    regs.hl = u16(regs.hl + 1);
    regs.de = u16(regs.de + SEAT_STRIDE);
    regs.b = u8(regs.b - 1);
  } while (regs.b !== 0);

  regs.a = mem8[ERA_INDEX];
  regs.cp(ERA_FOUR);
  regs.c = regs.a;
  if (regs.fZ) return seatSceneryFillByte0x28ThenClearEraScenery(m);
  regs.a = FILL_BYTE;
  return clearSceneryEntriesThenRunEraScenery(m);
}

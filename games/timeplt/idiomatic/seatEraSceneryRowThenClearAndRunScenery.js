// SPDX-License-Identifier: GPL-3.0-only
/** seatEraSceneryRowThenClearAndRunScenery — seat one era-keyed object band, then hand the frame's scenery on. A fixed run is
 * summed against a constant as a tamper tripwire whose answer is dropped, eight bytes of the row the
 * era indexes are copied into a stride-two cell run, and control transfers into the scenery clear +
 * run: at era four with the fill byte 0x28, otherwise 0xCC. The era rides into the callee seated in C.
 * LIVE-OUT: memory (the seated band and whatever the scenery chain leaves); control leaves through the
 * tail and does not return. */

import { sumByteRunAndCompareToExpected } from "./sumByteRunAndCompareToExpected.js";
import { offsetAddress } from "./offsetAddress.js";
import { seatSceneryFillByte0x28ThenClearEraScenery } from "./seatSceneryFillByte0x28ThenClearEraScenery.js";
import { clearSceneryEntriesThenRunEraScenery } from "./clearSceneryEntriesThenRunEraScenery.js";
import { u8, u16 } from "../../../core/int.js";
import { SCENERY_SPRITE_CODE_SLOT0, ERA_INDEX, BOOT_CONFIG_CHECKSUM_BASE, loc_3176 } from "./names.js";

const CHECK_LEN = 0x10;
const CHECK_EXPECTED = 0x22;
const ROW_STRIDE = 8;
const SEAT_STRIDE = 2;
const SEAT_COUNT = 8;
const ERA_FOUR = 0x04;
const FILL_BYTE = 0xcc;

export function seatEraSceneryRowThenClearAndRunScenery(m) {
  const { mem8 } = m;

  sumByteRunAndCompareToExpected(m, BOOT_CONFIG_CHECKSUM_BASE, CHECK_LEN, CHECK_EXPECTED); // tamper checksum; its answer is discarded here

  const era = mem8[ERA_INDEX];
  let src = offsetAddress(m, loc_3176, u8(era * ROW_STRIDE)); // row table + 8*era
  let dst = SCENERY_SPRITE_CODE_SLOT0;
  for (let n = SEAT_COUNT; n !== 0; n--) {
    mem8[dst] = mem8[src];
    src = u16(src + 1);
    dst = u16(dst + SEAT_STRIDE);
  }

  // the era rides into the scenery chain seated in C; fill byte 0x28 at era four, else 0xCC
  if (era === ERA_FOUR) return (m.regs.c = era, seatSceneryFillByte0x28ThenClearEraScenery(m));
  return (m.regs.c = era, clearSceneryEntriesThenRunEraScenery(m, FILL_BYTE));
}

// SPDX-License-Identifier: GPL-3.0-only
/** copyThreeTilemapCellsFromBothPlanes — take a copy of three tilemap cells, each into its own two-byte keep.
 * A table in the program image supplies three records of two addresses: where to read, and where
 * to put what was read. Each cell is read TWICE, a fixed distance apart, because the two planes of
 * the tilemap sit that far from one another — so what a keep holds is the pair of bytes belonging
 * to ONE cell, not two cells. The pair is stored the second read first. Both of the arithmetic
 * steps are deliberately narrow: the distance is added to the high half of the source alone and
 * the keep is stepped in its low half alone, so either would wrap inside its own page rather than
 * carry out of it. LIVE-OUT: memory, six bytes. */

import { u8, u16 } from "../../../core/int.js";

const RECORDS = 0x0d1b;
const CELLS = 3;
const PLANE_GAP_HIGH = 4;

export function copyThreeTilemapCellsFromBothPlanes(m) {
  const { mem8, mem16 } = m;
  let record = RECORDS;
  for (let i = 0; i < CELLS; i++) {
    const source = mem16[record];
    const keep = mem16[u16(record + 2)];
    record = u16(record + 4);

    const first = mem8[source];
    const otherPlane = (u8((source >> 8) + PLANE_GAP_HIGH) << 8) | (source & 0xff);
    const second = mem8[otherPlane];

    mem8[keep] = second;
    mem8[(keep & 0xff00) | u8(keep + 1)] = first;
  }
}

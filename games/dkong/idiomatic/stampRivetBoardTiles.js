import { u16 } from "../../../core/int.js";
import {
  RIVET_TILE_DEST_TABLE,
} from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampRivetBoardTiles — during rivet-board setup, walk an eight-entry little-endian pointer table
 * and stamp the fixed tile pair 0xB8 then 0xB7 into each destination cell pair.
 *
 * LIVE-OUT: memory-only — the 16 video-RAM bytes.
 */


export function stampRivetBoardTiles(m) {
  const { mem8 } = m;

  for (let i = 0, ptr = RIVET_TILE_DEST_TABLE; i < 8; i++, ptr += 2) {
    const dest = mem8[ptr] | (mem8[ptr + 1] << 8);
    mem8[dest] = 0xb8;
    mem8[u16(dest + 1)] = 0xb7;
  }
}

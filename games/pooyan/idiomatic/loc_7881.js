// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  ATTRACT_FIELD_ATTRIB_SRC,
  ROM_BLOCK_CHECKSUM_TABLE,
  PLAYFIELD_CHECKSUM_VRAM_BASE,
  ENEMY_ACTOR_TABLE,
  ATTRACT_SUBSTATE,
} from "./names.js";
import { loc_0010 } from "./loc_0010.js";
import { loc_0320 } from "./loc_0320.js";
import { loc_77c8 } from "./loc_77c8.js";
/**
 * loc_7881 — periodic self-integrity check dispatched over an actor slot.
 *
 * Ticks the slot's frame countdown and returns until it reaches zero. Then it runs two checks:
 *  1. Program-image sum — nine 32-byte blocks summed into a running 16-bit total, each block's
 *     cumulative total compared against the expected-total table; any drift aborts to the caller.
 *  2. Playfield sum — a serpentine 16-bit sum over two adjacent tile columns; if (low + high + 0xa6)
 *     is nonzero the image is bad, so it hands off to the flip/tamper tick.
 * On a clean image it sets the attract sub-state, clears the enemy-actor arena and its trailing
 * block, and re-seeds the actor slot.
 *
 * LIVE-OUT: none — a void integrity pass; the caller reads nothing back.
 */
const BLOCKS = 0x09; //       program-image blocks summed
const BLOCK_BYTES = 0x20; //  bytes per block
const COL_CELLS = 0x0c; //    tile cells per playfield column
const ROW = 0x20; //          one tile row (column step)
const SENTINEL_BIAS = 0xa6; // added to the playfield sum's folded bytes; a clean image folds to 0
const TRAILING_CLEAR = 0x37; // bytes cleared after the enemy-actor arena
const FRAME_DELAY = 0x11; //  actor-record frame-delay offset

export function loc_7881(m, record = m.regs.ix) {
  const { mem8 } = m;

  mem8[record + FRAME_DELAY] = u8(mem8[record + FRAME_DELAY] - 1);
  if (mem8[record + FRAME_DELAY] !== 0) return; // act only on the frame the countdown expires

  // 1. program-image integrity: cumulative 16-bit total checked block by block.
  let table = ROM_BLOCK_CHECKSUM_TABLE;
  let src = ATTRACT_FIELD_ATTRIB_SRC;
  let romSum = 0;
  for (let block = 0; block < BLOCKS; block++) {
    for (let i = 0; i < BLOCK_BYTES; i++) {
      romSum = u16(romSum + mem8[src]);
      src = u16(src + 1);
    }
    if (mem8[table] !== (romSum & 0xff) || mem8[table + 1] !== (romSum >> 8)) return; // drifted -> abort
    table = u16(table + 2);
  }

  mem8[ATTRACT_SUBSTATE] = 0x02;

  // 2. playfield integrity: serpentine sum down the first column, then up the adjacent one.
  let fieldSum = 0;
  let cell = PLAYFIELD_CHECKSUM_VRAM_BASE;
  for (let i = 0; i < COL_CELLS; i++) {
    fieldSum = u16(fieldSum + mem8[cell]);
    cell = u16(cell + ROW);
  }
  cell = u16(cell + 1); // cross to the adjacent column
  for (let i = 0; i < COL_CELLS; i++) {
    fieldSum = u16(fieldSum + mem8[cell]);
    cell = u16(cell - ROW);
  }
  if ((((fieldSum & 0xff) + (fieldSum >> 8) + SENTINEL_BIAS) & 0xff) !== 0) return loc_0320(m, fieldSum); // bad image

  const trailing = loc_0010(m, ENEMY_ACTOR_TABLE, 0x00, 0x00); // clear the arena (a zero count fills 256)
  loc_0010(m, trailing, 0x00, TRAILING_CLEAR); // clear the trailing block
  loc_77c8(m, record); // re-seed the actor slot
}

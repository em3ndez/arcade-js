// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2bd2 } from "./loc_2bd2.js";
import { loc_2bb3 } from "./loc_2bb3.js";
import { loc_2b8d } from "./loc_2b8d.js";
import {
  RESET_ATTR_COLUMN,
  HUD_INTEGRITY_STRIP_A,
  RESET_SCAN_LATCH,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
} from "./names.js";
/**
 * loc_2b59 — integrity-strip reset scan.
 *
 * First blanks an eight-tall attribute column (one tile-row up each pass) to the base attribute
 * value. Then checksums a ten-byte integrity strip on the same upward stride; unless it sums to
 * the magic total it returns with nothing more changed. On the magic sum it clears the reset latch
 * and hands off by the two-player and active-player flags: to the ready-sprite painter, to the
 * formation-spawn scan, or into the shared spawn epilogue.
 *
 * LIVE-OUT: none — memory only; every branch tail-delegates or returns void.
 */
const COLUMN_ROWS = 0x08; // attribute cells blanked, one tile-row apart
const STRIP_BYTES = 0x0a; // integrity-strip bytes summed
const ROW_STRIDE = 0x20; // tile-grid row pitch, walked upward
const BLANK_ATTR = 0x10; // value written into each blanked cell
const MAGIC_SUM = 0xaa; // checksum total that authorizes the reset
const SCAN_STRIDE = -0x20; // formation-scan step this caller establishes

export function loc_2b59(m) {
  const { mem8 } = m;

  let cell = RESET_ATTR_COLUMN;
  for (let i = 0; i < COLUMN_ROWS; i++) {
    mem8[cell] = BLANK_ATTR;
    cell = u16(cell - ROW_STRIDE);
  }

  let sum = 0;
  let src = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < STRIP_BYTES; i++) {
    sum = (sum + mem8[src]) & 0xff;
    src = u16(src - ROW_STRIDE);
  }
  if (sum !== MAGIC_SUM) return; // checksum mismatch -> leave the rest untouched

  mem8[RESET_SCAN_LATCH] = 0x00;
  if (mem8[TWO_PLAYER_FLAG] === 0) return loc_2bd2(m); // single player -> ready-sprite painter
  // player-2 idle -> formation-spawn scan; forward the inherited IX base default, but establish
  // this caller's own upward stride rather than a stale register.
  if (mem8[ACTIVE_PLAYER] === 0) return loc_2bb3(m, undefined, SCAN_STRIDE);
  return loc_2b8d(m); // shared spawn epilogue
}

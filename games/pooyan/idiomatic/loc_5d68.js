// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { queueSoundCommand11 } from "./queueSoundCommand11.js";
import { FLIP_SCREEN_FLAG, PROXIMITY_HIT_HANDLER } from "./names.js";
/**
 * loc_5d68 — proximity test between a source object and one target/record pair.
 *
 * The record's state byte gates the test (state 0 or 5 means "no test"). A
 * bounding-box offset is chosen by the flip-screen flag and added to the source
 * X/Y; the target counts as a hit when it lies within |dx| < 4 and |dy| in
 * [9, 0x0f). On a hit the struck record's fields and its post-hit handler pointer
 * are re-seeded and the sound-command stub is fired.
 *
 * Returns true on every no-hit path (the caller keeps scanning) and false on a hit
 * (the caller aborts its scan). LIVE-OUT: none — the boolean is the only result a
 * caller consumes; the target and record pointers are left unchanged on no-hit.
 */

const RECORD_EMPTY = 0x00; // record state that skips the test
const RECORD_RESERVED = 0x05; // record state that also skips the test
const OFFSET_X_UPRIGHT = 0xfc; // source-X box offset (-4) when the screen is upright
const OFFSET_X_FLIPPED = 0x05; // source-X box offset when the screen is flipped
const OFFSET_Y_FLIPPED = 0x10; // source-Y box offset when the screen is flipped
const DX_LIMIT = 0x04; // |dx| must be strictly under this
const DY_MIN = 0x09; // |dy| must be at least this
const DY_MAX = 0x0f; // |dy| must be strictly under this
const TARGET_Y_BIAS = 0x08; // added to the target Y before the dy compare

export function loc_5d68(m, source = m.regs.ix, target = m.regs.iy, record = m.regs.hl) {
  const { mem8 } = m;

  const state = mem8[record];
  if (state === RECORD_EMPTY || state === RECORD_RESERVED) return true;

  let offX = OFFSET_X_UPRIGHT;
  let offY = 0x00;
  if (mem8[FLIP_SCREEN_FLAG] === 0) {
    offX = OFFSET_X_FLIPPED;
    offY = OFFSET_Y_FLIPPED;
  }

  const boxX = (mem8[source] + offX) & 0xff;
  const boxY = (mem8[u16(source + 2)] + offY) & 0xff;

  const tx = mem8[target];
  let dx = (tx - boxX) & 0xff;
  if (tx < boxX) dx = (-dx) & 0xff; // absolute horizontal distance
  if (dx >= DX_LIMIT) return true;

  const ty = (mem8[u16(target + 2)] + TARGET_Y_BIAS) & 0xff;
  let dy = (ty - boxY) & 0xff;
  if (ty < boxY) dy = (-dy) & 0xff; // absolute vertical distance
  if (dy < DY_MIN || dy >= DY_MAX) return true;

  mem8[record] = 0x00;
  mem8[u16(record + 1)] = 0x01;
  mem8[u16(record + 2)] = 0x0c;
  mem8[u16(record + 7)] = 0x01;
  mem8[u16(record + 0x12)] = PROXIMITY_HIT_HANDLER;
  mem8[u16(record + 0x13)] = (PROXIMITY_HIT_HANDLER >> 8);
  queueSoundCommand11(m);
  return false;
}

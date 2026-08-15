// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearObjectBlocksAndMirrorToObjRam — clear the demo work-RAM object block, mirror it into OBJRAM, then clear a second block.
 * Zeroes a 44-byte block, copies its now-zero head into the OBJRAM mirror, then zeroes a 99-byte block.
 * LIVE-OUT: memory-only.
 */
import { LIVE_OBJECT_PAGE, loc_b00c, SPRITE_BLOCK2_BASE } from "./names.js";

const OBJECT_BLOCK = 44;
const MIRROR_BYTES = 43;
const SPRITE_BLOCK = 99;

export function clearObjectBlocksAndMirrorToObjRam(m) {
  const { mem8 } = m;
  for (let i = 0; i < OBJECT_BLOCK; i++) mem8[LIVE_OBJECT_PAGE + i] = 0;
  for (let i = 0; i < MIRROR_BYTES; i++) mem8[loc_b00c + i] = mem8[LIVE_OBJECT_PAGE + i];
  for (let i = 0; i < SPRITE_BLOCK; i++) mem8[SPRITE_BLOCK2_BASE + i] = 0;
}

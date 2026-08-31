// SPDX-License-Identifier: GPL-3.0-only
import { paintReadySpriteSquareIfAbsent } from "./paintReadySpriteSquareIfAbsent.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { FORMATION_READY_TILE_VRAM, READY_SPRITE_SRC } from "./names.js";
/**
 * loc_2bbf — formation ready-sprite helper, driven by the wave-arrival count `a` (< 2 when
 * its caller invokes it). If a == 1 it just stamps the ready-sprite square. Otherwise it checks the
 * formation indicator cell: if the painted marker is already there the step is skipped; if not,
 * it blits the indicator tile then stamps the ready-sprite square.
 *
 * Caller-skip signal: the boolean return drives the caller. true = normal (the caller continues);
 * false = skip (marker present, the caller aborts). LIVE-OUT: memory only.
 */

const READY = 0x01; // wave count that means the indicator is already staged elsewhere
const PAINTED_MARKER = 0xba; // indicator cell value once the square is present

export function loc_2bbf(m, a = m.regs.a) {
  const { mem8 } = m;

  if (a === READY) {
    paintReadySpriteSquareIfAbsent(m); // stamp the ready-sprite square
    return true;
  }

  if (mem8[FORMATION_READY_TILE_VRAM] === PAINTED_MARKER) return false; // already present -> caller skips

  blit2x2TileBlock(m, FORMATION_READY_TILE_VRAM, READY_SPRITE_SRC); // paint the indicator tile
  paintReadySpriteSquareIfAbsent(m); // then stamp the ready-sprite square
  return true;
}

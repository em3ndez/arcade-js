// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { movePlayerDownAndTickStatusRender } from "./movePlayerDownAndTickStatusRender.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { retreatTileAnimScript } from "./retreatTileAnimScript.js";
import { wrapRenderPhaseAndPaintTileTriplet } from "./wrapRenderPhaseAndPaintTileTriplet.js";
import {
  STATUS_RENDER_RING,
  STATUS_RENDER_PHASE,
  TILE_ANIM_CURSOR,
  INTEGRITY_FLAG_SCAN_BASE,
} from "./names.js";
/**
 * movePlayerVerticallyAndTickStatusRender — bidirectional position driver for the actor at IX.
 *
 * Bit 2 of the aim byte selects the direction: clear steps the actor down (the descent
 * handler), set steps it up here — position decremented and clamped to a low bound, then the
 * derived sprite Ys refreshed. The rising ring counter then advances unless the tile-anim
 * cursor sits at its sentinel over a low tile while every integrity flag is clear (no work).
 * On a ring wrap the mod-4 phase advances and the shared render tail redraws.
 *
 * LIVE-OUT: none — a void driver; the caller reads nothing back.
 */
const OFF_POS_Y = 0x04; //     (IX+4) actor vertical position
const OFF_AIM_FLAGS = 0x07; // (IX+7) aim/direction flags
const DESCEND_BIT = 0x04; //   aim bit 2: clear -> descent, set -> rise
const POS_MIN = 0x41; //       low clamp for the rise position
const RISE_CURSOR_SENTINEL = 0xe6; // cursor low byte that arms the integrity gate
const CURSOR_TILE_GATE = 0x35; //    below this tile at the cursor the gate applies
const INTEGRITY_FLAG_COUNT = 7; //   flags scanned before the ring advances
const RING_MASK = 0x07; //           ring counter wraps mod 8

export function movePlayerVerticallyAndTickStatusRender(m, actor = m.regs.ix) {
  const { mem8, mem16 } = m;

  if ((mem8[actor + OFF_AIM_FLAGS] & DESCEND_BIT) === 0) {
    return movePlayerDownAndTickStatusRender(m, actor); // bit 2 clear -> descent handler
  }

  // ===== rise: step the position up (dec), clamp to the low bound =====
  const y = u8(mem8[actor + OFF_POS_Y] - 1);
  mem8[actor + OFF_POS_Y] = y;
  if (y < POS_MIN) mem8[actor + OFF_POS_Y] = POS_MIN;
  deriveStackedSpriteYs(m); // refresh the derived sprite Ys

  // gate the ring advance on the tile-anim cursor and the integrity-flag block
  const cursor = mem16[TILE_ANIM_CURSOR];
  if ((cursor & 0xff) === RISE_CURSOR_SENTINEL && mem8[cursor] < CURSOR_TILE_GATE) {
    let anySet = false;
    for (let i = 0; i < INTEGRITY_FLAG_COUNT; i++) {
      if (mem8[INTEGRITY_FLAG_SCAN_BASE + i] !== 0) { anySet = true; break; }
    }
    if (!anySet) return; // every flag clear -> no work, hold the counter
  }

  // ===== advance the rising ring counter =====
  retreatTileAnimScript(m);
  const ring = (mem8[STATUS_RENDER_RING] + 1) & RING_MASK;
  mem8[STATUS_RENDER_RING] = ring;
  if (ring !== 0) return; // no wrap -> display holds

  mem8[STATUS_RENDER_PHASE] = u8(mem8[STATUS_RENDER_PHASE] + 1); // carry into the phase
  return wrapRenderPhaseAndPaintTileTriplet(m, STATUS_RENDER_PHASE); // shared render tail
}

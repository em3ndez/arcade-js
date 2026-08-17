// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectFrame — IX sprite-object animation arm. Counts down the (IX+8) frame timer; on expiry it steps
 * the (IX+6) phase (counting down, 1 wrapping to 4), reads the phase-tile table, folds in the (IX+5)
 * flip bits, and stages the IY sprite tile/attr pair. LIVE-OUT: memory-only (the sprite-object dispatcher).
 */
import { SPRITE_OBJECT_PHASE_TILE_TABLE } from "./names.js";

const FRAME_RELOAD = 12;
const PHASE_WRAP = 4;
const SPRITE_ATTR = 4;

export function animateSpriteObjectFrame(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  const timer = (mem8[(obj + 0x08)] - 1) & 0xff;
  mem8[(obj + 0x08)] = timer;
  if (timer !== 0) return; // not yet expired

  mem8[(obj + 0x08)] = FRAME_RELOAD;
  const phase = mem8[(obj + 0x06)];
  if (phase === 0) return; // phase 0 is inactive

  const next = phase === 1 ? PHASE_WRAP : phase - 1;
  mem8[(obj + 0x06)] = next;

  const tile = mem8[(SPRITE_OBJECT_PHASE_TILE_TABLE + next)] | mem8[(obj + 0x05)];
  mem8[(spr + 0x01)] = tile;
  mem8[(spr + 0x05)] = (tile + 1) & 0xff;
  mem8[(spr + 0x02)] = SPRITE_ATTR;
  mem8[(spr + 0x06)] = SPRITE_ATTR;
}

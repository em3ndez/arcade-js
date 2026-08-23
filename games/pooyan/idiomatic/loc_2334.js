// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_23ad } from "./loc_23ad.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { retreatTileAnimScript } from "./retreatTileAnimScript.js";
import {
  TILE_ANIM_CURSOR,
  STATUS_RENDER_RING,
  STATUS_RENDER_PHASE,
  INTEGRITY_FLAG_SCAN_BASE,
} from "./names.js";
/**
 * loc_2334 — actor-Y clamp + integrity-flag scan, then a gated phase-advance.
 *
 * Entered as the tamper handler tail-jumped from the object-clear handler. Floors the actor base-Y at 0x41, refreshes
 * the derived sprite-Y trio (deriveStackedSpriteYs), then looks for pending work: the tile-anim cursor's
 * low byte != 0xe6, or its target byte >= 0x35, or any of the 7 integrity flags set. No work returns.
 * On work it retreats the script pointer (retreatTileAnimScript), steps the render ring mod 8, and — only
 * on the ring wrap — bumps the render phase and paints it.
 *
 * LIVE-OUT: none — a void handler; its sole caller reads nothing back. Entry `inc b` is dead (B is
 * never stored, nor read by a callee/caller, before it is reset) and is dropped.
 */
export function loc_2334(m, baseY = m.regs.a, rec = m.regs.ix) {
  const { mem8 } = m;

  if (baseY < 0x41) mem8[rec + 0x04] = 0x41; // low-clamp the base-Y
  deriveStackedSpriteYs(m); // refresh the sprite-Y trio

  const cursor = mem8[TILE_ANIM_CURSOR] | (mem8[u16(TILE_ANIM_CURSOR + 1)] << 8);
  let work;
  if ((cursor & 0xff) !== 0xe6) {
    work = true;
  } else if (mem8[cursor] >= 0x35) {
    work = true;
  } else {
    work = false; // scan the 7 integrity flags in the flag-scan block
    for (let i = 0; i < 7; i++) if (mem8[INTEGRITY_FLAG_SCAN_BASE + i] !== 0) { work = true; break; }
  }
  if (!work) return; // nothing pending

  retreatTileAnimScript(m); // retreat the script pointer on even frames
  const ring = (mem8[STATUS_RENDER_RING] + 1) & 0x07;
  mem8[STATUS_RENDER_RING] = ring;
  if (ring !== 0) return; // ring still winding

  mem8[STATUS_RENDER_PHASE] = mem8[STATUS_RENDER_PHASE] + 1; // mem8 write truncates to 8 bits
  return loc_23ad(m, STATUS_RENDER_PHASE); // paint the advanced phase
}

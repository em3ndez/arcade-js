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
 * movePlayerVerticallyAndTickStatusRender — the RISE half of a bidirectional vertical
 * position driver for the actor whose record is pointed to by IX.
 *
 * WHAT IT IS
 *   Each frame the actor-update dispatcher wants an object nudged one step up or one step
 *   down. Bit 2 of the actor's aim/direction byte at (IX+7) selects which: clear means
 *   descend, set means rise. This routine owns the rise case — it decrements the actor's
 *   vertical position and clamps it to a low bound — and hands the descent case off to the
 *   descent handler. Riding on the same tick, it also services the status-panel render
 *   cadence: a slow mod-8 "ring" counter that only redraws the three HUD status fields
 *   once every eight advances, so the panel animates gently instead of every frame.
 *
 * ROLE IN THE MACHINE
 *   Per-frame actor movement fused with the status-render ring. It is the up-branch entry
 *   of the direction-split handler; its down-branch twin is movePlayerDownAndTickStatusRender.
 *
 * ROM: 0x2329-0x23d6
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a void driver; the caller reads nothing back. Its effect is entirely
 *   in memory: the actor's Y at (IX+4) is stepped and clamped, the three stacked sprite Ys
 *   are refreshed, the tile-animation strip is retreated, the mod-8 ring at
 *   STATUS_RENDER_RING (0x88bd) advances, and on a ring wrap the mod-4 phase at
 *   STATUS_RENDER_PHASE (0x88bc) carries and the three status tile-blocks are repainted
 *   into video RAM.
 */
const OFF_POS_Y = 0x04; //     (IX+4) actor vertical position (screen Y; larger = lower on screen)
const OFF_AIM_FLAGS = 0x07; // (IX+7) aim/direction flags
const DESCEND_BIT = 0x04; //   aim bit 2: clear -> descent, set -> rise
const POS_MIN = 0x41; //       low clamp for the rise position (top of the actor's travel)
const RISE_CURSOR_SENTINEL = 0xe6; // tile-cursor low byte that arms the integrity gate
const CURSOR_TILE_GATE = 0x35; //    below this tile code at the cursor the gate applies
const INTEGRITY_FLAG_COUNT = 7; //   integrity flags scanned before the ring advances
const RING_MASK = 0x07; //           ring counter wraps mod 8

export function movePlayerVerticallyAndTickStatusRender(m, actor = m.regs.ix) {
  const { mem8, mem16 } = m;

  // ===== direction split (ROM 0x232d): test aim bit 2 at (IX+7) =====
  // The aim/direction byte carries the intended movement. When bit 2 is clear the actor is
  // meant to descend, so the whole tick is delegated to the descent handler; when it is set
  // we fall through and run the rise path below.
  if ((mem8[actor + OFF_AIM_FLAGS] & DESCEND_BIT) === 0) {
    return movePlayerDownAndTickStatusRender(m, actor); // bit 2 clear -> descent handler
  }

  // ===== rise step (ROM 0x2332): move up one, clamp to the low bound (ROM 0x2337) =====
  // Rising means moving toward the top of the screen, and screen Y grows downward, so we
  // DECREMENT the position at (IX+4). The clamp keeps the actor from rising past POS_MIN
  // (0x41), the highest cell of its travel: if the decrement dropped below it, snap back.
  const y = u8(mem8[actor + OFF_POS_Y] - 1);
  mem8[actor + OFF_POS_Y] = y;
  if (y < POS_MIN) mem8[actor + OFF_POS_Y] = POS_MIN;
  deriveStackedSpriteYs(m); // (ROM 0x23d7) re-derive the three stacked sprite Ys at the new height

  // ===== render-ring gate (ROM 0x2343): decide whether the status ring ticks this frame =====
  // TILE_ANIM_CURSOR (0x88be) is a 16-bit pointer marching across the 0x84xx tilemap in
  // video RAM. When its low byte is exactly the sentinel 0xe6 AND the tile code currently
  // under it is below CURSOR_TILE_GATE (0x35), the routine consults the seven-entry
  // integrity/anti-tamper flag block based at INTEGRITY_FLAG_SCAN_BASE (0x89e7). If every
  // one of those flags is clear there is no status work pending, so the ring counter is
  // held and the routine returns without ticking (ROM 0x2358 ret). Any other cursor state,
  // or any flag set, falls through to advance the ring.
  const cursor = mem16[TILE_ANIM_CURSOR];
  if ((cursor & 0xff) === RISE_CURSOR_SENTINEL && mem8[cursor] < CURSOR_TILE_GATE) {
    let anySet = false;
    for (let i = 0; i < INTEGRITY_FLAG_COUNT; i++) {
      if (mem8[INTEGRITY_FLAG_SCAN_BASE + i] !== 0) { anySet = true; break; }
    }
    if (!anySet) return; // every flag clear -> no work, hold the counter
  }

  // ===== advance the rising ring counter (ROM 0x2359) =====
  // The rise path drives the marching tile strip backward one cell, then bumps the mod-8
  // ring at STATUS_RENDER_RING (0x88bd), masked to three bits. The ring is a divide-by-8
  // prescaler for the HUD: unless it just wrapped back to zero the status panel is left
  // untouched and the routine returns (ROM 0x2365 ret nz).
  retreatTileAnimScript(m); // (ROM 0x23ec) retreat the tilemap strip on this parity
  const ring = (mem8[STATUS_RENDER_RING] + 1) & RING_MASK;
  mem8[STATUS_RENDER_RING] = ring;
  if (ring !== 0) return; // no wrap -> display holds

  // ===== ring wrapped: carry into the phase and repaint (ROM 0x2366 -> 0x23ad) =====
  // On the once-every-eight wrap, the mod-4 render phase at STATUS_RENDER_PHASE (0x88bc)
  // is carried one step. The shared render tail then masks that phase to 0..3, looks up the
  // tile-block descriptor for the phase, and stamps the three 2x2 status blocks two rows
  // apart into video RAM at 0x8425 (the third block alternating between two sources on the
  // phase's low bit) — the visible redraw of the status panel.
  mem8[STATUS_RENDER_PHASE] = u8(mem8[STATUS_RENDER_PHASE] + 1); // carry into the phase
  return wrapRenderPhaseAndPaintTileTriplet(m, STATUS_RENDER_PHASE); // shared render tail
}

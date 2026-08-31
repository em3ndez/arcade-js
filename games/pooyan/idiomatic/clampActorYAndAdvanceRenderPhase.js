// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { wrapRenderPhaseAndPaintTileTriplet } from "./wrapRenderPhaseAndPaintTileTriplet.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { retreatTileAnimScript } from "./retreatTileAnimScript.js";
import {
  TILE_ANIM_CURSOR,
  STATUS_RENDER_RING,
  STATUS_RENDER_PHASE,
  INTEGRITY_FLAG_SCAN_BASE,
} from "./names.js";
/**
 * clampActorYAndAdvanceRenderPhase — floor the lead actor's vertical position, then, only when
 * animation or integrity work is actually pending, tick the status-panel render clock one notch.
 *
 *   ROM 0x2334-0x2369.   Grounding: [seen].
 *
 * WHAT IT IS
 *   A short per-frame actor handler with a render tail. It is reached as the mismatch exit of
 *   clearAndReseedObjectSlot (0x77c8): that routine clears and re-seeds an actor slot behind a
 *   colour-RAM checksum, and when the checksum sum comes out wrong it tail-jumps here instead of
 *   returning. So this handler runs on the just-touched actor: it snaps that actor's Y back into a
 *   legal range, re-derives its on-screen sprite rows, and — if the machine has any tile-strip
 *   animation or anti-tamper work outstanding — nudges the slow render clock that repaints the
 *   status panel.
 *
 * HOW IT FITS THE MACHINE
 *   Actors live in the 0x18-stride record arena based at 0x8a80; the record's vertical position is
 *   field +0x04 (for slot 0, the player, that cell is PLAYER_Y 0x8a84). The status panel is redrawn
 *   lazily: a mod-8 ring (STATUS_RENDER_RING) has to wrap all the way round before a mod-4 phase
 *   index (STATUS_RENDER_PHASE) advances and the panel tiles are restamped. This handler is one of
 *   the places that turns that ring, but it refuses to spend the tick unless there is real work to
 *   show — an in-flight tile-strip animation, or a tripped integrity flag.
 *
 * LIVE-OUT
 *   Nothing is returned — a void handler; its caller reads no result back. Its whole effect is in
 *   memory: the clamped actor Y at rec+0x04, the refreshed three-row sprite-Y stack, the advanced
 *   render ring, and (only on a ring wrap) the advanced render phase plus the repainted panel.
 *
 * The ROM's entry instruction bumps the B register, but B is dead across this handler — it is
 * overwritten before anything reads it — so that bump changes nothing the machine can observe.
 */
export function clampActorYAndAdvanceRenderPhase(m, baseY = m.regs.a, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Step 1: low-clamp the actor's base-Y at 0x41 ---------------------------------------------
  // The candidate vertical position arrives in `baseY`; the actor's live Y sits in record field
  // +0x04. 0x41 is the highest the actor may ride (Y grows downward, so 0x41 is a top-of-play
  // floor). If the candidate has drifted above that ceiling, write 0x41 back so the freshly
  // re-seeded actor cannot be drawn off the top of the arena.
  if (baseY < 0x41) mem8[rec + 0x04] = 0x41; // low-clamp the base-Y

  // --- Step 2: rebuild the player's stacked sprite rows ------------------------------------------
  // deriveStackedSpriteYs (0x23d7) recomputes the three stacked sprite-Y coordinates of the player
  // actor from that single base-Y, so the rigid three-row sprite column tracks the position we may
  // have just clamped.
  deriveStackedSpriteYs(m); // refresh the sprite-Y trio

  // --- Step 3: is there any tile-strip / integrity work to service this frame? -------------------
  // TILE_ANIM_CURSOR (0x88be) is a 16-bit pointer into the 0x84xx tilemap that marches a short tile
  // strip back and forth to animate it. Read the whole word (low byte at 0x88be, high byte at
  // 0x88bf). Three conditions, checked cheapest-first, each meaning "the machine has something to
  // redraw this frame":
  const cursor = mem8[TILE_ANIM_CURSOR] | (mem8[u16(TILE_ANIM_CURSOR + 1)] << 8);
  let work;
  //   (a) the strip has not returned to its idle home cell — the cursor low byte is not 0xe6.
  if ((cursor & 0xff) !== 0xe6) {
    work = true;
  //   (b) otherwise, the tile code currently under the cursor has reached/passed the wrap value:
  //       codes 0x34/0x37 gate the strip's step, so a code >= 0x35 means the animation is mid-cycle.
  } else if (mem8[cursor] >= 0x35) {
    work = true;
  //   (c) otherwise, walk the 7-byte anti-tamper flag block at INTEGRITY_FLAG_SCAN_BASE (0x89e7):
  //       these are the ROM/signature checksum strike counters, and any nonzero one means a tamper
  //       guard has fired, so the panel must be driven forward.
  } else {
    work = false; // scan the 7 integrity flags in the flag-scan block
    for (let i = 0; i < 7; i++) if (mem8[INTEGRITY_FLAG_SCAN_BASE + i] !== 0) { work = true; break; }
  }
  // With none of the three true, nothing is pending — leave the render clock untouched and return.
  if (!work) return; // nothing pending

  // --- Step 4: retreat the marching tile strip --------------------------------------------------
  // retreatTileAnimScript (0x23ec) walks the strip one cell backward, but only on even parity ticks
  // (it consults the per-frame parity counter TILE_ANIM_PARITY 0x8f37 itself). Paired with the
  // odd-frame forward walk elsewhere, the strip oscillates in place rather than drifting away.
  retreatTileAnimScript(m); // retreat the script pointer on even frames

  // --- Step 5: turn the mod-8 status-render ring ------------------------------------------------
  // STATUS_RENDER_RING (0x88bd) is a free-running mod-8 counter that paces the panel redraw. Add
  // one, mask to 0..7, store it back. If it has not wrapped to 0 the ring is still winding, so the
  // panel is not due this frame — the repaint happens only once every eighth serviced tick.
  const ring = (mem8[STATUS_RENDER_RING] + 1) & 0x07;
  mem8[STATUS_RENDER_RING] = ring;
  if (ring !== 0) return; // ring still winding

  // --- Step 6: on the ring wrap, advance the render phase and repaint the panel -----------------
  // STATUS_RENDER_PHASE (0x88bc) is the mod-4 phase index selecting which tile-block descriptor the
  // panel shows. Bump it by one (the byte store truncates to 8 bits; the paint routine re-masks it
  // to 0..3). wrapRenderPhaseAndPaintTileTriplet (0x23ad) then looks up the descriptor for the new
  // phase and stamps its three 2x2 tile blocks two rows apart into the status-panel video RAM.
  mem8[STATUS_RENDER_PHASE] = mem8[STATUS_RENDER_PHASE] + 1; // mem8 write truncates to 8 bits
  return wrapRenderPhaseAndPaintTileTriplet(m, STATUS_RENDER_PHASE); // paint the advanced phase
}

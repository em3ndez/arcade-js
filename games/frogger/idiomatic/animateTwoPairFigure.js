// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateTwoPairFigure  —  ROM 0x291d  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame animator for the river's "two-pair figure" — the diver whose on-screen graphic is a
 *   2x2 tile quad. This routine does the visible part: it advances a phase counter and, at two marks in
 *   that counter, stamps the figure's tile quad into VRAM so the diver visibly flips between two poses.
 *   (It is the sibling of mountOrKillFrogOnTwoPairFigure, the collision test that decides whether the
 *   frog rides this figure or dies on it, and of the dive-column animation; the three share one block of
 *   arm/gate/latch RAM.)
 *
 * WHERE IT SITS
 *   Called once every in-play frame by the collision orchestrator orchestrateCollisionsAndFrogInput
 *   (0x1a55), second of the diver's three routines. It runs on every level (the diver's *existence* is
 *   level-gated elsewhere, not here) but is inert on the great majority of frames: the three guards below
 *   fall straight through unless a dive cycle is actually armed and not currently owned by the dive
 *   copier. It neither reads input nor tests the frog — purely a graphics tick.
 *
 * LIVE-OUT
 *   Memory only. It writes the figure's phase counter and, at the two blit phases, four VRAM tile cells.
 *   It returns nothing and leaves no register the caller reads.
 */
import { FIGURE_ANIM_PHASE, FIGURE_ANIM_STEP_GATE, SPRITE_FRAME_BUSY_LATCH1, TWO_PAIR_FIGURE_ANIM_PHASE, TWO_PAIR_FIGURE_VRAM } from "./names.js";

// The quad is two tile pairs stacked vertically. One tilemap row is 32 cells, so the second pair sits
// +32 (0x20) below the first — TWO_PAIR_FIGURE_VRAM (0xa846) top row, 0xa866 bottom row.
const ROW_STRIDE = 32;

// The two marks in the phase counter at which a pose is stamped. The figure holds frame A from phase 64
// until frame B momentarily appears at 112, at which point the cycle restarts — so the diver reads as a
// slow flip between the two poses.
const PHASE_BLIT_A = 64;
const PHASE_BLIT_B = 112;

// First tile of each 2x2 pose. Frame A's tiles 104..107 are the same quad the mount branch stamps when
// the frog rides the diver (see mountOrKillFrogOnTwoPairFigure); frame B (208..211) is the alternate pose.
const FRAME_A_FIRST_TILE = 104;
const FRAME_B_FIRST_TILE = 208;

export function animateTwoPairFigure(m) {
  const { mem8 } = m;

  // ── Guard 1: is a diver present at all? ───────────────────────────────────────────────
  // FIGURE_ANIM_PHASE (0x8101) has a dual role in this subsystem: as a gate, 0 means "figure idle / no
  // diver on screen" (its non-zero value is the diver's X coordinate, read by the collision test). When
  // idle we reset the figure's own phase counter TWO_PAIR_FIGURE_ANIM_PHASE (0x833f) to 0 so the next
  // dive starts its flip cycle from the top, then return without drawing anything.
  if (mem8[FIGURE_ANIM_PHASE] === 0) {
    mem8[TWO_PAIR_FIGURE_ANIM_PHASE] = 0;
    return;
  }

  // ── Guard 2: is a dive cycle armed? ───────────────────────────────────────────────────
  // FIGURE_ANIM_STEP_GATE (0x8150) bit0 is raised by the arm routines (armTwoPairFigureFrame /
  // resetDiveSurfaceCounter) when a dive cycle begins. With bit0 clear the figure is present but not
  // stepping this frame, so bail.
  if ((mem8[FIGURE_ANIM_STEP_GATE] & 1) === 0) return;

  // ── Guard 3: the busy interlock ───────────────────────────────────────────────────────
  // SPRITE_FRAME_BUSY_LATCH1 (0x814f) is the mutual-exclusion latch shared with the descending dive
  // copier. While it is set the dive copier owns the shared cursor state and advances alone; the figure
  // animator must stand down so the two do not draw over each other. The copier clears the latch at the
  // end of its cycle, which is what re-enables this routine.
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return;

  // ── Step the flip cycle ───────────────────────────────────────────────────────────────
  // Advance the figure's own phase counter TWO_PAIR_FIGURE_ANIM_PHASE (0x833f) by one, wrapping at 256
  // (the ROM counter is a single byte). Most frames land between the two blit marks and draw nothing —
  // they just carry the counter forward.
  const phase = (mem8[TWO_PAIR_FIGURE_ANIM_PHASE] + 1) & 0xff;
  mem8[TWO_PAIR_FIGURE_ANIM_PHASE] = phase;

  // At phase 64 stamp pose A; at phase 112 stamp pose B and reset the counter to 0, restarting the flip
  // cycle. (No other phase draws — the diver simply holds whichever pose was last stamped.)
  if (phase === PHASE_BLIT_A) {
    blitFigure(FRAME_A_FIRST_TILE);
  } else if (phase === PHASE_BLIT_B) {
    blitFigure(FRAME_B_FIRST_TILE);
    mem8[TWO_PAIR_FIGURE_ANIM_PHASE] = 0;
  }

  // Stamp the 2x2 figure quad into VRAM at TWO_PAIR_FIGURE_VRAM (0xa846): the top tile pair at +0/+1, and
  // the bottom pair one tilemap row below (+ROW_STRIDE/+ROW_STRIDE+1, i.e. 0xa866/0xa867). `firstTile`
  // fixes the pose; the four consecutive tiles firstTile..firstTile+3 read left-to-right, top row first.
  function blitFigure(firstTile) {
    mem8[TWO_PAIR_FIGURE_VRAM] = firstTile;
    mem8[TWO_PAIR_FIGURE_VRAM + 1] = firstTile + 1;
    mem8[TWO_PAIR_FIGURE_VRAM + ROW_STRIDE] = firstTile + 2;
    mem8[TWO_PAIR_FIGURE_VRAM + ROW_STRIDE + 1] = firstTile + 3;
  }
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * mountOrKillFrogOnTwoPairFigure  —  ROM 0x28bb  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The frog-versus-diver collision test for the "two-pair figure" — the diver figure (a 2x2 tile quad)
 *   that surfaces in the river during play. On each frame a dive is armed, this routine decides the frog's
 *   fate when the frog shares the diver's tile region: land cleanly on the diver's back and RIDE it, or
 *   come down on the wrong (leading) part and DIE.
 *
 * WHERE IT SITS
 *   Run FIRST of the diver's three per-frame routines by the collision orchestrator
 *   orchestrateCollisionsAndFrogInput (0x1a55) while the in-play flag PLAY_FLAG (0x83fe) is set — ahead of
 *   animateTwoPairFigure (0x291d), which drives the figure's animation and reads the same arm gate this
 *   routine gates on. It is inert on the great majority of frames (the two gates below), so most calls fall
 *   straight through the first two `return`s without touching memory. Nothing runs it in attract mode.
 *
 * LIVE-OUT
 *   Memory only. It writes the ride/hold flag and, on a clean landing, four VRAM tile cells. It returns
 *   nothing and leaves no register the caller reads.
 */
import { FIGURE_ANIM_STEP_GATE, LIVES_COUNT, FROG_Y, FROG_X, FIGURE_ANIM_PHASE, HOLD_FLAG, TWO_PAIR_FIGURE_VRAM } from "./names.js";
import { killFrogAtLane } from "./dispatchFrogMoveAgainstLanes.js";

// The collision box is compared in HALF-TILE-BIASED coordinates: adding 8 (half of a 16px tile) shifts
// each position to the tile centre, so the box test compares centres rather than top-left corners.
const BIAS = 8;

// Gate-2 threshold: the minimum LEVEL at which the diver hazard exists. LIVES_COUNT (0x83b7) doubles as the
// level/progress counter, and the diver first appears on level 2 — so below level 2 there is no diver to
// mount or die on, and the whole collision test is skipped.
const LEVEL_MIN = 2;

const BOX_Y_LOW = 42, BOX_Y_HIGH = 59; // the diver's Y band [42,59) that the biased frog row must fall in
const X_WINDOW = 32;                    // width of the diver's horizontal overlap window, in pixels
const MOUNT_TILE = 104;                 // first tile of the 2x2 mounted-frog quad (tiles 104..107)
const ROW_STRIDE = 32;                  // one screen row = 32 tile cells, so +32 steps straight down

export function mountOrKillFrogOnTwoPairFigure(m) {
  const { mem8 } = m;

  // ── Gate 1: is a dive actually armed? ────────────────────────────────────────────────
  // FIGURE_ANIM_STEP_GATE (0x8150) bit0 is the diver's arm/variant gate — raised by the dive-arm routines
  // (armTwoPairFigureFrame 0x287e / resetDiveSurfaceCounter 0x288c) only while a dive cycle is armed, and
  // clear when no diver is on screen. With the bit clear the test must NOT run — otherwise a frog that
  // happened to be in the band could "mount" a diver that isn't there.
  if ((mem8[FIGURE_ANIM_STEP_GATE] & 1) === 0) return;

  // ── Gate 2: not on level 1 ───────────────────────────────────────────────────────────
  // LIVES_COUNT (0x83b7) is the level/progress counter here. The diver only exists from level 2 up, so
  // level 1 skips the collision test wholesale.
  if (mem8[LIVES_COUNT] < LEVEL_MIN) return;

  // ── Vertical overlap: is the frog in the diver's row band? ────────────────────────────
  // frogTop is the frog's biased row (FROG_Y 0x8047 + 8). It must land in the diver's Y band [42,59) or
  // there is no vertical overlap and we are done.
  const frogTop = (mem8[FROG_Y] + BIAS) & 0xff;
  if (frogTop < BOX_Y_LOW || frogTop >= BOX_Y_HIGH) return;

  // ── Horizontal overlap: is the frog within the diver's X window? ──────────────────────
  // frogRight is the frog's biased X (FROG_X 0x8044 + 8). diverX is the diver's current on-screen X, read
  // from the figure-anim phase cell FIGURE_ANIM_PHASE (0x8101) — whose non-zero value doubles as the
  // figure's horizontal position while it animates. Two guards reject a non-overlap:
  //   (a) frog is entirely past the diver's right edge:   (diverX + 8)  <  frogRight
  //   (b) frog sits left of the 32-wide window:           (diverX - 32) >= frogRight
  // Anything between (a) and (b) overlaps, and is split next on the inner edge.
  const frogRight = (mem8[FROG_X] + BIAS) & 0xff;
  const diverX = mem8[FIGURE_ANIM_PHASE];
  if (((diverX + BIAS) & 0xff) < frogRight) return;
  if (((diverX - X_WINDOW) & 0xff) >= frogRight) return;

  // ── Outer overlap → the frog rides the diver ─────────────────────────────────────────
  // Frog is LEFT of the inner edge (diverX - 8): a clean landing on the diver's back. Raise HOLD_FLAG
  // (0x8004) — the ride/hold flag, which makes the frog-move resolver dispatchFrogMoveAgainstLanes (0x11bf)
  // early-return so the frog is held attached and carried rather than independently steered — then stamp
  // the 2x2 mounted-frog tile quad (104..107) into VRAM at TWO_PAIR_FIGURE_VRAM (0xa846): top row at +0/+1,
  // bottom row one screen row (+32) below at 0xa866/0xa867. That quad (the same tile-104 base the figure's
  // own frame A draws) is what the player sees riding the figure.
  if (((diverX - BIAS) & 0xff) >= frogRight) {
    mem8[HOLD_FLAG] = 1;
    mem8[TWO_PAIR_FIGURE_VRAM] = MOUNT_TILE;
    mem8[TWO_PAIR_FIGURE_VRAM + 1] = MOUNT_TILE + 1;
    mem8[TWO_PAIR_FIGURE_VRAM + ROW_STRIDE] = MOUNT_TILE + 2;
    mem8[TWO_PAIR_FIGURE_VRAM + ROW_STRIDE + 1] = MOUNT_TILE + 3;
    return;
  }

  // ── Inner overlap → the frog dies ────────────────────────────────────────────────────
  // Frog came down INSIDE the inner edge, on the wrong (leading) part of the figure: fatal. Hand off to the
  // shared frog-kill tail killFrogAtLane (ROM 0x12d0), which always raises the hold/kill flag HOLD_FLAG
  // (0x8004) = 1 and, only in the mid-river band (0x30 <= FROG_Y < 0x80), also raises the second-bank kill
  // cell SECOND_BANK (0x829c). In the ROM the call is bracketed by `push 0x28ee`, but 0x28ee is only THIS
  // routine's own `ret` address — so it is a plain tail-call: run the kill, return to our caller.
  return killFrogAtLane(m);
}

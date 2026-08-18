// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepDiveSurfaceTimer  —  ROM 0x27FE  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The shared per-frame pacer for the river diver's *dive* animation — the descending tile column the
 *   diver paints as it submerges. Its whole job is to hold each dive frame on screen for a fixed number
 *   of frames and then emit exactly one new frame, so the dive descends at a controlled speed rather
 *   than flickering down at the 60Hz frame rate. It emits nothing itself; it decides WHEN to advance and
 *   hands the actual VRAM blit to a copier.
 *
 * WHERE IT SITS
 *   Reached every in-play frame through the level-gated dive driver loc_27ea (0x27ea): on levels 2..4 the
 *   mid-band arm resetDiveSurfaceCounter (0x288c) falls into it, and on level 5+ the high-band arm
 *   armDiveHighPhase (0x2874) does — either way this routine runs once per frame while a dive is armed.
 *   It shares one block of arm/gate/latch state with the sibling *figure* animation (animateTwoPairFigure
 *   0x291d) and interlocks with it through the busy latch: while a dive cycle is armed, this pacer drives
 *   and the figure animator bails; when the copier ends the cycle it clears the latch and the figure
 *   animator resumes.
 *
 *   The pacing is a two-cell countdown (both cells seeded EQUAL by the arm routine):
 *     · TWOPLAYER_FRAME_CELL_8146 (0x8146) — the reload PERIOD (held constant across the cycle).
 *     · TWOPLAYER_FRAME_CELL_8147 (0x8147) — the live COUNTDOWN that runs down and reloads.
 *   One dive frame is emitted per full countdown of the period, so the seed value sets the inter-frame
 *   delay (the arm seeds it as (ANIM_FRAME_BUFFER & 0x0f) * 8 — a larger low nibble means a slower dive).
 *
 * LIVE-OUT
 *   Memory only. On the ticks where nothing advances it either returns untouched (idle) or nudges the
 *   0x8147 countdown; on an emit tick it decrements 0x8147 and the frame-copy it tail-calls writes two
 *   VRAM cells and steps the dive cursor. It returns nothing and leaves no register the caller reads.
 */
import { stepDiveFrameCounter } from "./stepDiveFrameCounter.js";
import { selectDiveVariantFrame } from "./selectDiveVariantFrame.js";
import { copyDiveAnimFrame } from "./copyDiveAnimFrame.js";
import {
  SPRITE_FRAME_BUSY_LATCH1,
  TWOPLAYER_FRAME_CELL_8146,
  TWOPLAYER_FRAME_CELL_8147,
  FIGURE_ANIM_STEP_GATE,
  FROG_ANIM_TILE_PAIR_SRC,
} from "./names.js";

export function stepDiveSurfaceTimer(m) {
  const { mem8 } = m;

  // ── Gate: is a dive cycle actually armed? ────────────────────────────────────────────
  // SPRITE_FRAME_BUSY_LATCH1 (0x814f) is the busy latch the arm routines raise when they seed a dive and
  // the copier clears at cycle end. While it is clear there is no dive in progress, so the pacer has
  // nothing to count and returns at once. (Note this is the inverse of the figure animator's read of the
  // same latch: the figure animates only while the latch is CLEAR — that mutual test is the interlock.)
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] === 0) return; // dive idle

  // ── Mid-interval: still counting down, no frame this tick ─────────────────────────────
  // The two counter cells are armed EQUAL, so they match only at the instant a new frame should emit.
  // Whenever they differ we are partway through a hold interval: hand the live countdown 0x8147 to
  // stepDiveFrameCounter (0x28b0), which decrements it — or, when it has already drained to 0, reloads it
  // from the period cell 0x8146 (restoring 0x8146 == 0x8147 for the next pass). The cell address is the
  // routine's second argument (the value that arrived in register HL in the translated form). No dive
  // frame is emitted on these ticks.
  if (mem8[TWOPLAYER_FRAME_CELL_8146] !== mem8[TWOPLAYER_FRAME_CELL_8147]) {
    return stepDiveFrameCounter(m, TWOPLAYER_FRAME_CELL_8147); // not yet aligned -> step the counter
  }

  // ── Aligned: consume one tick and emit a dive frame ───────────────────────────────────
  // 0x8146 == 0x8147, which is true right after a reload (and at the initial seed): the hold interval is
  // up. Decrement the countdown 0x8147 by one to break the equality and start the next interval. The ROM
  // does a plain DEC on the byte cell; mem8 is a byte view, so the store wraps mod 256 with no explicit
  // mask needed.
  mem8[TWOPLAYER_FRAME_CELL_8147] = mem8[TWOPLAYER_FRAME_CELL_8147] - 1; // aligned -> consume a tick

  // ── Emit: pick the tile table by the gate's parity ────────────────────────────────────
  // FIGURE_ANIM_STEP_GATE (0x8150) bit0 selects which ROM frame table this dive copies from. The mid-band
  // arm INCREMENTS the gate each cycle so bit0 flips cycle-to-cycle (alternating the table); the high-band
  // arm pins it to 1 (always the main table). On the EVEN phase (bit0 == 0) hand off to
  // selectDiveVariantFrame (0x286d), which points the copier at the ALTERNATE arm-0 table (0x1403). On the
  // ODD phase (bit0 == 1) call the copier copyDiveAnimFrame (0x281b) directly with the MAIN tile-pair
  // table FROG_ANIM_TILE_PAIR_SRC (0x1413). Both are ROM tail-calls (jp): run the copy, return its (empty)
  // result to our caller.
  if ((mem8[FIGURE_ANIM_STEP_GATE] & 1) === 0) {
    return selectDiveVariantFrame(m);
  }
  return copyDiveAnimFrame(m, FROG_ANIM_TILE_PAIR_SRC);
}

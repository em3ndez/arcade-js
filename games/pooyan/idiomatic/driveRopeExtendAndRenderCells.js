// SPDX-License-Identifier: GPL-3.0-only
import { GRAB_ACTIVE_FLAG, WAVE_ARRIVAL_COUNTER } from "./names.js";
import { dispatchRopeExtendState } from "./dispatchRopeExtendState.js";
import { driveActiveRopeCells } from "./driveActiveRopeCells.js";
/**
 * driveRopeExtendAndRenderCells — even-frame rope driver.
 *
 * WHAT IT IS:
 *   The rope is the vertical column of cells that grows down the playfield from the top, with a
 *   grabbable object riding each one down toward the player. Two jobs keep that column alive every
 *   frame it advances: growing it longer one segment at a time, and stepping each already-live cell
 *   through its own little life (spawn an object, carry it down, test for a catch, retract a spent
 *   segment). This routine is the top of that per-frame rope work: it decides whether the rope is
 *   allowed to move this frame at all, and if so runs the two sub-drivers that do the growing and the
 *   per-cell stepping, in that order.
 *
 * ROLE IN THE MACHINE:
 *   The rope's per-frame work is split into two halves that alternate on the parity of ROUND_COUNTER
 *   (0x8907) bit0 — this is the half taken when that bit is clear (the round counter's even value),
 *   with a sibling handling the odd half. When this half runs it first checks two hold conditions and
 *   bails on either, then, if neither holds, drives the rope forward by calling the two sub-drivers in
 *   sequence: dispatchRopeExtendState (grow/animate the column) then driveActiveRopeCells (step every
 *   live cell). The order matters — segments are added and blitted first, then the cell sweep walks
 *   however many cells are now live.
 *
 * ROM: 0x2d66-0x2d77.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none — a per-frame driver run purely for its memory effects (the rope's segment count and
 *   extend state, the per-cell state records, the hung-object records, and the tile codes blitted into
 *   the page-0x84 video RAM). Nothing is read back from the call itself.
 */
const ARRIVAL_HOLD = 0x02; // arrival-counter value that suppresses the driver

export function driveRopeExtendAndRenderCells(m) {
  const { mem8 } = m;

  // Hold #1 — a rope-grab is in progress. GRAB_ACTIVE_FLAG (0x8d32) is the latch that goes nonzero
  // when a grab fires and stays set while it is played out. The rope must freeze during that window,
  // so neither sub-driver runs: return immediately and leave the whole rope untouched this frame.
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return; // grab in progress
  // Hold #2 — the stage has not opened the rope yet. WAVE_ARRIVAL_COUNTER (0x8903) is the per-stage
  // arrival tally, seeded to this hold value of 2 at round init and bumped up as enemies arrive. It
  // also sets the rope's target length: the grow handler stops once the segment count reaches
  // arrival-count minus two, so while the counter still sits at 2 that target length is zero and there
  // is nothing to grow. Bail until the counter climbs past the hold value.
  if (mem8[WAVE_ARRIVAL_COUNTER] === ARRIVAL_HOLD) return;

  // Neither hold applies — drive the rope forward. First the extend state machine: run one step of the
  // two-state grow cycle, adding a new segment or animating the last-added one into place.
  dispatchRopeExtendState(m);
  // Then the per-cell sweep: walk every rope cell that is now live and step it once through its own
  // handler (seed a hung object, carry it down, carry-with-grab-check, or retract a spent segment).
  driveActiveRopeCells(m);
}

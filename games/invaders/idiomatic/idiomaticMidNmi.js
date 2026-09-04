// SPDX-License-Identifier: GPL-3.0-only
/**
 * idiomaticMidNmi -- the mid-screen interrupt body.
 *
 * WHAT IT IS
 *   A direct-JS engine-seam leaf fired once per generator yield, before the vblank body, at each frame.
 *   It is memory + IO only, with no interrupt stack. Each pass it stamps the raster draw-phase flag to
 *   the mid half of the screen, ends immediately unless a game is active, and — only when it should draw
 *   this half-frame — walks the mid-screen object-record table and runs the mid-screen alien-paint scan.
 *
 * ROLE IN THE MACHINE
 *   This is the idiomatic form of the 8080 RST1 (mid-screen) interrupt body loc_008c. The board fires two
 *   interrupts per frame; loc_0010 (the vblank body, idiomaticVblankNmi) stamps DRAW_PHASE_FLAG (0x2072)
 *   to 0x80 at frame top, and this mid body clears it to 0 — so that one byte names which raster half is
 *   currently live (see mechanisms.md, "Frame tasks, timers, boot, and scoring"). The object dispatchers
 *   gate each sprite on it through objectMatchesDrawPhase, so no sprite is torn across the beam. GAME_ACTIVE
 *   (0x20e9) is the master gate: zero means attract/idle with nothing to draw here. When active, the draw
 *   runs unconditionally in real play (GAME_IN_PROGRESS, 0x20ef) and, in the attract demo, only on the
 *   frames the TASK_FLAGS (0x20c1) bit-0 rotate-out selects. walkObjectTable walks the mid table
 *   OBJECT_TABLE_MID (0x2020) and calls each record's handler; pickNextMarchingAlien is the mid draw-scan
 *   that paints the next alien and, when the fleet has reached the bottom, arms a round-ending warm restart.
 *   Both the object walk and the draw-scan are ordinary idiomatic calls now. Like the vblank in-game tail,
 *   both are unreached by the attract boot (which never enters in-game play) and are covered by the
 *   acceptance gates rather than the boot path.
 *
 * ROM 0x008c-0x00b0.  Grounding: the cells it touches (DRAW_PHASE_FLAG, GAME_ACTIVE, GAME_IN_PROGRESS,
 * TASK_FLAGS, OBJECT_TABLE_MID) are [seen]; the mid-body routine label loc_008c itself is [guess].
 *
 * LIVE-OUT: memory + IO only; may set m.nextMain (a warm restart the engine swaps in after the frame).
 */
import {
  DRAW_PHASE_FLAG, GAME_ACTIVE, GAME_IN_PROGRESS, TASK_FLAGS,
  OBJECT_TABLE_MID,
} from "./names.js";
import { walkObjectTable } from "./walkObjectTable.js";
import { pickNextMarchingAlien } from "./pickNextMarchingAlien.js";

export function idiomaticMidNmi(m) {
  // Name this half-frame the mid raster half (the vblank body stamps 0x80; this clears it to 0) so the
  // object dispatchers service each sprite in exactly one of the two halves.
  m.mem8[DRAW_PHASE_FLAG] = 0; // mid raster half

  // Master gate: with no game active there is no play field to draw this half — return to the epilogue.
  if (m.mem8[GAME_ACTIVE] === 0) return;

  // Decide whether to draw this frame. In real play the draw always runs; in the attract demo it runs only
  // on the frames the TASK_FLAGS bit-0 rotate-out has selected (an every-N-frames cadence).
  // In-game always draws; the attract demo gates on the TASK_FLAGS bit0 rotate-out.
  if (m.mem8[GAME_IN_PROGRESS] === 0 && (m.mem8[TASK_FLAGS] & 0x01) === 0) return;

  // Run the mid-screen object handlers over their record table (each edits its own record in place).
  walkObjectTable(m, OBJECT_TABLE_MID); // walk the mid-screen object-record table

  // If a handler armed a warm restart, mirror the 8080's stack-reseat abandonment: skip the draw-scan this
  // frame and let the engine take over with the queued flow.
  if (m.nextMain) return; // a handler armed a warm restart: mirror the SP-reseat abandonment (skip the mid draw-scan this frame)

  // Paint the next marching alien; this scan may itself arm a round-ending warm restart (fleet at the
  // bottom), which the engine consumes after this frame.
  pickNextMarchingAlien(m); // pick the next alien to paint; may itself arm a round-ending warm restart, consumed by the engine after this frame
}

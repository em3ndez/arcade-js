// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_EXTEND_STATE } from "./names.js";
import { addRopeSegmentAndAdvanceExtendState } from "./addRopeSegmentAndAdvanceExtendState.js";
import { advanceRopeExtendAnimation } from "./advanceRopeExtendAnimation.js";

/**
 * dispatchRopeExtendState — per-frame driver for the rope-extend state machine.
 *
 * WHAT IT IS:
 *   The rope is the vertical column of cells that grows downward from the top of the playfield —
 *   the track the enemies ride down toward the player. Growing that column one segment at a time is
 *   a tiny two-state machine, and this routine is the per-frame driver that runs exactly one step of
 *   that machine each frame it is called.
 *
 * ROLE IN THE MACHINE:
 *   The even-frame rope driver (driveRopeExtendAndRenderCells) decides whether the rope is allowed
 *   to grow this frame — it holds off while a rope-grab is in progress and until the wave has passed
 *   its hold point — and, when it is, calls this routine. This routine reads the current rope-extend
 *   state and hands the frame to the one handler for that state. The two states alternate:
 *     state 0 — addRopeSegmentAndAdvanceExtendState: commit one new segment (choose its video
 *               column, arm its per-cell timer) and flip the state to 1.
 *     state 1 — advanceRopeExtendAnimation: play out that new segment's grow blit over several
 *               frames, then flip the state back to 0 so the following segment can be added.
 *   So a segment is born in state 0 and animated to completion in state 1 before the machine loops
 *   back for the next one — the rope lengthens one segment per birth/animate cycle.
 *
 * ROM: 0x2d78-0x2d7b. Reads ROPE_EXTEND_STATE (0x8f14) and vectors through the inline handler table
 *   at ROM 0x2d7c {0 -> 0x2d80, 1 -> 0x2dbc}; the selected handler runs to completion and returns
 *   directly to this routine's own caller (the even-frame rope driver).
 *
 * GROUNDING: [seen] — both this routine and the selector cell ROPE_EXTEND_STATE it dispatches on are
 *   confirmed in their roles.
 *
 * LIVE-OUT: none — a void per-frame dispatch; nothing is read back from it. Its whole effect is
 *   whatever the selected handler leaves in memory (the rope's segment count, the extend state
 *   selector itself, and the segment/animation cursors that handler advances).
 */
export function dispatchRopeExtendState(m) {
  // Pick this frame's step from the rope-extend selector ROPE_EXTEND_STATE (0x8f14) [seen]:
  // 0 = add a segment, 1 = animate the last-added segment. Only these two values ever occur — each
  // handler leaves the byte set to the other of the two — so an out-of-range value would simply
  // fall through and do nothing this frame.
  switch (m.mem8[ROPE_EXTEND_STATE]) {
    // State 0: commit one new rope segment. The handler returns at once once the rope has reached
    // its per-stage length (segment count == wave-arrival count minus two); otherwise it bumps the
    // segment count, looks up the new segment's page-0x84 video-RAM column, arms that segment's cell
    // timer, and advances the extend state to 1 so state 1 can animate the segment in.
    case 0: return addRopeSegmentAndAdvanceExtendState(m);
    // State 1: play out the just-added segment's grow blit. The handler counts a sub-timer down and,
    // on each expiry, blits the next 2x2 tile frame into the segment's stored column; once the last
    // grow frame has been drawn it resets the extend state back to 0 so the next segment can be
    // added, and arms the new rope cell's own state byte.
    case 1: return advanceRopeExtendAnimation(m);
  }
}

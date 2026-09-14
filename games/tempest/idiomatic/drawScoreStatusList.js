// SPDX-License-Identifier: GPL-3.0-only
import { loc_9e, PLAYER_SHOT_DEPTH, OBJ_DEPTH, loc_2f, PLAYER_FINE_ANGLE, PLAYER_SEGMENT, RIM_ROT_OFFSET } from "./names.js";
import { drawTubeRimSegmentFromCorner } from "./drawTubeRimSegmentFromCorner.js";

/**
 * drawScoreStatusList — build the score/status vector run for the tube rim. ROM 0xb586.
 *
 * Role in the machine: this draws the status marker that rides along the player's tube rim. It is
 * gated on a live depth value so the marker only appears while there is something to show, and it is
 * skipped entirely in a special marker mode; otherwise it kicks the shared rim-segment builder to lay
 * a small spread of segments out from the player's current corner of the tube.
 *
 * Behavior: it always raises the rebuild flag loc_9e=0x01 so the display list is re-emitted this
 * frame. It then reads the gate/depth byte PLAYER_SHOT_DEPTH (0x202) and bails if it is 0 or >= 0xf0
 * (out of the valid depth band). In range, it latches that depth into OBJ_DEPTH (0x57) and loc_2f, and
 * bails again if the marker byte PLAYER_FINE_ANGLE (0x201) holds the skip value 0x81. Otherwise it
 * reads the player's segment (0x200) as the corner index y and derives a spread size from
 * RIM_ROT_OFFSET (0x51): ((rot >> 1) & 0x07) + 1, i.e. 1..8 segments, then calls
 * drawTubeRimSegmentFromCorner to emit the run.
 *
 * Live-out: loc_9e (rebuild flag) raised; OBJ_DEPTH/loc_2f latched with the gate depth on the drawing
 * path; and the rim segment vectors appended by drawTubeRimSegmentFromCorner. Grounding: [seen].
 */
export function drawScoreStatusList(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x01;                                  // raise the rebuild flag for this frame
  const gate = mem8[PLAYER_SHOT_DEPTH];                 // depth/gate byte 0x202
  if (gate === 0 || gate >= 0xf0) return;               // nothing to show outside the valid band
  mem8[OBJ_DEPTH] = gate;                               // latch depth into 0x57
  mem8[loc_2f] = gate;                                  // and its mirror
  if (mem8[PLAYER_FINE_ANGLE] === 0x81) return;         // 0x201 skip marker: draw nothing
  const y = mem8[PLAYER_SEGMENT];                       // 0x200: corner index of the player's segment
  const size = (((mem8[RIM_ROT_OFFSET] >> 1) & 0x07) + 1) & 0xff; // 1..8 segments from the rot offset
  drawTubeRimSegmentFromCorner(m, size, y);             // emit the spread of rim segments
}

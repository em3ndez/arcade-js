// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  FRAME_COUNTER, loc_29, loc_2a, loc_2b, COORD_LIST_PTR_LO, WORK_PTR_LO, PROJ_PT_X, DRAW_PATCH_PTR_LO,
  SPIKE_ACTIVE_FLAG, TUBE_GEOM_FLAG, REDRAW_COUNTER, ENEMY_SLOT_TOP, RIM_COLOR_ANIM, WAVE_PHASE_LATCH, ENEMY_ANIM_ACCUM, NEAR_DEPTH_THRESHOLD,
  PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_DEPTH, LANE_FLAGS,
  RIM_LANE_SLOT_TABLE_A, RIM_LANE_SLOT_TABLE_B,
} from "./names.js";
import { seatDrawCursor } from "./seatDrawCursor.js";
import { initAndDrawRimDepthCounters } from "./initAndDrawRimDepthCounters.js";
import { closeLayerPointer } from "./closeLayerPointer.js";
import { seatAltDrawPointer } from "./seatAltDrawPointer.js";

/**
 * paintRimLanes — recolour the sixteen rim lanes of the tube from live enemy state. ROM 0xb367.
 *
 * Role in the machine: the tube's rim is drawn as sixteen lanes, and their colours carry information to the
 * player — plain lanes cycle a neutral ramp, lanes with an approaching enemy flash, and the two lanes tied
 * to the player's aim get highlighted. This routine rebuilds a sixteen-entry lane-flag block from the active
 * enemy tables, then walks the rim twice: a first pass chooses each lane's colour value and writes it
 * through one indirect display list, and a second pass folds a high/low colour bit into a second list.
 *
 * Behaviour. If the redraw counter (REDRAW_COUNTER) is set it runs the pointer pre-pass —
 * seatDrawCursor / initAndDrawRimDepthCounters / closeLayerPointer on layer 0x02 — and always refreshes the
 * base pointer with seatAltDrawPointer. It clears the sixteen-entry LANE_FLAGS block, then (unless the
 * SPIKE_ACTIVE_FLAG guard byte is negative) sweeps the enemy slots from ENEMY_SLOT_TOP down: for each slot
 * that is alive (ENEMY_DEPTH nonzero) and in the "on rim" state (low three bits of ENEMY_SLOT_FLAGS == 1),
 * it builds a per-lane flag byte (base 1, +2 when animating and nearer than NEAR_DEPTH_THRESHOLD) and OR-s
 * it into the near lane (ENEMY_PHASE) and, with bit7 set, the far lane (ENEMY_SEGMENT). It then picks a
 * base colour (0x06, or 0x01 on a WAVE_PHASE_LATCH gate every eighth frame), caches the two aim-highlighted
 * columns (colA/colB from PLAYER_SEGMENT/PLAYER_FINE_ANGLE when a shot is live), and advances the
 * RIM_COLOR_ANIM ramp phase.
 *
 * First pass (x = 15..0): a flagged lane blinks (frame parity when bit1 set, else 0x06); an aim column is
 * 0x01; otherwise it takes either the held base value or a rotating ramp segment, written through the
 * ($3b / WORK_PTR_LO) list at the lane's RIM_LANE_SLOT_TABLE_A slot. Second pass (x from 15 or 14 down): the
 * lane-flag's bit7 selects colour 0x00 vs 0xc0, which is OR-ed (low five bits kept) into the
 * ($b0 / DRAW_PATCH_PTR_LO) list at the RIM_LANE_SLOT_TABLE_B slot.
 *
 * Live-out: the LANE_FLAGS block, the two display lists behind WORK_PTR_LO and DRAW_PATCH_PTR_LO, the
 * scratch cells loc_29/loc_2a/loc_2b/COORD_LIST_PTR_LO/PROJ_PT_X, and the decremented RIM_COLOR_ANIM phase.
 * Grounding: [seen].
 */
export function paintRimLanes(m) {
  const { mem8, mem16 } = m;

  // Optional pre-pass of pointer/slot setup, then always refresh the base pointer.
  if (mem8[REDRAW_COUNTER] !== 0) {
    seatDrawCursor(m, 0x02);
    initAndDrawRimDepthCounters(m);
    closeLayerPointer(m, 0x02);
  }
  seatAltDrawPointer(m, 0x02);

  // Clear the flag block.
  for (let x = 0x0f; x >= 0; x--) mem8[u16(LANE_FLAGS + x)] = 0x00;

  // Merge enemy state into the flag block (unless the guard byte is negative).
  if ((mem8[SPIKE_ACTIVE_FLAG] & 0x80) === 0) {
    // Sweep the enemy slots ENEMY_SLOT_TOP..0 (loop ends when x wraps past 0 into bit7).
    let x = mem8[ENEMY_SLOT_TOP];
    do {
      // Only alive slots (ENEMY_DEPTH != 0) whose low three state bits == 1 (drawn on the rim) count.
      if (mem8[u16(ENEMY_DEPTH + x)] !== 0 && (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x07) === 0x01) {
        mem8[loc_29] = 0x01; // per-lane flag byte, base value
        if ((mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) === 0) {
          // Nearer than the threshold while animating -> bump the flag (+2) so the near lane blinks.
          if ((mem8[ENEMY_ANIM_ACCUM] & 0x80) === 0 && mem8[u16(ENEMY_DEPTH + x)] < mem8[NEAR_DEPTH_THRESHOLD]) {
            mem8[loc_29] = mem8[loc_29] + 2;
          }
          const near = mem8[u16(ENEMY_PHASE + x)];       // near lane index
          mem8[u16(LANE_FLAGS + near)] |= mem8[loc_29];
        }
        const far = mem8[u16(ENEMY_SEGMENT + x)];         // far lane index, tagged with bit7
        mem8[u16(LANE_FLAGS + far)] |= mem8[loc_29] | 0x80;
      }
      x = (x - 1) & 0xff;
    } while ((x & 0x80) === 0);
  }

  // Base color value for the first pass.
  let base = 0x06;
  const gate = mem8[WAVE_PHASE_LATCH];
  if (gate !== 0 && (gate & 0x80) === 0 && (mem8[FRAME_COUNTER] & 0x07) === 0x07) base = 0x01;
  mem8[loc_29] = base;

  // Cache the two "special" column indices from the coordinate cells.
  mem8[COORD_LIST_PTR_LO] = 0xff;
  let colA = 0xff, colB = 0xff;
  if (mem8[PLAYER_SHOT_DEPTH] !== 0 && (mem8[PLAYER_FINE_ANGLE] & 0x80) === 0) {
    colA = mem8[PLAYER_SEGMENT];
    colB = mem8[PLAYER_FINE_ANGLE];
  }
  mem8[loc_2a] = colA;
  mem8[loc_2b] = colB;
  const anim = mem8[RIM_COLOR_ANIM];
  if ((anim & 0x80) === 0) {
    mem8[COORD_LIST_PTR_LO] = (anim & 0x0e) >> 1;
    mem8[RIM_COLOR_ANIM] = anim - 1;
  }

  // First pass: pick each column's value and store it through the ($3b) list.
  for (let x = 0x0f; x >= 0; x--) {
    let value;
    const flag = mem8[u16(LANE_FLAGS + x)];
    if (flag !== 0) {
      value = (flag & 0x02) !== 0 ? (mem8[FRAME_COUNTER] & 0x01) : 0x06;
    } else if (x === mem8[loc_2a] || x === mem8[loc_2b]) {
      value = 0x01;
    } else if (mem8[RIM_COLOR_ANIM] & 0x80) {
      value = mem8[loc_29];
    } else {
      let seg = (x + mem8[COORD_LIST_PTR_LO]) & 0x07;
      value = seg === 0x07 ? 0x03 : seg;
    }
    const slot = mem8[u16(RIM_LANE_SLOT_TABLE_A + x)];
    mem8[u16(mem16[WORK_PTR_LO] + slot)] = value;
  }

  // Second pass: OR the flag's color bits into the ($b0) list.
  let x = mem8[TUBE_GEOM_FLAG] & 0x80 ? 0x0e : 0x0f;
  do {
    const color = mem8[u16(LANE_FLAGS + x)] & 0x80 ? 0x00 : 0xc0;
    mem8[PROJ_PT_X] = color;
    const slot = mem8[u16(RIM_LANE_SLOT_TABLE_B + x)];
    const dst = u16(mem16[DRAW_PATCH_PTR_LO] + slot);
    mem8[dst] = (mem8[dst] & 0x1f) | mem8[PROJ_PT_X];
    x = (x - 1) & 0xff;
  } while ((x & 0x80) === 0);
}

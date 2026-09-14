// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FRAME_COUNTER, PHASE_COUNTER, DSW1_SNAPSHOT, DSW2_SNAPSHOT, HEARTBEAT_ACCUM_HI, SCORE_DISPLAY_TIMER, DRAW_SLOT_TABLE, OVERLAY_VEC_WORD_B, OVERLAY_VEC_WORD_A } from "./names.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { computeDisplayListChecksum } from "./computeDisplayListChecksum.js";
import { emitByteAsBcdDigits } from "./emitByteAsBcdDigits.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";

/**
 * drawOverlayFrame — the recurring per-frame overlay driver. ROM 0xaaa8.
 *
 * Role in the machine: this is called every frame to lay down the standing overlay furniture — the
 * shape slot selected by a config switch, a couple of fixed marker slots, the level-index digits — and
 * to fold in a periodic display-list self-check. It carries both a real draw job and a maintenance job
 * (the checksum) that share this once-a-frame slot.
 *
 * Behavior: it first draws a phase-selected slot, indexing ROM table DRAW_SLOT_TABLE (loc_a8b0) by the
 * low two bits of the config snapshot DSW1_SNAPSHOT (loc_9) to pick the shape id. It ticks the display
 * countdown SCORE_DISPLAY_TIMER (0x16e) down by one. Then a branch: when DSW2_SNAPSHOT bit0 is set AND
 * FRAME_COUNTER bit5 is clear it draws alternate slot 0x32; otherwise it spends the slot recomputing
 * the display-list checksum (computeDisplayListChecksum). It always redraws marker slots 0x2c and 0x2e,
 * clamps the level/phase index PHASE_COUNTER (0x6) to its ceiling 0x28, and emits it as BCD digits.
 * Finally, when the heartbeat accumulator HEARTBEAT_ACCUM_HI (0x17) is nonzero it posts a trailing
 * coordinate word from OVERLAY_VEC_WORD_A/B (loc_aaf4/loc_aaf3).
 *
 * Live-out: SCORE_DISPLAY_TIMER ticked; PHASE_COUNTER clamped to <= 0x28; the overlay slots, digit run
 * and optional trailing word appended to the display list; the checksum refreshed on the off-phase.
 * Grounding: [seen].
 */
export function drawOverlayFrame(m) {
  const { mem8 } = m;
  // Phase-selected slot: ROM table indexed by the low 2 bits of the config snapshot.
  drawSlotShapeRecord(m, mem8[u16(DRAW_SLOT_TABLE + (mem8[DSW1_SNAPSHOT] & 0x03))]);
  mem8[SCORE_DISPLAY_TIMER]--; // tick the display countdown (0x16e)
  // Draw the alternate slot only when the phase gate is set and the mode flag is clear;
  // otherwise spend this once-a-frame slot recomputing the display-list checksum.
  if ((mem8[DSW2_SNAPSHOT] & 0x01) !== 0 && (mem8[FRAME_COUNTER] & 0x20) === 0) {
    drawSlotShapeRecord(m, 0x32);
  } else {
    computeDisplayListChecksum(m);
  }
  drawSlotShapeRecord(m, 0x2c); // fixed marker slot
  drawSlotShapeRecord(m, 0x2e); // fixed marker slot
  if (mem8[PHASE_COUNTER] >= 0x28) mem8[PHASE_COUNTER] = 0x28; // clamp level/phase index to the ceiling
  emitByteAsBcdDigits(m, mem8[PHASE_COUNTER]);                 // draw it as BCD digits
  // Trailing coordinate word, posted only while the heartbeat accumulator is live.
  if (mem8[HEARTBEAT_ACCUM_HI] !== 0) emitCoordinateVectorWord(m, mem8[OVERLAY_VEC_WORD_A], mem8[OVERLAY_VEC_WORD_B]);
}

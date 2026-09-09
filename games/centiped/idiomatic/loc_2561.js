// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  DSW2, loc_d3, loc_8d, loc_c8, CONFIG_DIP_BYTE, loc_a4, loc_86, loc_00,
  SEGMENT_MOVE_ACCUM_B, loc_dc, loc_1c02, loc_1c03, loc_1c04, loc_a5, loc_a6,
  IN1, loc_ff, loc_fb, loc_fc, loc_9a, SEGMENT_ROW_CROSS_COUNT, SEGMENT_MOVE_ACCUM,
  loc_89, loc_ae, loc_af, loc_21c0, loc_b0, loc_b1, IN0, loc_ee,
} from "./names.js";
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { broadcastByteToStateBlock } from "./broadcastByteToStateBlock.js";
import { copyZpStateToSnapshot } from "./copyZpStateToSnapshot.js";
import { drawGridSideBorders } from "./drawGridSideBorders.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { initRoundState } from "./initRoundState.js";

/**
 * loc_2561 — per-frame wave/board-start service, gated on the pending-wave flag $86.
 *
 * Seeds the wave-select cells from the config source byte and a difficulty count, then (when a wave
 * start is pending) lays the status rows, counts down the pending count, and on the last count commits
 * the wave: clears the working cells, refreshes the checksum snapshot, fans the state block, and tail-
 * calls the grid-border draw. Most frames it bails at the pending gate. RAM + the side latches. [code]
 */
export function loc_2561(m) {
  const { mem8 } = m;

  // Seed the wave-select cells from the config source byte.
  const src = mem8[DSW2];
  mem8[loc_d3] = src;
  const seedLow = src & 0x03;
  mem8[loc_8d] = seedLow;
  if (seedLow === 0) mem8[loc_c8] = 0x02;

  // Difficulty-derived count; bail unless a wave start is pending.
  mem8[loc_a4] = ((mem8[CONFIG_DIP_BYTE] & 0x0c) >> 2) + 2;
  if ((mem8[loc_86] & 0x80) === 0) return;

  // Draw the selector row when nonzero, then refresh the flip byte.
  if (mem8[loc_8d] !== 0) writePointerTableRow(m, mem8[loc_8d]);
  mem8[loc_8d] = (mem8[loc_00] & 0x20) << 2;

  const ored = mem8[loc_c8] | mem8[SEGMENT_MOVE_ACCUM_B];
  if (ored === 0) {
    // Both counts clear: stamp the flip byte, draw its row, blank the two side latches.
    const dip80 = mem8[CONFIG_DIP_BYTE] & 0x80;
    mem8[loc_dc] = dip80;
    writePointerTableRow(m, dip80 ^ 0x8a);
    mem8[loc_1c03] = 0xff;
    mem8[loc_1c04] = 0xff;
    return;
  }

  // A count is live: emit an optional pre-row (only when the flip byte is negative), then the 0x09 row.
  if (mem8[loc_dc] & 0x80) {
    let rowByte;
    if (ored < 0x02) {
      rowByte = 0x0a | mem8[loc_8d];
    } else {
      mem8[loc_dc] = 0x00;
      rowByte = 0x8a;
    }
    writePointerTableRow(m, rowByte);
  }
  writePointerTableRow(m, 0x09);

  // Two masked status bytes derived from the count (tens split off above 9).
  let statusByte = mem8[loc_c8];
  if (statusByte >= 0x0a) {
    writeMaskedByteAndAdvancePointer(m, 0x21);
    statusByte = (statusByte - 0x0a) & 0xff;
  }
  writeMaskedByteAndAdvancePointer(m, statusByte | 0x20);
  writeMaskedByteAndAdvancePointer(m, mem8[SEGMENT_MOVE_ACCUM_B] === 0 ? 0x00 : 0x1e);

  // Commit gate: bail when the count is spent or the flip byte went negative.
  if (mem8[loc_c8] === 0) return;
  if (mem8[loc_dc] & 0x80) return;
  mem8[loc_1c03] = mem8[loc_8d];

  // Decide the slot index to commit, and whether to commit directly or route through the IN1 poll.
  let slot;
  let commit = true;
  if (mem8[loc_c8] >= 0x02) {
    mem8[loc_1c04] = mem8[loc_8d];
    if (mem8[IN1] & 0x02) {
      commit = false;
    } else {
      mem8[loc_a6] = mem8[loc_a4];
      mem8[loc_c8] = mem8[loc_c8] - 1;
      if (mem8[loc_c8] & 0x80) commit = false; // decrement went negative -> poll path
      else slot = 0x02;
    }
  } else {
    commit = false;
  }
  if (!commit) {
    // IN1 poll: bit0 set aborts the commit; else take the fallback slot.
    if (mem8[IN1] & 0x01) return;
    slot = mem8[loc_ff];
  }

  // Commit the wave: clear the working cells, seed the checksum snapshot, fan the state block.
  mem8[loc_c8] = mem8[loc_c8] - 1;
  mem8[loc_1c03] = 0xff;
  mem8[loc_1c04] = 0xff;
  mem8[loc_fb] = 0x00;
  mem8[loc_fc] = 0x00;
  mem8[loc_9a] = 0x00;
  mem8[SEGMENT_ROW_CROSS_COUNT] = 0x00;
  mem8[SEGMENT_MOVE_ACCUM] = 0x00;
  mem8[loc_89] = slot;
  mem8[u16(loc_1c02 + slot)] = 0x00;
  mem8[loc_a5] = mem8[loc_a4] - 1;
  mem8[loc_86] = mem8[loc_86] + 1;
  copyZpStateToSnapshot(m);

  // Two parallel config-indexed table lookups feed the paired object cells.
  const dipIdx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  const tableByte = readFdBitsTableByte(m);
  mem8[loc_ae] = tableByte;
  mem8[loc_af] = tableByte;
  const rowB = mem8[loc_21c0 + dipIdx];
  mem8[loc_b0] = rowB;
  mem8[loc_b1] = rowB;

  if (mem8[IN0] & 0x10) {
    mem8[loc_ee] = 0x80;
    broadcastByteToStateBlock(m);
  }

  initRoundState(m);
  return drawGridSideBorders(m);
}

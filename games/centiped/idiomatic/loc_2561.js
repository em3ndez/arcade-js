// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  DSW2, loc_d3, loc_8d, loc_c8, CONFIG_DIP_BYTE, loc_a4, loc_86, loc_00,
  SEGMENT_MOVE_ACCUM_B, loc_dc, loc_1c02, loc_1c03, loc_1c04, loc_a5, loc_a6,
  IN1, loc_ff, loc_fb, loc_fc, loc_9a, SEGMENT_ROW_CROSS_COUNT, SEGMENT_MOVE_ACCUM,
  loc_89, loc_ae, loc_af, CONFIG_PARALLEL_TABLE, loc_b0, loc_b1, IN0, loc_ee,
} from "./names.js";
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { broadcastByteToStateBlock } from "./broadcastByteToStateBlock.js";
import { copyZpStateToSnapshot } from "./copyZpStateToSnapshot.js";
import { drawGridSideBorders } from "./drawGridSideBorders.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { initRoundState } from "./initRoundState.js";

/**
 * loc_2561 — per-frame wave/board-start service (ROM 0x2561), gated on the pending-wave flag $86.
 *
 * Seeds the wave-select cells from the config source byte and a difficulty count, then (when a wave
 * start is pending) lays the status rows, counts down the pending count, and on the last count commits
 * the wave: clears the working cells, refreshes the checksum snapshot, fans the state block, and tail-
 * calls the grid-border draw. Most frames it bails at the pending gate. RAM + the side latches. [code]
 *
 * This is the first dispatch in the main-loop frame chain, so it decides whether a new wave/board is
 * coming up before any actor simulates. The "banner" it paints while counting down is the between-wave
 * status line; committing a wave flows straight into the full round setup (initRoundState) and the
 * grid-border redraw. The two side latches $1c03/$1c04 are LS259 outlatch bits used as UI/flag signals.
 *
 * Role: round lifecycle — the per-frame wave banner + commit.  Grounding: [code], with the config
 * ports DSW2/CONFIG_DIP_BYTE/IN0/IN1 and SEGMENT_MOVE_ACCUM/_B [seen].
 * Live-out: $d3, $8d, $c8, $a4, $a5, $a6, $89, $dc, $ae/$af, $b0/$b1, $86, the side latches, and the
 * round-setup / border-draw side-effects — or an early RTS at the pending gate on most frames.
 */
export function loc_2561(m) {
  const { mem8 } = m;

  // Seed the wave-select cells from the config source byte.
  // DSW2 is the option DIP bank; its low two bits pick the wave/board selector into $8d, and a zero
  // selector primes the count cell $c8 to 2. These run every frame so the selection is always current.
  const src = mem8[DSW2];
  mem8[loc_d3] = src;
  const seedLow = src & 0x03;
  mem8[loc_8d] = seedLow;
  if (seedLow === 0) mem8[loc_c8] = 0x02;

  // Difficulty-derived count; bail unless a wave start is pending.
  // Bits 3-2 of the mode/config byte scale the difficulty count $a4 (2..5); it too is kept fresh every
  // frame. The real gate is $86 bit 7 — the pending-wave flag — and on most frames it is clear -> RTS.
  mem8[loc_a4] = ((mem8[CONFIG_DIP_BYTE] & 0x0c) >> 2) + 2;
  if ((mem8[loc_86] & 0x80) === 0) return;

  // Draw the selector row when nonzero, then refresh the flip byte.
  // $8d is then repurposed as a flip byte for the banner rows: bit 5 of the frame counter $00,
  // shifted up to bit 7, so it alternates the row's mirror flag over time.
  if (mem8[loc_8d] !== 0) writePointerTableRow(m, mem8[loc_8d]);
  mem8[loc_8d] = (mem8[loc_00] & 0x20) << 2;

  // Fold the two live counters together: the wave count $c8 and the segment-movement accumulator
  // SEGMENT_MOVE_ACCUM_B. Both zero means the wave is fully counted down and ready to commit.
  const ored = mem8[loc_c8] | mem8[SEGMENT_MOVE_ACCUM_B];
  if (ored === 0) {
    // Both counts clear: stamp the flip byte, draw its row, blank the two side latches.
    // The mode DIP bit 7 selects which banner variant is drawn (XOR 0x8a), and the side latches
    // $1c03/$1c04 are cleared to 0xff (idle) until the commit path below re-drives them.
    const dip80 = mem8[CONFIG_DIP_BYTE] & 0x80;
    mem8[loc_dc] = dip80;
    writePointerTableRow(m, dip80 ^ 0x8a);
    mem8[loc_1c03] = 0xff;
    mem8[loc_1c04] = 0xff;
    return;
  }

  // A count is live: emit an optional pre-row (only when the flip byte is negative), then the 0x09 row.
  // The pre-row shows the banner is still counting; once $dc (the flip byte) is positive the pre-row is
  // skipped. Row 0x09 is the fixed status label drawn every counting frame.
  if (mem8[loc_dc] & 0x80) {
    let rowByte;
    if (ored < 0x02) {
      // Nearly done (combined count < 2): draw the "last" pre-row folded with the flip byte.
      rowByte = 0x0a | mem8[loc_8d];
    } else {
      // Still counting: clear $dc and draw the ordinary pre-row 0x8a.
      mem8[loc_dc] = 0x00;
      rowByte = 0x8a;
    }
    writePointerTableRow(m, rowByte);
  }
  writePointerTableRow(m, 0x09);

  // Two masked status bytes derived from the count (tens split off above 9).
  // The wave count is shown as a decimal: if it is >= 10 a leading "tens" digit (0x21) is emitted and
  // the tens are subtracted off, then the units digit (| 0x20 into the font range) is drawn.
  let statusByte = mem8[loc_c8];
  if (statusByte >= 0x0a) {
    writeMaskedByteAndAdvancePointer(m, 0x21);
    statusByte = (statusByte - 0x0a) & 0xff;
  }
  writeMaskedByteAndAdvancePointer(m, statusByte | 0x20);
  // Trailing glyph: blank while the movement accumulator is zero, else a fixed marker (0x1e).
  writeMaskedByteAndAdvancePointer(m, mem8[SEGMENT_MOVE_ACCUM_B] === 0 ? 0x00 : 0x1e);

  // Commit gate: bail when the count is spent or the flip byte went negative.
  // Only a still-live count with a non-negative flip byte reaches the commit machinery; otherwise this
  // frame was pure banner drawing. The chosen flip byte is latched into side-latch $1c03.
  if (mem8[loc_c8] === 0) return;
  if (mem8[loc_dc] & 0x80) return;
  mem8[loc_1c03] = mem8[loc_8d];

  // Decide the slot index to commit, and whether to commit directly or route through the IN1 poll.
  // With two or more counts left, latch $1c04 too and consult IN1: a held input (bit 1) defers the
  // commit; otherwise reload the $a6 timer from the difficulty count, decrement $c8, and — unless that
  // decrement went negative — take the fixed slot 0x02. Fewer than two counts always routes to the poll.
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
    // A held start/fire input (bit 0) abandons the commit this frame; otherwise the fallback slot comes
    // from the flip byte $ff previously latched from video RAM.
    if (mem8[IN1] & 0x01) return;
    slot = mem8[loc_ff];
  }

  // Commit the wave: clear the working cells, seed the checksum snapshot, fan the state block.
  // Everything from here runs exactly once, on the frame the wave actually starts. First the movement
  // and segment accumulators are zeroed so the new wave begins from rest.
  mem8[loc_c8] = mem8[loc_c8] - 1;
  mem8[loc_1c03] = 0xff;
  mem8[loc_1c04] = 0xff;
  mem8[loc_fb] = 0x00;
  mem8[loc_fc] = 0x00;
  mem8[loc_9a] = 0x00;
  mem8[SEGMENT_ROW_CROSS_COUNT] = 0x00;
  mem8[SEGMENT_MOVE_ACCUM] = 0x00;
  // Record the chosen slot index into $89, clear that slot's per-slot output latch ($1c02 + slot),
  // set $a5 to difficulty-minus-one, bump the wave/life flag $86, and snapshot the checksum state.
  mem8[loc_89] = slot;
  mem8[u16(loc_1c02 + slot)] = 0x00;
  mem8[loc_a5] = mem8[loc_a4] - 1;
  mem8[loc_86] = mem8[loc_86] + 1;
  copyZpStateToSnapshot(m);

  // Two parallel config-indexed table lookups feed the paired object cells.
  // Bits 5-4 of the mode byte pick a ROM-table index; readFdBitsTableByte returns one row for $ae/$af
  // and the parallel table at $21c0 supplies another for $b0/$b1 — the new wave's per-object seeds.
  const dipIdx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  const tableByte = readFdBitsTableByte(m);
  mem8[loc_ae] = tableByte;
  mem8[loc_af] = tableByte;
  const rowB = mem8[CONFIG_PARALLEL_TABLE + dipIdx];
  mem8[loc_b0] = rowB;
  mem8[loc_b1] = rowB;

  // IN0 bit 4 (a coin/option input): when set, broadcast 0x80 through the state block before setup so
  // the whole block picks up the flip/enable state for the new wave.
  if (mem8[IN0] & 0x10) {
    mem8[loc_ee] = 0x80;
    broadcastByteToStateBlock(m);
  }

  // Flow straight into full round setup, then tail-call the grid side-border redraw.
  initRoundState(m);
  return drawGridSideBorders(m);
}

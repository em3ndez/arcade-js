// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_c0, loc_c1, loc_c2, loc_ee, loc_ef, loc_89, loc_88, loc_f5, loc_f7, loc_91, loc_92,
  loc_8d, loc_8e, loc_9a, IN1, loc_01, loc_00, loc_b9, loc_f4, loc_1a,
  loc_0589, loc_05a9, loc_05c9,
} from "./names.js";
import { seedStateBlockConstants } from "./seedStateBlockConstants.js";
import { transposeScreenBitmap } from "./transposeScreenBitmap.js";
import { seedPlayerShotStartCells } from "./seedPlayerShotStartCells.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { plotZpTableByteAtCursor } from "./plotZpTableByteAtCursor.js";
import { broadcastByteToStateBlock } from "./broadcastByteToStateBlock.js";
import { rebuildSegmentSpriteTables } from "./rebuildSegmentSpriteTables.js";
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";
import { seedWaveState } from "./seedWaveState.js";
import { copyZpStateToSnapshot } from "./copyZpStateToSnapshot.js";
import { negateA } from "./negateA.js";
import { plotObjectCoordinates } from "./plotObjectCoordinates.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";

/**
 * loc_2741 — the per-tick spider/flea spawn-and-move spine.
 *
 * Runs each frame, gated on the object-active flags $c1/$c2 and the pending flags $ee/$ef. When idle it
 * kicks a fresh wave/screen setup; otherwise it lays the status rows, folds an input bit into the phase
 * accumulator $9a, and advances the spawn-column counter $c0 — on a full cycle it re-arms the column and,
 * when a spawn is pending, drives the whole respawn sequence, else steps the per-slot spawn table. [code]
 */
export function loc_2741(m) {
  const { mem8 } = m;

  // Gate: both object flags negative means nothing active this tick.
  if ((mem8[loc_c1] & mem8[loc_c2]) & 0x80) return;

  // Idle-kick: when no object is up and no spawn pending, seed a fresh screen/wave.
  if ((mem8[loc_c2] & 0x80) === 0 && (mem8[loc_ee] & 0x80) && mem8[loc_ef] === 0) {
    mem8[loc_ee] = 0x82;
    seedStateBlockConstants(m);
    transposeScreenBitmap(m);
    plotObjectCoordinates(m);
    seedPlayerShotStartCells(m);
  }

  // Status glyph for the active slot (only while the slot counter's high bits are set).
  if ((mem8[loc_89] >> 1) !== 0) {
    writePointerTableRow(m, 0x00);
    const y = (mem8[loc_c2] & 0x80) ? 1 : 2;
    mem8[loc_88] = y;
    writeMaskedByteAndAdvancePointer(m, y | 0x20);
  }

  // Lay the two fixed status rows and seed the draw cursor from the flip bytes.
  writePointerTableRow(m, 0x08);
  writePointerTableRow(m, 0x05);
  mem8[loc_91] = 0x89 ^ mem8[loc_f5];
  mem8[loc_92] = 0x05 ^ mem8[loc_f7];

  // Plot a three-byte record at the slot's base offset.
  const x = mem8[loc_88];
  const base = mem8[(loc_c0 + x) & 0xff];
  mem8[loc_8d] = base;
  mem8[loc_8e] = base + mem8[loc_c0];
  plotZpTableByteAtCursor(m, base);
  plotZpTableByteAtCursor(m, (base + 1) & 0xff);
  plotZpTableByteAtCursor(m, (base + 2) & 0xff);

  // Fold an input bit into the phase accumulator (bit 3 or bit 2 of IN1, per the pending flag).
  const carry = (mem8[loc_ef] !== 0) ? ((mem8[IN1] >> 3) & 1) : ((mem8[IN1] >> 2) & 1);
  mem8[loc_9a] = (mem8[loc_9a] << 1) | carry;

  // At the top of a phase cycle, advance the spawn-column counter; below the wrap it just re-arms a slot.
  if ((mem8[loc_9a] & 0x1f) !== 0x18) return step280a(m);
  mem8[loc_c0] = mem8[loc_c0] + 1;
  if (mem8[loc_c0] < 0x03) {
    mem8[loc_8e] = mem8[loc_8e] + 1;
    const x8e = mem8[loc_8e];
    mem8[loc_01] = 0xf4;
    mem8[(loc_1a + x8e) & 0xff] = 0x01;
    return step280a(m);
  }
  return step27cc(m);
}

// Column counter full: mark this slot spent, and (only when a spawn is pending) run the full respawn.
function step27cc(m) {
  const { mem8 } = m;
  const x = mem8[loc_88];
  mem8[(loc_c0 + x) & 0xff] = 0xff;
  if (mem8[loc_ef] !== 0) {
    mem8[loc_ee] = 0x80;
    broadcastByteToStateBlock(m);
    transposeScreenBitmap(m);
    seedPlayerShotStartCells(m);
    plotObjectCoordinates(m);
    rebuildSegmentSpriteTables(m);
    seedSegmentSpawnState(m);
    seedWaveState(m);
    if (mem8[loc_c1] & 0x80) return step2825(m);
  }
  return step27f3(m);
}

// Branch on the spawn-scratch flag: zero re-runs the slot-spent path, else drops to the object tail.
function step280a(m) {
  return m.mem8[loc_01] === 0 ? step27cc(m) : step283e(m);
}

// If either object is still active, take the row-refresh path; else zero the column counter and finish.
function step27f3(m) {
  const { mem8 } = m;
  if ((mem8[loc_c1] & mem8[loc_c2]) & 0x80) return step2810(m);
  mem8[loc_c0] = 0x00;
}

// Row refresh: redraw two rows, clear the three sprite cells, then run the snapshot tail.
function step2810(m) {
  const { mem8 } = m;
  writePointerTableRow(m, 0x88);
  writePointerTableRow(m, 0x85);
  mem8[loc_0589] = 0x00;
  mem8[loc_05a9] = 0x00;
  mem8[loc_05c9] = 0x00;
  return step2825(m);
}

// Snapshot tail: refresh the checksum snapshot, run the object-mover, clear the pointer cell, finish.
function step2825(m) {
  const { mem8, mem16 } = m;
  copyZpStateToSnapshot(m);
  plotRecordFieldColumns(m);
  mem8[loc_01] = mem8[loc_89];
  if (((mem8[loc_89] - 1) & 0xff) !== 0) {
    writePointerTableRow(m, 0x80);
    mem8[mem16[loc_91]] = 0x00;
  }
  mem8[loc_c0] = 0x00;
}

// Object tail (runs on the frame's low 3-bit phase == 0): re-home one object toward the target lane.
function step283e(m) {
  const { mem8 } = m;
  if ((mem8[loc_00] & 0x07) !== 0) return;

  let sign = 0xff;
  const prev = mem8[loc_b9];
  mem8[loc_b9] = 0x00;
  let y;
  if (prev & 0x80) {
    sign = 0x01;
    y = negateA(m, prev); // magnitude of a negative delta
  } else {
    y = prev;
  }
  if (y < 0x04) return;

  const x8e = mem8[loc_8e];
  let lane = (sign ^ mem8[loc_f4]) + mem8[(loc_1a + x8e) & 0xff];
  lane &= 0xff;
  let stored;
  if (lane & 0x80) stored = 0x1a;
  else if (lane < 0x1b) stored = lane;
  else stored = 0x00;
  mem8[(loc_1a + x8e) & 0xff] = stored;
}

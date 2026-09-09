// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_00, loc_01, loc_42, loc_43, loc_86, loc_87, loc_88, loc_89, loc_91, loc_94,
  SPAWN_TIMER, loc_a1, loc_a4, loc_a5, loc_a6, loc_a7, loc_ad, loc_c1, loc_c2,
  loc_d6, FIELD_SCAN_PTR_HI, loc_ee, loc_ef, loc_f9, loc_fa, loc_1c02,
} from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";
import { rebuildSegmentSpriteTables } from "./rebuildSegmentSpriteTables.js";
import { broadcastByteToStateBlock } from "./broadcastByteToStateBlock.js";
import { seedStateBlockConstants } from "./seedStateBlockConstants.js";
import { resetPlayfieldAndSeedMushrooms } from "./resetPlayfieldAndSeedMushrooms.js";
import { seedPlayerShotStartCells } from "./seedPlayerShotStartCells.js";
import { transposeScreenBitmap } from "./transposeScreenBitmap.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";
import { foldHighScoreChecksum } from "./foldHighScoreChecksum.js";
import { loc_2505 } from "./loc_2505.js";
import { reseedSegmentSpawnState } from "./reseedSegmentSpawnState.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";
import { buildSortedObjectTable } from "./buildSortedObjectTable.js";
import { decrementSlotAndRedrawBorders } from "./decrementSlotAndRedrawBorders.js";

/**
 * advanceDeathRespawnSequence -- the per-frame death/respawn dispatcher. Ticks the $87 countdown while
 * $db is clear; once it reaches zero it either blanks the flagged cell ($d6), runs the per-object update
 * chain, restarts the wave, or steps a spawn slot forward. Gated dispatch: most exits are the machine's
 * own RTS, the rest tail-transfer into the spawn-slot chain still held in the spine. [code]
 */
export function advanceDeathRespawnSequence(m) {
  const { mem8, mem16 } = m;

  if (mem8[loc_87] === 0) return; // idle timer clear -> nothing to do
  if (mem8[FIELD_SCAN_PTR_HI] !== 0) return; // paused
  mem8[loc_87] = u8(mem8[loc_87] - 1); // tick the countdown
  if (mem8[loc_87] !== 0) return; // still counting down

  if (mem8[loc_d6] !== 0) {
    // Flagged: redraw a row, blank the cell at the drawn cursor, clear the flag, reseed shot cells.
    writePointerTableRow(m, 0x80);
    mem8[mem16[loc_91]] = 0x00;
    mem8[loc_d6] = 0x00;
    seedPlayerShotStartCells(m);
    return;
  }

  if ((mem8[loc_43] & 0xaf) === 0) {
    return loc_2505(m); // -> segment sprite-table rebuild spine
  }

  seedPlayerShotStartCells(m);

  if ((mem8[loc_86] & 0x80) !== 0) {
    // $86 negative: optionally transpose then hand off to the spawn-slot reseed chain.
    if ((mem8[loc_01] & 0x80) !== 0) {
      mem8[loc_01] = mem8[loc_01] & 0x7f;
      transposeScreenBitmap(m);
      plotRecordFieldColumns(m); // record-fan spine
    }
    return reseedSegmentSpawnState(m);
  }

  if ((mem8[loc_a5] | mem8[loc_a6]) === 0) {
    // Both object cells idle: decrement the life count, run the range-match spine, restart the wave.
    mem8[loc_86] = u8(mem8[loc_86] - 1);
    buildSortedObjectTable(m); // range-match/compact spine

    if (mem8[loc_ef] !== 0 && (mem8[loc_c2] & 0x80) !== 0) {
      mem8[loc_ee] = 0x80;
      broadcastByteToStateBlock(m);
      seedPlayerShotStartCells(m);
      transposeScreenBitmap(m);
      if ((mem8[loc_c1] & 0x80) !== 0) {
        plotRecordFieldColumns(m); // record-fan spine
      }
    }

    // Wave restart.
    seedSegmentSpawnState(m);
    rebuildSegmentSpriteTables(m);
    seedWaveState(m);
    mem8[loc_00] = 0x01;
    writePointerTableRow(m, 0x04);
    mem8[u16(loc_1c02 + mem8[loc_89])] = 0xff; // clear the per-slot output latch
    foldHighScoreChecksum(m);
    mem8[loc_f9] = 0x3d;
    mem8[loc_fa] = 0x00;
    return;
  }

  if (u8(mem8[loc_89] - 1) === 0) {
    return decrementSlotAndRedrawBorders(m); // single slot left -> the slot-tick chain
  }

  const slot = mem8[loc_88];
  if (mem8[u8(loc_a4 + slot)] === 0) {
    if (mem8[loc_a7] === 0) {
      // First empty pass: arm the slot for a fresh spawn and paint its glyph.
      mem8[loc_a7] = u8(mem8[loc_a7] + 1);
      mem8[loc_87] = 0x80;
      mem8[loc_43] = 0xf9;
      mem8[loc_42] = 0xf9;
      writePointerTableRow(m, 0x04);
      writePointerTableRow(m, 0x00);
      writeMaskedByteAndAdvancePointer(m, mem8[loc_88] | 0x20);
      return;
    }
    mem8[loc_a7] = u8(mem8[loc_a7] - 1);
  }

  // Switch to the mirror slot; abandon if it too is empty.
  const mirror = mem8[loc_88] ^ 0x03;
  if (mem8[u8(loc_a4 + mirror)] === 0) {
    return decrementSlotAndRedrawBorders(m);
  }
  mem8[loc_88] = mirror;
  const flags = (0x80 & mem8[loc_ee]) | mirror;
  mem8[loc_ee] = flags;
  if (flags === 0x82) seedStateBlockConstants(m);

  mem8[SPAWN_TIMER] = mem8[u8(loc_a1 + mirror)];
  if (mem8[loc_88] === 0x01) broadcastByteToStateBlock(m);

  transposeScreenBitmap(m);
  let cx = mem8[loc_88];
  if (cx === 0x02 && mem8[u8(loc_a4 + cx)] === mem8[loc_a4] && mem8[loc_ad] === 0) {
    mem8[u8(loc_94 + cx)] = 0x0c;
    resetPlayfieldAndSeedMushrooms(m);
    cx = 0xff; // the mushroom sweep leaves its column index wrapped one past zero
  }

  // Mark the slot busy, arm its glyph, and hand off to the slot-tick chain.
  mem8[u8(loc_c2 + cx)] = mem8[u8(loc_c2 + cx)] | 0x40;
  mem8[loc_87] = 0xa0;
  writePointerTableRow(m, 0x00);
  writeMaskedByteAndAdvancePointer(m, mem8[loc_88] | 0x20);
  mem8[loc_43] = 0xf9;
  mem8[loc_42] = 0xf9;
  mem8[loc_d6] = 0xf9;
  return decrementSlotAndRedrawBorders(m);
}

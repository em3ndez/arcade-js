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
 *
 * Returns the main loop's frame-chain gate (the branch the caller takes after this call): TRUE only when
 * both object slots are idle (the gate exit below, left N-set) so the caller runs the full per-frame
 * subsystem chain; every spawn-processing exit returns falsy (left N-clear), telling the caller this tick's
 * heavy work is done and to skip the chain.
 *
 * ROM 0x2741. Role: round lifecycle — the secondary-object (spider/flea) spawn-and-move spine, and the
 * one branch point of the main loop. Grounding: [code], with IN1 [seen]. Live-out: the truthy/falsy
 * frame-chain gate plus the object/spawn state it advances ($ee, $9a, $c0, the lane table at $1a, ...).
 * The routine is split into small step* helpers that mirror the 6502's fall-through chain of ROM labels.
 */
export function loc_2741(m) {
  const { mem8 } = m;

  // Gate: both object slots idle (c1 & c2 negative) -> no spawn work; caller runs the full frame chain.
  // $c1/$c2 are the two object-active flags; a slot is idle when its high bit is set. When BOTH are idle
  // there is no secondary object to move, so this returns truthy and the main loop runs its full tail.
  if ((mem8[loc_c1] & mem8[loc_c2]) & 0x80) return true;

  // Idle-kick: when no object is up and no spawn pending, seed a fresh screen/wave.
  // If slot $c2 is idle, a spawn is armed ($ee bit 7) and none is already pending ($ef == 0), lay down a
  // fresh screen: mark $ee = 0x82, seed the state-block constants, transpose the bitmap, plot the object
  // coordinates, and reseed the player-shot start cells — the same setup the round-init path uses.
  if ((mem8[loc_c2] & 0x80) === 0 && (mem8[loc_ee] & 0x80) && mem8[loc_ef] === 0) {
    mem8[loc_ee] = 0x82;
    seedStateBlockConstants(m);
    transposeScreenBitmap(m);
    plotObjectCoordinates(m);
    seedPlayerShotStartCells(m);
  }

  // Status glyph for the active slot (only while the slot counter's high bits are set).
  // Draw the header row, then pick glyph 1 or 2 depending on which slot ($c2) is live, store the choice
  // into the slot index $88, and emit it as a font glyph (| 0x20 into the character range).
  if ((mem8[loc_89] >> 1) !== 0) {
    writePointerTableRow(m, 0x00);
    const y = (mem8[loc_c2] & 0x80) ? 1 : 2;
    mem8[loc_88] = y;
    writeMaskedByteAndAdvancePointer(m, y | 0x20);
  }

  // Lay the two fixed status rows and seed the draw cursor from the flip bytes.
  // Rows 0x08 and 0x05 are the fixed status labels; the 16-bit draw cursor $91/$92 is then seeded from
  // fixed bases XORed with the orientation flip bytes $f5/$f7 so the record below mirrors for a flipped
  // cabinet.
  writePointerTableRow(m, 0x08);
  writePointerTableRow(m, 0x05);
  mem8[loc_91] = 0x89 ^ mem8[loc_f5];
  mem8[loc_92] = 0x05 ^ mem8[loc_f7];

  // Plot a three-byte record at the slot's base offset.
  // $c0+x holds this slot's base offset; $8d keeps it and $8e = base + $c0 forms the running index. The
  // three consecutive table bytes (base, base+1, base+2) are plotted through the zero-page table cursor.
  const x = mem8[loc_88];
  const base = mem8[(loc_c0 + x) & 0xff];
  mem8[loc_8d] = base;
  mem8[loc_8e] = base + mem8[loc_c0];
  plotZpTableByteAtCursor(m, base);
  plotZpTableByteAtCursor(m, (base + 1) & 0xff);
  plotZpTableByteAtCursor(m, (base + 2) & 0xff);

  // Fold an input bit into the phase accumulator (bit 3 or bit 2 of IN1, per the pending flag).
  // The object's spawn cadence is driven partly by live input: one IN1 bit (bit 3 when a spawn is
  // pending, else bit 2) is shifted into $9a each frame, so the phase pattern reflects player activity.
  const carry = (mem8[loc_ef] !== 0) ? ((mem8[IN1] >> 3) & 1) : ((mem8[IN1] >> 2) & 1);
  mem8[loc_9a] = (mem8[loc_9a] << 1) | carry;

  // At the top of a phase cycle, advance the spawn-column counter; below the wrap it just re-arms a slot.
  // The phase pattern 0x18 in the low 5 bits marks the top of a cycle. Below it, this tick does no spawn
  // work and hands to step280a. At the top, bump the spawn-column counter $c0.
  if ((mem8[loc_9a] & 0x1f) !== 0x18) return step280a(m);
  mem8[loc_c0] = mem8[loc_c0] + 1;
  // Under the wrap (counter < 3): just re-arm one lane slot — bump $8e, mark the scratch flag $01 = 0xf4,
  // set that lane's cell to 1 — and continue via step280a rather than running the full respawn.
  if (mem8[loc_c0] < 0x03) {
    mem8[loc_8e] = mem8[loc_8e] + 1;
    const x8e = mem8[loc_8e];
    mem8[loc_01] = 0xf4;
    mem8[(loc_1a + x8e) & 0xff] = 0x01;
    return step280a(m);
  }
  // Column counter reached the wrap (3): the current slot is spent — run the slot-spent path.
  return step27cc(m);
}

// Column counter full: mark this slot spent, and (only when a spawn is pending) run the full respawn.
// ROM 0x27cc. Retires this slot by writing 0xff into its $c0+x cell (high bit set = spent). Then, only
// when a spawn is pending ($ef nonzero), it runs the entire respawn sequence — the same seeding chain the
// round-init and death-restart paths use — so a fresh secondary object is built. [code]
function step27cc(m) {
  const { mem8 } = m;
  const x = mem8[loc_88];
  mem8[(loc_c0 + x) & 0xff] = 0xff;
  if (mem8[loc_ef] !== 0) {
    // Full respawn: broadcast 0x80 through the state block, transpose the bitmap, reseed the shot cells,
    // plot the object coordinates, rebuild the segment sprite tables, and re-seed both the segment-spawn
    // and wave state.
    mem8[loc_ee] = 0x80;
    broadcastByteToStateBlock(m);
    transposeScreenBitmap(m);
    seedPlayerShotStartCells(m);
    plotObjectCoordinates(m);
    rebuildSegmentSpriteTables(m);
    seedSegmentSpawnState(m);
    seedWaveState(m);
    // If object slot $c1 is idle, skip the row-refresh and go straight to the snapshot tail.
    if (mem8[loc_c1] & 0x80) return step2825(m);
  }
  return step27f3(m);
}

// Branch on the spawn-scratch flag: zero re-runs the slot-spent path, else drops to the object tail.
// ROM 0x280a. $01 is the spawn-scratch flag set to 0xf4 on the re-arm path above; when it is still zero
// this tick had no re-arm, so fold back into the slot-spent path, otherwise fall through to the mover. [code]
function step280a(m) {
  return m.mem8[loc_01] === 0 ? step27cc(m) : step283e(m);
}

// If either object is still active, take the row-refresh path; else zero the column counter and finish.
// ROM 0x27f3. When a secondary object is still live the status rows need repainting (step2810); when both
// are gone the column counter $c0 is reset to 0 and the sweep ends here. [code]
function step27f3(m) {
  const { mem8 } = m;
  if ((mem8[loc_c1] & mem8[loc_c2]) & 0x80) return step2810(m);
  mem8[loc_c0] = 0x00;
}

// Row refresh: redraw two rows, clear the three sprite cells, then run the snapshot tail.
// ROM 0x2810. Repaints status rows 0x88/0x85 and blanks the three sprite-shadow cells $0589/$05a9/$05c9
// (clearing the old object glyph) before handing to the snapshot tail. [code]
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
// ROM 0x2825. Refreshes the integrity snapshot and redraws the record field, then — unless the slot
// index $89 is exactly 1 — draws row 0x80 and blanks the cell the draw cursor $91 points at. Finally it
// resets the column counter $c0 so the next cycle starts clean. [code]
function step2825(m) {
  const { mem8, mem16 } = m;
  copyZpStateToSnapshot(m);
  plotRecordFieldColumns(m);
  mem8[loc_01] = mem8[loc_89];
  if (((mem8[loc_89] - 1) & 0xff) !== 0) {
    writePointerTableRow(m, 0x80);
    // Blank the tile the 16-bit draw cursor $91 addresses (erase the stale object glyph).
    mem8[mem16[loc_91]] = 0x00;
  }
  mem8[loc_c0] = 0x00;
}

// Object tail (runs on the frame's low 3-bit phase == 0): re-home one object toward the target lane.
// ROM 0x283e. On one frame in eight it nudges the live secondary object toward its target lane, folding a
// signed delta held in $b9 into the lane table at $1a and clamping the result into the 0..0x1a band. [code]
function step283e(m) {
  const { mem8 } = m;
  // Phase gate: only act when the low three bits of the frame counter $00 are zero (every 8th frame).
  if ((mem8[loc_00] & 0x07) !== 0) return;

  // Read the pending delta $b9 and consume it (zeroed). Its sign picks the step direction: a negative
  // delta is negated to its magnitude with sign = +1, a positive delta is used as-is with sign = -1.
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
  // A delta of magnitude < 4 is below the dead-zone: leave the lane alone this frame.
  if (y < 0x04) return;

  // Step the lane: add the orientation-folded sign to the current lane cell, then clamp into [0, 0x1a]
  // — a negative result floors to 0x1a, anything past 0x1a floors to 0, values in range pass through.
  const x8e = mem8[loc_8e];
  let lane = (sign ^ mem8[loc_f4]) + mem8[(loc_1a + x8e) & 0xff];
  lane &= 0xff;
  let stored;
  if (lane & 0x80) stored = 0x1a;
  else if (lane < 0x1b) stored = lane;
  else stored = 0x00;
  mem8[(loc_1a + x8e) & 0xff] = stored;
}

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
 * advanceDeathRespawnSequence -- the per-frame heart of the "an object died / the board must recycle"
 * path.
 *
 * ROM 0x23da. Grounding: [code] for the control flow. Load-bearing MAME-confirmed [seen] cells: the
 * spawn timer SPAWN_TIMER (0xa0) and the field-scan pointer high byte FIELD_SCAN_PTR_HI (0xdb) that
 * pauses the sequence; the many bare `loc_*` working cells ($86/$87/$88/$89, the $a4..$a7 slot table,
 * $43/$42/$d6 draw flags, ...) are behavioural placeholders.
 *
 * ROLE IN THE MACHINE. When the player loses an object on screen, the death animation and the eventual
 * wave rebuild are not run straight through — they are paced by a countdown so each stage (blank a
 * dying cell, arm a slot, switch to a mirror slot, tear the wave down and rebuild it) gets its own dwell
 * time on screen. `$87` is that live, reloaded interval counter: this routine ticks it every frame and,
 * only on the single frame it reaches zero, selects ONE of several mutually-exclusive actions in strict
 * priority order, reloading `$87` to a fresh interval (0x80, 0xa0, ...) so the machine idles again until
 * the next stage is due.
 *
 * DISPATCH ORDER (first match wins): blank a flagged cell ($d6) -> fall through to a sprite-table rebuild
 * ($43 mask clear) -> hand off to the reseed chain ($86 negative) -> restart the whole wave (both object
 * cells $a5/$a6 idle) -> step a spawn slot forward (the general case). Most exits are the machine's own
 * RTS (a bare `return`); the slot-stepping exits tail-transfer into `decrementSlotAndRedrawBorders`.
 *
 * LIVE-OUT. Whichever branch fires owns its own writes (see the block comments); universally it ticks
 * `$87`. Returns the tail callee's value, or nothing for the RTS exits.
 */
export function advanceDeathRespawnSequence(m) {
  const { mem8, mem16 } = m;

  // Two top gates before anything happens: if the interval counter `$87` is already zero there is no
  // death/respawn in progress, and if the field-scan pointer high byte is nonzero the sequence is
  // paused (a playfield scan owns the frame). Either way, nothing to do.
  if (mem8[loc_87] === 0) return; // idle timer clear -> nothing to do
  if (mem8[FIELD_SCAN_PTR_HI] !== 0) return; // paused
  // Tick the interval down one. Every branch below fires ONLY on the frame this hits zero, so `$87` is
  // what paces the whole animation; while it is still counting we return and wait for the next frame.
  mem8[loc_87] = u8(mem8[loc_87] - 1); // tick the countdown
  if (mem8[loc_87] !== 0) return; // still counting down

  // --- Priority 1: blank a flagged cell. The $d6 flag marks "one glyph is dying and must be erased".
  if (mem8[loc_d6] !== 0) {
    // Redraw the status row (0x80 selector), then write 0x00 into the cell the draw cursor $91 points
    // at -- that erases the dying glyph -- clear the flag so this fires once, and reseed the player's
    // shot start cells. This is the simplest exit: exactly one cell blanked per expiry.
    writePointerTableRow(m, 0x80);
    mem8[mem16[loc_91]] = 0x00;
    mem8[loc_d6] = 0x00;
    seedPlayerShotStartCells(m);
    return;
  }

  // --- Priority 2: when the $43 state mask is clear, fall straight through into the segment
  // sprite-table rebuild spine (loc_2505 is a thin forward to `rebuildSegmentSpriteTables`).
  if ((mem8[loc_43] & 0xaf) === 0) {
    return loc_2505(m); // -> segment sprite-table rebuild spine
  }

  // Past the two quick exits every remaining branch re-seeds the shot cells first.
  seedPlayerShotStartCells(m);

  // --- Priority 3: $86 negative (bit 7 set) means the round/life counter has gone past its floor.
  if ((mem8[loc_86] & 0x80) !== 0) {
    // If $01's high bit is also set, first flip the screen bitmap (transpose) and repaint the record
    // field -- and clear that $01 bit so the flip happens once -- before handing to the reseed chain.
    if ((mem8[loc_01] & 0x80) !== 0) {
      mem8[loc_01] = mem8[loc_01] & 0x7f;
      transposeScreenBitmap(m);
      plotRecordFieldColumns(m); // record-fan spine
    }
    return reseedSegmentSpawnState(m);
  }

  // --- Priority 4: both object cells idle means NO object is left on screen -> recycle the whole board.
  if ((mem8[loc_a5] | mem8[loc_a6]) === 0) {
    // Decrement the life/round counter, then run the sorted-object-table build (range-match/compact).
    mem8[loc_86] = u8(mem8[loc_86] - 1);
    buildSortedObjectTable(m); // range-match/compact spine

    // When a spawn is pending ($ef set) and object-2 has gone negative ($c2 bit7), broadcast a 0x80
    // through the state block, reseed shots, and transpose; repaint the record field if object-1 is
    // negative too. This tears down the on-screen state before the fresh wave is laid.
    if (mem8[loc_ef] !== 0 && (mem8[loc_c2] & 0x80) !== 0) {
      mem8[loc_ee] = 0x80;
      broadcastByteToStateBlock(m);
      seedPlayerShotStartCells(m);
      transposeScreenBitmap(m);
      if ((mem8[loc_c1] & 0x80) !== 0) {
        plotRecordFieldColumns(m); // record-fan spine
      }
    }

    // Wave restart, in place: re-seed the segment spawn state, rebuild the sprite tables, seed the wave
    // numbers, kick the frame flag $00 to 1, draw a pointer row, clear this slot's output latch at
    // 0x1c02+$89, fold the high-score checksum, and load $f9/$fa. This is the path that puts a brand
    // new centipede on a freshly reset board after the last object died.
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

  // --- Priority 5: step a spawn slot forward (the general case, when objects are still on screen).
  // If exactly one slot remains ($89 - 1 == 0), defer to the slot-tick chain rather than switching.
  if (u8(mem8[loc_89] - 1) === 0) {
    return decrementSlotAndRedrawBorders(m); // single slot left -> the slot-tick chain
  }

  // Look at the current slot $88 in the $a4 slot-timer table.
  const slot = mem8[loc_88];
  if (mem8[u8(loc_a4 + slot)] === 0) {
    if (mem8[loc_a7] === 0) {
      // First empty pass on this slot: ARM it for a fresh spawn. Bump the pass counter $a7, reload the
      // interval $87 to 0x80, mark the draw flags $43/$42 as 0xf9, draw two pointer rows, and paint the
      // slot's glyph (slot index OR 0x20). The routine idles until $87 expires again.
      mem8[loc_a7] = u8(mem8[loc_a7] + 1);
      mem8[loc_87] = 0x80;
      mem8[loc_43] = 0xf9;
      mem8[loc_42] = 0xf9;
      writePointerTableRow(m, 0x04);
      writePointerTableRow(m, 0x00);
      writeMaskedByteAndAdvancePointer(m, mem8[loc_88] | 0x20);
      return;
    }
    // A later empty pass instead winds the pass counter back down.
    mem8[loc_a7] = u8(mem8[loc_a7] - 1);
  }

  // Switch to the MIRROR slot (the paired slot on the other side, index ^ 0x03). If it too is empty
  // there is nowhere to spawn -> abandon into the slot-tick chain.
  const mirror = mem8[loc_88] ^ 0x03;
  if (mem8[u8(loc_a4 + mirror)] === 0) {
    return decrementSlotAndRedrawBorders(m);
  }
  // Commit to the live mirror slot as the current slot, and fold its index into the $ee flag byte
  // (keeping bit 7). When the folded flag lands on exactly 0x82 the state-block constants are re-seeded.
  mem8[loc_88] = mirror;
  const flags = (0x80 & mem8[loc_ee]) | mirror;
  mem8[loc_ee] = flags;
  if (flags === 0x82) seedStateBlockConstants(m);

  // Reload the spawn timer from this slot's entry in the $a1 table; slot 1 also broadcasts the state.
  mem8[SPAWN_TIMER] = mem8[u8(loc_a1 + mirror)];
  if (mem8[loc_88] === 0x01) broadcastByteToStateBlock(m);

  transposeScreenBitmap(m);
  // Special case: slot 2 matching slot 0 with $ad clear triggers a FULL playfield reset + mushroom
  // reseed (a fresh field). That sweep walks its column index off the low end, leaving it wrapped to
  // 0xff, which the code below deliberately reuses as the "one past zero" index.
  let cx = mem8[loc_88];
  if (cx === 0x02 && mem8[u8(loc_a4 + cx)] === mem8[loc_a4] && mem8[loc_ad] === 0) {
    mem8[u8(loc_94 + cx)] = 0x0c;
    resetPlayfieldAndSeedMushrooms(m);
    cx = 0xff; // the mushroom sweep leaves its column index wrapped one past zero
  }

  // Mark the chosen slot busy ($c2 |= 0x40), arm its glyph, and hand off to the slot-tick chain.
  mem8[u8(loc_c2 + cx)] = mem8[u8(loc_c2 + cx)] | 0x40;
  mem8[loc_87] = 0xa0;
  writePointerTableRow(m, 0x00);
  writeMaskedByteAndAdvancePointer(m, mem8[loc_88] | 0x20);
  mem8[loc_43] = 0xf9;
  mem8[loc_42] = 0xf9;
  mem8[loc_d6] = 0xf9;
  return decrementSlotAndRedrawBorders(m);
}

// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SCRIPT_ADVANCE_GUARD,
  SLOT_SWEEP_LATCH,
  ENEMY_ACTOR_TABLE,
  SLOT_SWEEP_CKSUM_BASE,
  TAMPER_STRIKES_SLOTSWEEP,
} from "./names.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
/**
 * latchFreeSlotCountAndTamperCheck — the arming gate for the scripted lane-enemy sweep, welded to a
 * self-checking tripwire on the program image.
 *
 * ROM 0x52f6. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * Pooyan releases waves of lane enemies from a six-entry actor pool. The routine that actually walks
 * that pool and activates one actor per script beat (spawnNextScriptedEnemy, ROM 0x5334) refuses to
 * run until a one-shot "sweep armed" latch is set. THIS routine is what sets that latch. Once per
 * arming window it checks that the pool has enough room, records how many entries are open, and — as
 * the price of arming — folds a fixed 23-byte stretch of the program image into a running sum and
 * trips a tamper counter if that sum does not land on its expected sentinel.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Two conditions bracket the work so it fires exactly once per wave-arming, not every frame:
 *   • the board/attract script's advance guard (SCRIPT_ADVANCE_GUARD, 0x8d6d) must be set — nonzero
 *     means the script is in the middle of releasing the next step; when it is clear there is nothing
 *     to arm;
 *   • the sweep latch (SLOT_SWEEP_LATCH, 0x8d6e) must still be clear — once this routine writes it,
 *     both the scripted lane sweep is enabled AND this routine is locked out until the latch is
 *     cleared again elsewhere.
 * So the latch is simultaneously the go-signal handed to spawnNextScriptedEnemy and the self-lockout
 * that makes this a once-only step.
 *
 * LIVE-OUT
 * --------
 *   • SLOT_SWEEP_LATCH (0x8d6e) ← the count of free records (nonzero: arms the scripted lane sweep).
 *   • TAMPER_STRIKES_SLOTSWEEP (0x89e8) ← incremented, but only when the code-block checksum misses.
 * It returns nothing meaningful; its whole effect lives in those two cells.
 */

// Sweep geometry and the checksum's expected result.
//   SLOT_COUNT / SLOT_STRIDE describe the enemy-actor record pool at ENEMY_ACTOR_TABLE (0x8ae0):
//     six records, each 0x18 bytes apart.
//   MIN_FREE is the room the wave needs before it may be armed.
//   CKSUM_LEN is how many bytes of the program image are folded into the tamper sum; CKSUM_LO/HI are
//     the low and high bytes the 16-bit sum lands on when the folded code block is intact.
const SLOT_COUNT = 6; // records swept
const SLOT_STRIDE = 0x18; // record pitch
const MIN_FREE = 4; // fewer free than this and the sweep bails
const CKSUM_LEN = 0x17; // bytes folded into the running sum
const CKSUM_LO = 0x15; // expected low byte of the sum
const CKSUM_HI = 0x09; // expected high byte of the sum

export function latchFreeSlotCountAndTamperCheck(m) {
  const { mem8 } = m;

  // Arming window guards. Run only while the script is mid-advance (SCRIPT_ADVANCE_GUARD 0x8d6d set)
  // and the sweep has not already been armed this cycle (SLOT_SWEEP_LATCH 0x8d6e still clear). Either
  // guard failing means there is nothing to arm this pass.
  if (mem8[SCRIPT_ADVANCE_GUARD] === 0) return; // guard clear
  if (mem8[SLOT_SWEEP_LATCH] !== 0) return; // already swept

  // Count the free records in the lane-enemy actor pool at ENEMY_ACTOR_TABLE (0x8ae0). Each record is
  // SLOT_STRIDE (0x18) bytes long; a record is free when its leading word is zero (byte0 is the
  // record-active flag, so byte0|byte1 == 0 means the slot is empty). Walk all six.
  let free = 0;
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((mem8[rec] | mem8[rec + 1]) === 0) free++; // empty: leading word zero
    rec = u16(rec + SLOT_STRIDE);
  }

  // Room gate: do not arm a wave unless at least MIN_FREE (4) of the six records are open.
  if (free < MIN_FREE) return;

  // Arm the sweep. Writing the free count into SLOT_SWEEP_LATCH (0x8d6e) does double duty: it records
  // how many slots the scripted lane sweep may fill, and — being nonzero — both enables that sweep
  // (spawnNextScriptedEnemy) and locks this routine out until the latch is cleared again.
  mem8[SLOT_SWEEP_LATCH] = free;

  // Anti-tamper tripwire. Fold CKSUM_LEN (0x17 = 23) bytes of the program image into a 16-bit running
  // sum, starting at SLOT_SWEEP_CKSUM_BASE (0x0bf3) and walking downward. That block is actually a
  // stretch of code read as data, so the sum is a fingerprint of the ROM image. Each byte is added
  // into the total through the machine's restart-vector add primitive at 0x0020 (base + index): here
  // the running sum is the base and the fetched code byte is the index, so the returned pointer is
  // simply sum + code[src], which becomes the new sum.
  let sum = 0;
  let src = SLOT_SWEEP_CKSUM_BASE;
  for (let i = 0; i < CKSUM_LEN; i++) {
    sum = fetchByteFromTableIndex(m, sum, mem8[src])[1]; // fold: sum += code[src]
    src = u16(src - 1);
  }

  // Verdict. On an intact image the 16-bit sum lands on CKSUM_HI:CKSUM_LO (0x0915); if so, the code
  // block is unmodified and no strike is recorded. Any other value means the checked code has been
  // altered, so bump the anti-tamper strike counter TAMPER_STRIKES_SLOTSWEEP (0x89e8) — a counter the
  // eagle-spawn handler also reads.
  if ((sum & 0xff) === CKSUM_LO && (sum >> 8) === CKSUM_HI) return; // checksum matches
  mem8[TAMPER_STRIKES_SLOTSWEEP] = u8(mem8[TAMPER_STRIKES_SLOTSWEEP] + 1);
}

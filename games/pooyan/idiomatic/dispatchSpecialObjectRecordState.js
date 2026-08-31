// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectToNextStateAndArmAnim } from "./advanceObjectToNextStateAndArmAnim.js";
import { advanceObjectAscentStep } from "./advanceObjectAscentStep.js";
import { verifyPlayfieldTileChecksumOnce } from "./verifyPlayfieldTileChecksumOnce.js";
import { ENEMY_REC_DISPATCH_GATE, ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * dispatchSpecialObjectRecordState — run one frame of the special-object record's state machine.
 * ROM 0x6822. [seen]
 *
 * WHAT IT IS: the per-frame state dispatcher for a single "special object" record that lives
 * inside the enemy-actor pool arena — the record at 0x8b28, which is ENEMY_ACTOR_TABLE (0x8ae0)
 * plus a fixed 0x48-byte offset. Unlike the ordinary pooya/launched-object records that share
 * that arena, this one record drives an object that climbs the playfield and folds the ROM's
 * anti-tamper checks into its own lifecycle. Every frame the object is live, this routine takes
 * exactly one step of its state machine and returns.
 *
 * ITS ROLE IN THE MACHINE: a router, not a mover. It is the last thing the fountain/spawn update
 * pass (runObjectAndSpawnUpdatePass) does on the frames it runs: it reads the record's state byte
 * and picks one of three fates for the object this frame, then returns to that pass. It moves
 * nothing itself — each of the three handlers does the real work and returns straight back to the
 * caller of this routine.
 *
 * A single gate byte, ENEMY_REC_DISPATCH_GATE (0x8afa), arms the whole thing. While it reads zero
 * the object is dormant and this routine returns immediately, touching nothing. Only when the gate
 * is nonzero does the state byte at rec+0x02 get read and dispatched:
 *   - state 0 -> advance the object to its next state (ROM 0x683a): bump its phase, reseed its
 *     record fields, and arm the next animation. This is the transition/setup step.
 *   - state 1 -> take one ascent step (ROM 0x6857): run the animation sequencer, subtract the
 *     per-frame speed from the object's 16-bit vertical position, and — once it climbs past the
 *     top row — advance its state and run the two-pass HUD-strip integrity checksum before
 *     enqueuing its display update. This is the object moving up the screen.
 *   - state 2 -> run the once-only playfield tile-region tamper checksum (ROM 0x68ac): a latched
 *     integrity probe over the tilemap that passes silently on a clean image and trips on tamper.
 * The three targets are the three entries of the dispatch table at ROM 0x6834 (0x683a, 0x6857,
 * 0x68ac), selected by the state byte.
 *
 * LIVE-OUT: memory only. Nothing is handed back for the caller to read — the fountain/spawn pass
 * keeps its own state across this call, and every effect this routine produces lives in the
 * object's record and in the memory the three handlers touch.
 */
// The special-object record sits at a fixed 0x48-byte offset above the base of the enemy-actor
// pool (ENEMY_ACTOR_TABLE, 0x8ae0), i.e. at 0x8b28 — the one record this dispatcher works.
const RECORD = 0x48; // record offset from ENEMY_ACTOR_TABLE

export function dispatchSpecialObjectRecordState(m) {
  const { mem8 } = m;
  // Arming gate: ENEMY_REC_DISPATCH_GATE (0x8afa). While the object is dormant this byte reads
  // zero and the entire state dispatch is skipped — no record is touched this frame.
  if (mem8[ENEMY_REC_DISPATCH_GATE] === 0) return; // gate closed
  // Address the special-object record at 0x8b28 (ENEMY_ACTOR_TABLE + 0x48). Its state byte lives
  // at rec+0x02 and is the object's position in its own state machine.
  const rec = ENEMY_ACTOR_TABLE + RECORD;
  // Read the state byte and route to the matching entry of the 3-word dispatch table at ROM
  // 0x6834. Each handler runs one frame of work for the object and returns to this routine's caller.
  switch (mem8[rec + 0x02]) {
    // State 0 (table entry 0, ROM 0x683a) — transition step: bump the object's phase, reseed its
    // record fields, and arm its next animation before it starts moving.
    case 0: return advanceObjectToNextStateAndArmAnim(m, rec);
    // State 1 (table entry 1, ROM 0x6857) — ascent step: animate and subtract the per-frame speed
    // from the 16-bit vertical position; on reaching the top row, advance state and run the
    // HUD-strip two-pass integrity checksum, then enqueue the object's display update.
    case 1: return advanceObjectAscentStep(m, rec);
    // State 2 (table entry 2, ROM 0x68ac) — once-only playfield tile-region tamper checksum: a
    // latched anti-tamper probe over the tilemap that returns on a clean image and throws on tamper.
    case 2: return verifyPlayfieldTileChecksumOnce(m);
    // The dispatch table has exactly three entries, so a state byte above 2 is out of range and
    // never occurs on a healthy record. Fail loud rather than index past the table.
    default:
      throw new Error("dispatchSpecialObjectRecordState: record state > 2 (guard-slack; the table has 3 entries)");
  }
}

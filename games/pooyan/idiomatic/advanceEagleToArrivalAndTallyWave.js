// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  EAGLE_X_COORD,
  EAGLE_Y_COORD,
  EAGLE_ODD_RECORD_ANIM,
  EAGLE_EVEN_RECORD_ANIM,
  WAVE_RECORDS_ARRIVED,
  WAVE_INDEX,
  WAVE_ARRIVAL_CMD_BASE,
} from "./names.js";
/**
 * advanceEagleToArrivalAndTallyWave — state-0 (approach) handler for one eagle record.
 * ROM 0x733c.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The bonus stage runs its own attack wave: a set of eagle records, seeded in
 *   pairs, that fly in from off-screen toward fixed target slots on the tile grid.
 *   Each record steps through three states, held in its own state byte at rec+2;
 *   this routine is state 0, the approach. It watches the single live eagle's
 *   on-screen position and does nothing until that eagle has flown into THIS
 *   record's target grid slot — only then does it commit the record's arrival.
 *
 * ROLE IN THE MACHINE
 *   Run once per frame for each active eagle record while the record sits in
 *   state 0. It is the gate that turns a moving eagle into an "arrived" one:
 *   it promotes the record to its next state, starts the record's arrival
 *   animation, and — for the second record of each pair — keeps the running
 *   count of how many records of the wave have landed. When the whole wave has
 *   landed it queues the wave-arrival command so the rest of the machine can
 *   react to a completed wave (the wave-complete effect/sound).
 *
 * THE RECORD PAIRING
 *   Records are seeded two at a time. Bit 3 of the record pointer's low byte
 *   (IXL) tells the two halves of a pair apart: an "odd" record (bit set) and an
 *   "even" record (bit clear). The two halves arm different arrival animations
 *   and carry different flag-byte values, and only the even half tallies the
 *   wave — so each pair contributes exactly one to the arrived count.
 *
 * LIVE-OUT (memory only; no return value)
 *   - rec+2 : record state, advanced by one on arrival.
 *   - rec+9 : the record's flag byte, set to 0x38 (odd half) or 0x40 (even half).
 *   - the record's animation sequence is (re)started via setActorAnimation.
 *   - WAVE_RECORDS_ARRIVED (0x8f39) : bumped once per even-half arrival.
 *   - the display-command ring : receives the wave-arrival command word when the
 *     wave's last record lands.
 */

export function advanceEagleToArrivalAndTallyWave(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Column gate ----------------------------------------------------------
  // The eagle's live screen X (EAGLE_X_COORD, 0x8c96) shifted right by 3 (÷8) is
  // its grid column; this record's target column sits at rec+6. Accept the eagle
  // as being in this slot's column if it is exactly there OR one column short
  // (still sliding in), i.e. `column` or `column+1` equals the target. Anything
  // else means the eagle has not reached this record's slot yet — leave it be.
  const column = mem8[EAGLE_X_COORD] >> 3;
  const targetColumn = mem8[rec + 0x06];
  if (column !== targetColumn && ((column + 1) & 0xff) !== targetColumn) return;

  // --- Row gate (five-row arrival window) -----------------------------------
  // The eagle's live screen Y (EAGLE_Y_COORD, 0x8c94) shifted right by 3 (÷8),
  // plus 4, is its grid row; this record's target row sits at rec+4. An exact
  // match arrives. Otherwise, if the eagle is still above the target row
  // (row < targetRow) it has not arrived; and if it has already dropped more
  // than four rows past the target (row-5 >= targetRow) it is below the window.
  // So arrival is the five-row band [targetRow .. targetRow+4]; outside it the
  // record stays in approach.
  const row = ((mem8[EAGLE_Y_COORD] >> 3) + 0x04) & 0xff;
  const targetRow = mem8[rec + 0x04];
  if (row !== targetRow) {
    if (row < targetRow) return; //                       eagle above the target row
    if (((row - 0x05) & 0xff) >= targetRow) return; //     outside the five-row window
  }

  // --- Arrival: advance the record's state ----------------------------------
  // The eagle is in the slot. Bump the record's state byte (rec+2) so from next
  // frame this record is driven by its state-1 (dive/climb) body instead of the
  // approach handler.
  mem8[rec + 0x02] = (mem8[rec + 0x02] + 1); //     advance record state

  // --- Odd half of the pair -------------------------------------------------
  // Bit 3 of the record pointer's low byte (IXL) selects the odd half of the
  // seeded pair. The odd half arms the odd arrival animation, stamps its flag
  // byte (rec+9) with 0x38, and is finished — it deliberately does NOT touch the
  // wave tally, so a pair is counted exactly once (by its even half, below).
  if ((rec & 0x08) !== 0) { //                             odd record (bit 3 of IXL)
    setActorAnimation(m, rec, EAGLE_ODD_RECORD_ANIM);
    mem8[rec + 0x09] = 0x38;
    return;
  }

  // --- Even half of the pair ------------------------------------------------
  // The even half arms the even arrival animation and stamps its flag byte
  // (rec+9) with 0x40; it is the half that tallies the wave.
  setActorAnimation(m, rec, EAGLE_EVEN_RECORD_ANIM);
  mem8[rec + 0x09] = 0x40;

  // Count this arrival: bump WAVE_RECORDS_ARRIVED (0x8f39), the number of records
  // that have landed in the current wave. The wave is complete once that count
  // reaches the wave's record total, held in WAVE_INDEX (0x8f3d); until it does,
  // there is nothing more to do for this arrival.
  const arrived = (mem8[WAVE_RECORDS_ARRIVED] + 1) & 0xff;
  mem8[WAVE_RECORDS_ARRIVED] = arrived;
  if (mem8[WAVE_INDEX] !== arrived) return; //             wave not yet complete

  // --- Whole wave has arrived -----------------------------------------------
  // Every record of the wave has landed. Queue the wave-arrival command:
  // WAVE_ARRIVAL_CMD_BASE (0x0630) with its low byte offset by the arrived count,
  // so each wave size selects a distinct command word. enqueueDisplayCommand
  // drops the two-byte word into the display-command ring for the rest of the
  // machine to act on.
  const cmdLow = ((WAVE_ARRIVAL_CMD_BASE & 0xff) + arrived) & 0xff;
  enqueueDisplayCommand(m, WAVE_ARRIVAL_CMD_BASE - (WAVE_ARRIVAL_CMD_BASE & 0xff) + cmdLow);
}

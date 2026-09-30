// SPDX-License-Identifier: GPL-3.0-only
/** blankOneLineThenGuardBlockOrDerailSequence — one turn of the line wipe, and when the wipe finishes, one tamper test.
 *
 * A single line is blanked per turn and the turn ends there while lines are still owed. On the
 * turn that clears the last one, a fixed 1024-byte block of the program image is folded together
 * with exclusive-or into one eight-bit total and compared against the total an untampered image
 * gives. Matching steps the sequence's inner index on, so the sequence carries on; not matching
 * steps the OUTER phase instead, which restarts the inner index somewhere else entirely.
 * LIVE-OUT: memory only.
 *
 * ROM 0x2CDB-0x2CF4 (frozen lift translated/loc_2cdb.js). Grounding: [seen] (names.js ROUTINES).
 *
 * ROLE IN THE MACHINE. Step 1 of sequence phase 2, the credit / push-start screen (mechanisms.md).
 * The step before it, parkSpritesAndArmLineWipeThenAdvanceSequence, arms the wipe through
 * armLineWipeFromFifthLine; this entry then runs once per frame and erases one line each time,
 * returning without stepping the sequence until blankNextLine reports the last line done -- that
 * early return is how the sequence machine spreads a wipe over frames.
 *
 * It belongs to the same family as guardBlockOrDerailSequence (0x3252): both are an XOR fold of a
 * fixed span against a baked-in constant, advanceSequenceSubStep on a match and advanceSequencePhase
 * on a mismatch. Only the span differs, and here the fold waits behind the wipe.
 */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { blankNextLine } from "./blankNextLine.js";
import { IMAGE_GUARD_BLOCK_4980_BASE } from "./names.js";

// The fold runs 4 x 256 bytes (ROM `ld bc,0x0004` with the inner `djnz` counting B from zero)
// and an untampered image folds to 0x43 (the ROM tests `add a,0xbd`, which is zero only for 0x43).
const BLOCK_BYTES = 1024;
const UNTAMPERED_TOTAL = 0x43;

export function blankOneLineThenGuardBlockOrDerailSequence(m) {
  const { mem8 } = m;
  // One line of the wipe (ROM `call 0x01c2 / ret nz`): blankNextLine blanks the line and counts
  // BLANK_LINES_LEFT down, reporting whether that was the last. While lines remain, the turn ends
  // here and the sequence stays on this step, so this entry runs again next frame.
  if (!blankNextLine(m)) return;

  // The wipe is finished: XOR together the 1024 program bytes from 0x4980 (ROM 0x2CDF-0x2CED,
  // `xor (hl) / inc hl` in a djnz loop nested inside a `dec c / jr nz` loop). The span is
  // ordinary program code (routines such as 0x4A42, 0x4A9D and 0x4ACC lie inside it), read here
  // as data (IMAGE_GUARD_BLOCK_4980_BASE in names.js).
  let total = 0;
  for (let i = 0; i < BLOCK_BYTES; i++) total ^= mem8[IMAGE_GUARD_BLOCK_4980_BASE + i];

  // A tampered image (ROM `jp nz,0x0f11`): step the OUTER sequence phase instead of the inner
  // index. The machine does not stop; it lands in a different phase with its inner index
  // restarted, which derails the sequence rather than reporting anything.
  if (total !== UNTAMPERED_TOTAL) {
    advanceSequencePhase(m);
    return;
  }
  // A genuine image (ROM `jp 0x0f1a`): step the inner index so the next frame runs the phase's
  // next step.
  advanceSequenceSubStep(m);
}

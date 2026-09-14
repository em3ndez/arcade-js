// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_29, loc_2a, loc_31, SLOT_LOOP_INDEX, TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X,
  TIMER2_LO, TIMER2_MID, TIMER2_HI, COORD_ACC_LO, COORD_ACC_HI, DIGIT_IN_LO, DIGIT_IN_HI, DIV_QUOTIENT, DIV_REMAINDER,
  MATHBOX_LD_RA_LO, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI,
} from "./names.js";
import { runMathboxDivide } from "./runMathboxDivide.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";

// addDecimal — one 6502-style decimal-mode ADC of two bytes plus carry-in, returning [result, carry-out].
// The low nibble is added and BCD-corrected (+6 when it overflows 9), then the high nibble is added and
// corrected (+0x60 when it reaches 0xa0). Used below as the "double" step of double-dabble: adding a value
// to itself in BCD is a decimal shift-left-with-carry. Returns the 8-bit result and whether it carried out.
function addDecimal(a, v, carryIn) {
  let al = (a & 0x0f) + (v & 0x0f) + (carryIn ? 1 : 0);
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;    // low-nibble BCD correction
  let sum = (a & 0xf0) + (v & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;                 // high-nibble BCD correction
  return [sum & 0xff, sum > 0xff];
}

/**
 * buildLargeDecimalNumber — convert scaled binary coordinates to decimal display digits. ROM 0xdd41.
 *
 * Role in the machine: Tempest draws large on-screen numbers (score-style / positional decimal readouts) as
 * vector digit runs. This routine takes a binary input pair, doubles-and-adds it into the math-box operand
 * cells, seeds a divide, and then converts a three-byte binary source into decimal via double-dabble,
 * emitting the converted digits as scaled coordinate records the vector generator can draw.
 *
 * Behavior: first fold the input. DIGIT_IN_LO/HI are shifted left one (a doubling), the low carry threaded
 * into the high byte via carryHi, and added to the COORD_ACC_LO/HI accumulator; the sum lands in the
 * math-box R7 operand cells MATHBOX_LD_R7_LO/HI (loc_6095/loc_6096) and is floored to a minimum of one (the
 * 0x01 fixup when the whole result is zero, so a later divide never sees a zero operand). Load
 * MATHBOX_LD_RA_LO from TIMER2_LO and run runMathboxDivide over TIMER2_MID/HI, stashing quotient/remainder
 * in DIV_QUOTIENT/DIV_REMAINDER, then emit a fixed coordinate header word. The outer loop runs four times
 * (SLOT_LOOP_INDEX 0x04..): each pass clears the 4-byte BCD accumulator at loc_31, loads three source bytes
 * through the WORK_PTR (seeded to 0x0406) into PROJ_PT_Y / OBJ_DEPTH / PROJ_PT_X, then runs 24 inner
 * iterations (TABLE_CURSOR 0x17..0) of double-dabble: shift the 24-bit binary source left one bit (carry
 * chained low-to-high across the three bytes), and shift-add the 4-byte BCD accumulator into itself with
 * addDecimal so it tracks the binary value in packed decimal. After the 24 bits, emit the converted digit
 * run (emitNibbleDigitRun over loc_31) and a scaled coordinate record (emitScaledCoordinateRecord).
 *
 * Live-out: the math-box operand cells (loc_6095/loc_6096, MATHBOX_LD_RA_LO), DIV_QUOTIENT/DIV_REMAINDER,
 * and the emitted vector digit/coordinate records for the number being drawn. Grounding: [seen].
 */
export function buildLargeDecimalNumber(m) {
  const { mem8, mem16 } = m;
  // Double the little-endian input pair (shift left one, threading the low byte's top bit into the high).
  const carryHi = mem8[DIGIT_IN_LO] & 0x80 ? 1 : 0;
  mem8[loc_29] = mem8[DIGIT_IN_LO] << 1;
  mem8[loc_2a] = (mem8[DIGIT_IN_HI] << 1) | carryHi;
  // Add the doubled input into the coordinate accumulator; the sum is the math-box R7 operand.
  const lo = mem8[COORD_ACC_LO] + mem8[loc_29];
  mem8[MATHBOX_LD_R7_LO] = lo;
  mem8[loc_29] = lo;
  const hi = mem8[COORD_ACC_HI] + mem8[loc_2a] + (lo > 0xff ? 1 : 0);
  mem8[MATHBOX_LD_R7_HI] = hi;
  if (((hi & 0xff) | mem8[loc_29]) === 0) mem8[MATHBOX_LD_R7_LO] = 0x01;  // floor the operand to one
  // Seed and run the math-box divide, keeping quotient and remainder.
  mem8[MATHBOX_LD_RA_LO] = mem8[TIMER2_LO];
  const [q, , r] = runMathboxDivide(m, mem8[TIMER2_MID], mem8[TIMER2_HI]);
  mem8[DIV_QUOTIENT] = q;
  mem8[DIV_REMAINDER] = r;
  emitCoordinateVectorWord(m, 0x3d, 0xce);        // emit the fixed coordinate header word
  mem8[WORK_PTR_LO] = 0x06;                        // source pointer -> 0x0406
  mem8[WORK_PTR_HI] = 0x04;
  mem8[SLOT_LOOP_INDEX] = 0x04;                    // outer loop: four numbers
  do {
    // Clear the 4-byte BCD accumulator and load this number's three binary source bytes.
    mem8[loc_31] = 0x00;
    mem8[loc_31 + 1] = 0x00;
    mem8[loc_31 + 2] = 0x00;
    mem8[loc_31 + 3] = 0x00;
    mem8[PROJ_PT_Y] = mem8[mem16[WORK_PTR_LO]];
    mem8[WORK_PTR_LO] = mem8[WORK_PTR_LO] + 1;
    mem8[OBJ_DEPTH] = mem8[mem16[WORK_PTR_LO]];
    mem8[WORK_PTR_LO] = mem8[WORK_PTR_LO] + 1;
    mem8[PROJ_PT_X] = mem8[mem16[WORK_PTR_LO]];
    mem8[WORK_PTR_LO] = mem8[WORK_PTR_LO] + 1;
    let carry = false;
    mem8[TABLE_CURSOR] = 0x17;                     // 24 inner bits (0x17..0) = double-dabble over 3 bytes
    do {
      // Shift the 24-bit binary source left one, chaining carry from Y through DEPTH into X.
      let shifted = (mem8[PROJ_PT_Y] << 1) | (carry ? 1 : 0);
      carry = (mem8[PROJ_PT_Y] & 0x80) !== 0;
      mem8[PROJ_PT_Y] = shifted;
      shifted = (mem8[OBJ_DEPTH] << 1) | (carry ? 1 : 0);
      carry = (mem8[OBJ_DEPTH] & 0x80) !== 0;
      mem8[OBJ_DEPTH] = shifted;
      shifted = (mem8[PROJ_PT_X] << 1) | (carry ? 1 : 0);
      carry = (mem8[PROJ_PT_X] & 0x80) !== 0;
      mem8[PROJ_PT_X] = shifted;
      // Decimal shift-left-with-carry: BCD-double each accumulator byte, threading the bit shifted out.
      for (let d = 0; d <= 3; d++) {
        const [sum, out] = addDecimal(mem8[loc_31 + d], mem8[loc_31 + d], carry);
        mem8[loc_31 + d] = sum;
        carry = out;
      }
      mem8[TABLE_CURSOR] = mem8[TABLE_CURSOR] - 1;
    } while ((mem8[TABLE_CURSOR] & 0x80) === 0);   // loop until the bit count wraps past 0
    // Emit this number's decimal digit run and its scaled coordinate record.
    emitNibbleDigitRun(m, 0x31, 0x04);
    emitScaledCoordinateRecord(m, 0xd0, 0xf8);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
  } while ((mem8[SLOT_LOOP_INDEX] & 0x80) === 0);  // repeat for all four numbers
}

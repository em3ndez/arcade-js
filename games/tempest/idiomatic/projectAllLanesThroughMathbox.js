// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import {
  SLOT_LOOP_INDEX, TABLE_CURSOR, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, CLAMP_TALLY,
  PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI,
  COL_VAL_A, COL_SUB_A, COL_VAL_B, COL_SUB_B, SEG_BASE_X, SEG_BASE_Y,
} from "./names.js";

/**
 * projectAllLanesThroughMathbox -- project all sixteen tube lanes to screen and clamp the results. ROM 0xc473.
 *
 * Role in the machine: Tempest's playfield is a tube of sixteen lanes, and each lane's base corner has
 * to be projected from tube space into a screen coordinate every time the geometry changes. This routine
 * runs the sixteen-lane sweep: for each lane it loads that lane's base X/Y from the segment tables, pushes
 * the point through the shared math-box projector, then saturates both signed high-byte results into the
 * small on-screen window [-4..+3] (0xfc..0x03) and records how many lanes had to be clamped. The clamp
 * count is the game's cue that the tube is being viewed at a steep angle where lanes fold together.
 *
 * Behavior: seeds OBJ_DEPTH ($57) from A and TABLE_CURSOR ($38) from x (the output index), clears the
 * clamp tally CLAMP_TALLY ($59), and sets the loop counter SLOT_LOOP_INDEX to 0x0f. Each pass reads the
 * lane column, loads PROJ_PT_Y ($56) from SEG_BASE_X+col ($3ce,col) and PROJ_PT_X ($58) from SEG_BASE_Y+col
 * ($3de,col), and calls projectPointThroughMathbox to fill the PROJ_*_LO/HI accumulators. It clamps the
 * (hi,lo) pair PROJ_Y_HI/PROJ_Y_LO into value/sign v1/s1 and writes them to COL_VAL_A/COL_SUB_A
 * ($31a/$32a) at the output cursor, then clamps PROJ_X_HI/PROJ_X_LO into v2/s2 written to COL_VAL_B/COL_SUB_B
 * ($33a/$34a); each clamp bumps the tally. The output cursor and loop index both decrement; the loop ends
 * when the index goes negative (bit 7 set). Returns the clamp count in A.
 *
 * Live-out: the value/sign arrays $31a/$32a and $33a/$34a filled for all 16 lanes, the clamp tally $59
 * (also returned in regs.a), and the spent $57/$38 cursors. Grounding: [seen].
 */
export function projectAllLanesThroughMathbox(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[OBJ_DEPTH] = a;              // depth seed for the projector ($57)
  mem8[TABLE_CURSOR] = x;           // output cursor into the value/sign arrays ($38)
  mem8[CLAMP_TALLY] = 0x00;         // clear the clamp counter ($59)
  mem8[SLOT_LOOP_INDEX] = 0x0f;     // sixteen lanes: 0x0f down to 0

  for (;;) {
    const col = mem8[SLOT_LOOP_INDEX];
    mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + col)]; // lane base X -> $56
    mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + col)]; // lane base Y -> $58
    projectPointThroughMathbox(m);                 // tube point -> screen accumulators

    const out = mem8[TABLE_CURSOR];
    // Clamp the Y result (hi,lo) to [-4..+3] and store value/sign in the A arrays.
    const [v1, s1, c1] = clamp(mem8[PROJ_Y_HI], mem8[PROJ_Y_LO]);
    if (c1) mem8[CLAMP_TALLY] = u8(mem8[CLAMP_TALLY] + 1);
    mem8[u16(COL_VAL_A + out)] = v1;
    mem8[u16(COL_SUB_A + out)] = s1;

    // Clamp the X result the same way into the B arrays.
    const [v2, s2, c2] = clamp(mem8[PROJ_X_HI], mem8[PROJ_X_LO]);
    if (c2) mem8[CLAMP_TALLY] = u8(mem8[CLAMP_TALLY] + 1);
    mem8[u16(COL_VAL_B + out)] = v2;
    mem8[u16(COL_SUB_B + out)] = s2;

    mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1); // step output cursor down
    const next = u8(mem8[SLOT_LOOP_INDEX] - 1);
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;         // index went negative -> all 16 lanes done
  }

  return (m.regs.a = mem8[CLAMP_TALLY]); // hand back the clamp count
}

// Saturate a signed value/sign pair to the [-4..+3] window, reporting whether it clamped.
// Negative side floors at -4 (0xfc, sign 0x01); positive side caps at +3 (0x03, sign 0xff).
function clamp(value, sign) {
  if (value & 0x80) {
    if (value < 0xfc) return [0xfc, 0x01, true];  // below -4 -> floor
  } else if (value >= 0x04) {
    return [0x03, 0xff, true];                    // above +3 -> cap
  }
  return [value, sign, false];                    // already inside the window
}

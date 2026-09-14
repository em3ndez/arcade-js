// SPDX-License-Identifier: GPL-3.0-only
import {
  SEG_SPREAD_A_LO, SEG_SPREAD_A_HI, SEG_SPREAD_A_HI_1, SEG_SPREAD_B_LO, SEG_SPREAD_B_HI, SEG_SPREAD_B_HI_1,
  MATHBOX_LD_R0_LO, MATHBOX_LD_R0_HI, MATHBOX_LD_R1_HI, MATHBOX_LD_R2_LO, MATHBOX_LD_R2_HI, MATHBOX_LD_R3_LO, MATHBOX_LD_R3_HI,
  MATHBOX_LD_R4_HI, MATHBOX_LD_R6_COUNT, MATHBOX_LD_RA_LO, MATHBOX_LD_RA_HI, MATHBOX_LD_RB_LO, MATHBOX_LD_RB_HI,
} from "./names.js";

/**
 * resetMathboxInputs — clear the working state before a tube-projection run. ROM 0xc1c3.
 *
 * Role in the machine: Tempest renders its 3D tube with a hardware "mathbox" coprocessor at $6080; the
 * CPU loads operands into the mathbox's input registers, arms it, and reads back projected coordinates.
 * This routine, called at the top of buildFrameVectors each frame, wipes the zero-page scratch cells
 * and the whole mathbox input block to a clean slate so a fresh projection pass starts from zero, then
 * arms the coprocessor by writing its control latch.
 *
 * Behavior: it zeroes six zero-page segment-spread scratch cells ($78/$80/$81/$88/$90/$91 — the A/B
 * lo/hi/hi+1 pairs), then zeroes the mathbox input registers $6080/$6081/$6083/$6084/$6085/$6086/
 * $6087/$6089/$608d/$608e/$608f/$6090 (the R0/R1/R2/R3/R4/RA/RB load ports). Finally it writes 0x0f
 * into the mathbox control latch $608c (MATHBOX_LD_R6_COUNT) to arm the coprocessor for the run.
 *
 * Live-out: the six segment-spread scratch cells and the twelve mathbox operand registers all cleared,
 * and the mathbox control latch $608c set to 0x0f (armed). Grounding: [seen].
 */
export function resetMathboxInputs(m) {
  const { mem8 } = m;
  // Zero-page segment-spread scratch: A and B, low/high/high+1.
  mem8[SEG_SPREAD_A_HI_1] = 0;
  mem8[SEG_SPREAD_B_HI_1] = 0;
  mem8[SEG_SPREAD_A_HI] = 0;
  mem8[SEG_SPREAD_A_LO] = 0;
  mem8[SEG_SPREAD_B_HI] = 0;
  mem8[SEG_SPREAD_B_LO] = 0;
  // Mathbox operand load registers ($6080 block): R0/R1/R2/R3/R4/RA/RB, lo & hi.
  mem8[MATHBOX_LD_R0_LO] = 0;
  mem8[MATHBOX_LD_R0_HI] = 0;
  mem8[MATHBOX_LD_R2_LO] = 0;
  mem8[MATHBOX_LD_R2_HI] = 0;
  mem8[MATHBOX_LD_R3_LO] = 0;
  mem8[MATHBOX_LD_R3_HI] = 0;
  mem8[MATHBOX_LD_R4_HI] = 0;
  mem8[MATHBOX_LD_R1_HI] = 0;
  mem8[MATHBOX_LD_RA_LO] = 0;
  mem8[MATHBOX_LD_RA_HI] = 0;
  mem8[MATHBOX_LD_RB_LO] = 0;
  mem8[MATHBOX_LD_RB_HI] = 0;
  // Arm the coprocessor: control latch $608c = 0x0f.
  mem8[MATHBOX_LD_R6_COUNT] = 0x0f;
}

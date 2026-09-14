// SPDX-License-Identifier: GPL-3.0-only
import {
  SEG_SPREAD_A_LO, SEG_SPREAD_A_HI, SEG_SPREAD_A_HI_1, SEG_SPREAD_B_LO, SEG_SPREAD_B_HI, SEG_SPREAD_B_HI_1,
  MATHBOX_LD_R0_LO, MATHBOX_LD_R0_HI, MATHBOX_LD_R1_HI, MATHBOX_LD_R2_LO, MATHBOX_LD_R2_HI, MATHBOX_LD_R3_LO, MATHBOX_LD_R3_HI,
  MATHBOX_LD_R4_HI, MATHBOX_LD_R6_COUNT, MATHBOX_LD_RA_LO, MATHBOX_LD_RA_HI, MATHBOX_LD_RB_LO, MATHBOX_LD_RB_HI,
} from "./names.js";

// Clear a set of zero-page work cells and math-coprocessor input registers, then set one control register.
export function resetMathboxInputs(m) {
  const { mem8 } = m;
  mem8[SEG_SPREAD_A_HI_1] = 0;
  mem8[SEG_SPREAD_B_HI_1] = 0;
  mem8[SEG_SPREAD_A_HI] = 0;
  mem8[SEG_SPREAD_A_LO] = 0;
  mem8[SEG_SPREAD_B_HI] = 0;
  mem8[SEG_SPREAD_B_LO] = 0;
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
  mem8[MATHBOX_LD_R6_COUNT] = 0x0f;
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCyclePaint — pick this frame's colour-cycle painter from the sweep counter and run
 * it. Bit 6 of the counter toggles between the high colour code (upper half) and the low code
 * (lower half); the 100m rivet board has its own two-column blink block. The counter flows on into
 * the chosen painter as the blink phase, alongside the row stride.
 *
 * LIVE-OUT: memory-only, all written by the chosen painter.
 */
import { BOARD, ANIM_STEP_COUNTER } from "./names.js";
import { runRivetColorCycleBlink } from "./runRivetColorCycleBlink.js";
import { paintColorColumnWithLowCode } from "./paintColorColumnWithLowCode.js";
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js";

const RIVET_BOARD = 4;
const ROW_STRIDE = 0x20;
const SWEEP_PHASE_BIT = 0x40;
const HIGH_COLOR_CODE = 0xef;

export function dispatchColorCyclePaint(m) {
  const { regs, mem8 } = m;

  const sweepPhase = mem8[ANIM_STEP_COUNTER];

  // C = blink phase and DE = row stride are the common painter inputs; each dispatch
  // rides those writes (plus A on the high-code arm) onto its return.
  if (mem8[BOARD] === RIVET_BOARD) {
    return runRivetColorCycleBlink((regs.c = sweepPhase, regs.de = ROW_STRIDE, m));
  }
  if (sweepPhase === 0) {
    return paintColorColumnWithLowCode((regs.c = sweepPhase, regs.de = ROW_STRIDE, m));
  }
  if (sweepPhase & SWEEP_PHASE_BIT) {
    return paintColorColumnAndHoldBlink((regs.c = sweepPhase, regs.de = ROW_STRIDE, regs.a = HIGH_COLOR_CODE, m));
  }
  return paintColorColumnWithLowCode((regs.c = sweepPhase, regs.de = ROW_STRIDE, m));
}

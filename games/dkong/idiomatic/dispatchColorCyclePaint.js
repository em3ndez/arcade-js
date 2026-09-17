// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCyclePaint — pick this frame's colour-cycle painter from the sweep counter and run
 * it. Bit 6 of the counter toggles between the high colour code (upper half) and the low code
 * (lower half); the 100m rivet board has its own two-column blink block. The counter flows on into
 * the chosen painter as the blink phase, alongside the row stride.
 *
 * LIVE-OUT: memory-only, all written by the chosen painter.
 */
import { BOARD } from "./names.js";
import { runRivetColorCycleBlink } from "./runRivetColorCycleBlink.js";
import { paintColorColumnWithLowCode } from "./paintColorColumnWithLowCode.js";
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js";

const SWEEP_COUNTER = 0x6390;
const RIVET_BOARD = 4;
const ROW_STRIDE = 0x20;
const SWEEP_PHASE_BIT = 0x40;
const HIGH_COLOR_CODE = 0xef;

export function dispatchColorCyclePaint(m) {
  const { regs, mem8 } = m;

  const sweepPhase = mem8[SWEEP_COUNTER];
  regs.c = sweepPhase;
  regs.de = ROW_STRIDE;

  if (mem8[BOARD] === RIVET_BOARD) {
    runRivetColorCycleBlink(m);
    return;
  }

  if (sweepPhase === 0) {
    paintColorColumnWithLowCode(m);
    return;
  }
  if (sweepPhase & SWEEP_PHASE_BIT) {
    regs.a = HIGH_COLOR_CODE;
    paintColorColumnAndHoldBlink(m);
    return;
  }
  paintColorColumnWithLowCode(m);
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCyclePaint — every frame, decide how the flashing colour column gets repainted, and
 * let the right painter do it.
 *
 * It reads the animation sweep counter as this frame's phase, sets up the one-row descending stride
 * the painters walk, and hands off to exactly one of three:
 *
 *   - on the 100m rivet board       -> that board's own two-column blink block.
 *   - other boards, phase 0         -> the painter that forces the LOW colour code.
 *   - other boards, phase bit 6 set -> the painter that takes a colour code and holds the blink,
 *                                      given the HIGH code.
 *   - other boards, bit 6 clear     -> the LOW-code painter again.
 *
 * So bit 6 of the sweep counter is the colour toggle: as the counter advances the column flashes
 * between the high code over the counter's upper half and the low code over its lower half. The
 * counter itself flows on into every painter as the blink phase, alongside the row stride.
 *
 * This routine writes no memory of its own; the painters do all the visible colour and sprite
 * writes.
 *
 * LIVE-OUT: memory-only, and all of it written by the painter this routine chose.
 */
import { BOARD } from "./names.js";
import { runRivetColorCycleBlink } from "./runRivetColorCycleBlink.js";
import { paintColorColumnWithLowCode } from "./paintColorColumnWithLowCode.js";
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js";

const SWEEP_COUNTER = 0x6390; // the per-frame colour-cycle sweep counter
const RIVET_BOARD = 4; //       board 4 is the 100m rivet board
const ROW_STRIDE = 0x20; //     one tilemap row — the descending stride the painters walk
const SWEEP_PHASE_BIT = 0x40; // bit 6 of the sweep counter — the low/high colour-code toggle
const HIGH_COLOR_CODE = 0xef; // the colour code the sweep's upper half paints in

export function dispatchColorCyclePaint(m) {
  const { regs, mem } = m;

  // The sweep counter is this frame's animation phase; it flows on into whichever painter runs, as
  // the blink phase, together with the row stride they all walk.
  const sweepPhase = mem.read8(SWEEP_COUNTER);
  regs.c = sweepPhase;
  regs.de = ROW_STRIDE;

  // 100m rivet board: its own two-column blink block.
  if (mem.read8(BOARD) === RIVET_BOARD) {
    runRivetColorCycleBlink(m);
    return;
  }

  // Other boards: choose the colour code by the sweep phase.
  if (sweepPhase === 0) {
    paintColorColumnWithLowCode(m); // the painter forces the low code itself
    return;
  }
  if (sweepPhase & SWEEP_PHASE_BIT) {
    regs.a = HIGH_COLOR_CODE; // the sweep's upper half paints in the high code
    paintColorColumnAndHoldBlink(m);
    return;
  }
  paintColorColumnWithLowCode(m); // the sweep's lower half, back to the low code
}

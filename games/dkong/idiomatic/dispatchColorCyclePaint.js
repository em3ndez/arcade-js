// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCyclePaint — the per-frame colour-cycle repaint router: read the sweep
 * counter, then route the colour-column repaint by board and sweep phase.  ROM 0x0486.
 *
 * Every frame the loc_197a colour cascade funnels into here (reached seven ways — from the
 * FRAME!=0 idle branch and the other cascade arms). It reads the animation sweep counter
 * (0x6390) as the phase, sets up the one-row descending-fill stride the paint arms walk, and
 * then hands off to exactly one paint arm — each of which is already idiomatic, so the whole
 * tree is direct calls with no register-ABI marshalling:
 *
 *   - BOARD == 4 (100m rivets)            -> runRivetColorCycleBlink : the rivet board's
 *                                            dedicated two-column blink block.
 *   - other boards, phase == 0            -> paintColorColumnWithLowCode : forces the LOW
 *                                            colour code 0x10.
 *   - other boards, phase bit 6 set       -> paintColorColumnAndHoldBlink with the HIGH code
 *                                            0xEF (phase 0x40..0x7F — the sweep's high half).
 *   - other boards, phase bit 6 clear     -> paintColorColumnWithLowCode : the LOW code again.
 *
 * So the sweep counter's bit 6 is the colour toggle: the column flashes 0xEF (phase 0x40..0x7F)
 * against 0x10 (phase 0x00..0x3F) as the counter advances, and the counter itself flows on into
 * every arm (as the blink phase) alongside the row stride. This routine writes no RAM of its
 * own — the arms do the visible colour-RAM and sprite writes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0486.test.js.
 * GATE:     strict/whole-contract over real captured dispatches (~1197 in a 2000-frame attract,
 *           board 1, the sweep counter covering the full 0x00..0x7F range so the phase==0,
 *           bit-6-clear and bit-6-set non-rivet arms are all naturally exercised) + crafted
 *           entries for the BOARD==4 rivet arm (cold in a 25m attract) and each forced phase,
 *           reposed on a real capture. Whole contract each time: RAM − STACK_SCRATCH + pc + SP.
 *           Teeth: an ignore-phase twin (always low code) caught on a bit-6-set entry, and a
 *           no-rivet twin caught on a BOARD==4 entry.
 * LIVE-OUT: memory-only — the routing writes memory through the paint arms; the chain returns up
 *           to a caller (the loc_197a cascade) that reads no register before overwriting it, so
 *           the oracle's residual registers/flags are dead ABI. RESIDUAL REGISTER ABI: the sweep
 *           counter (C) and the stride (DE) are set here and consumed by the still register-based
 *           idiomatic paint arms, and the high arm's colour code (A) likewise — noted for the
 *           honest-signature capstone. SP/PC are the single net return the JS call stack replaces
 *           (the harness supplies one m.ret() to line them up).
 * NAMES:    BOARD (0x6227) from ram.js. The sweep counter 0x6390 stays hex — it is unnamed in
 *           ram.js (shared with the how-high interlude animation stepper). The stride and the
 *           colour codes are immediates.
 */
import { BOARD } from "./ram.js";
import { runRivetColorCycleBlink } from "./runRivetColorCycleBlink.js"; // ROM 0x04be
import { paintColorColumnWithLowCode } from "./paintColorColumnWithLowCode.js"; // ROM 0x04a1
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js"; // ROM 0x04a3

const SWEEP_COUNTER = 0x6390; // per-frame colour-cycle sweep counter (unnamed/shared — kept hex)
const RIVET_BOARD = 4; //       BOARD == 4 is the 100m rivet board
const ROW_STRIDE = 0x20; //     one tilemap row — the descending-fill stride the paint arms walk
const SWEEP_PHASE_BIT = 0x40; // bit 6 of the sweep counter — the low/high colour-code toggle
const HIGH_COLOR_CODE = 0xef; // the high half's colour-attribute code (phase 0x40..0x7F)

export function dispatchColorCyclePaint(m) {
  const { regs, mem } = m;

  // The sweep counter is this frame's animation phase; it flows on into every paint arm (as the
  // blink phase), which also walk one tilemap row apart.
  const sweepPhase = mem.read8(SWEEP_COUNTER);
  regs.c = sweepPhase;
  regs.de = ROW_STRIDE;

  // 100m rivet board: its dedicated two-column blink block.
  if (mem.read8(BOARD) === RIVET_BOARD) {
    runRivetColorCycleBlink(m);
    return;
  }

  // Other boards: choose the colour code by the sweep phase.
  if (sweepPhase === 0) {
    paintColorColumnWithLowCode(m); // low code 0x10 (the arm forces it)
    return;
  }
  if (sweepPhase & SWEEP_PHASE_BIT) {
    regs.a = HIGH_COLOR_CODE; // phase 0x40..0x7F: paint the column in the high code 0xEF
    paintColorColumnAndHoldBlink(m);
    return;
  }
  paintColorColumnWithLowCode(m); // phase 0x01..0x3F: low code 0x10
}

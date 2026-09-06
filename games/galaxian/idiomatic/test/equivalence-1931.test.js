// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1931 — memory-equivalent to the frozen oracle at ROM 0x1931. Coin/credit timer tick: while the reload
 * cell (0x4003) is nonzero it pulses the coin counter and counts that cell down; once it reaches zero it
 * returns if the coarse timer (0x4004) is spent, else ticks the coarse timer down, refills the reload cell
 * to 15, and branches on config mode (0x4000) — mode 3 nothing, mode 1 the two-coins-per-credit path, mode 2
 * the credit step twice, any other mode once (crediting 0x4002). Every live-out is work RAM in the state
 * dump (the timer cells, the coin phase flag, the credit count + its ready flag and enqueued command word),
 * so EQUAL is ramDiff==null with a positive control per path. The mode-2 double-credit uses a ROM call+
 * fall-through (an m.push16 seat), so an SP-seam tooth guards the dissolved dispatch; a stack-adrift mutant
 * is refused. Teeth: no-op, a single-credit twin (misses the mode-2 second step), and a skip-reload twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { tickCoinMeterAndAwardCredits as cand } from "../tickCoinMeterAndAwardCredits.js";
import { loc_1931 as oracle } from "../../translated/loc_1931.js";
import { incrementCreditCount } from "../incrementCreditCount.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const RELOAD = 0x4003; // fine reload cell: nonzero -> pulse + count down; refilled to 15 on a coarse tick
const COARSE = 0x4004; // coarse countdown; zero -> return
const MODE = 0x4000;   // config mode selector
const PHASE = 0x4001;  // coin-phase flag (mode 1)
const CREDIT = 0x4002; // credit count (modes 0/2)

const pulse = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 5;
});
const coarseZero = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 0; mem[COARSE] = 0;
});
const mode3 = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 0; mem[COARSE] = 8; mem[MODE] = 3;
});
const mode1 = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 0; mem[COARSE] = 8; mem[MODE] = 1; mem[PHASE] = 0;
});
const mode2 = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 0; mem[COARSE] = 8; mem[MODE] = 2; mem[CREDIT] = 10;
});
const mode0 = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 0; mem[COARSE] = 8; mem[MODE] = 0; mem[CREDIT] = 10;
});
// pulse path with bit3 of the reload value set, so pulseCoinCounter drives coin_count_0 (0x6003) to 1 --
// an io latch NOT in the RAM dump, so a twin that counts the reload cell down but never pulses escapes ramDiff.
const pulseLatch = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[RELOAD] = 0x08;
});
const coinAfter = (fn, e) => { const m = e.clone(); m.routines = STUBS; fn(m); return m.mem.io.coinCounter[0]; };

test("EQUAL (crafted): loc_1931 == oracle across the pulse/timer/mode paths (RAM)", { skip }, () => {
  for (const [name, e] of [["pulse", pulse()], ["coarseZero", coarseZero()], ["mode3", mode3()],
                           ["mode1", mode1()], ["mode2", mode2()], ["mode0", mode0()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_1931 diverged on the ${name} path`);
  }
  const p = pulse(); p.routines = STUBS; oracle(p);
  assert.equal(p.mem8[RELOAD], 4, "positive control: pulse counted the reload cell down");
  const t = mode3(); t.routines = STUBS; oracle(t);
  assert.equal(t.mem8[COARSE], 7, "positive control: coarse timer not ticked");
  assert.equal(t.mem8[RELOAD], 15, "positive control: reload cell not refilled");
  const m1 = mode1(); m1.routines = STUBS; oracle(m1);
  assert.equal(m1.mem8[PHASE], 1, "positive control: mode 1 did not raise the coin-phase flag");
  const m2 = mode2(); m2.routines = STUBS; oracle(m2);
  assert.equal(m2.mem8[CREDIT], 12, "positive control: mode 2 did not credit twice");
  const m0 = mode0(); m0.routines = STUBS; oracle(m0);
  assert.equal(m0.mem8[CREDIT], 11, "positive control: mode 0 did not credit once");
  // io live-out: the coin-counter latch (0x6003, absent from dumpState) on the pulse path.
  assert.equal(coinAfter(cand, pulseLatch()), coinAfter(oracle, pulseLatch()), "loc_1931 diverged on the coin-counter latch (pulse)");
  assert.equal(coinAfter(oracle, pulseLatch()), 1, "positive control: pulse did not drive coin_count_0");
  console.log("  EQUAL: loc_1931 == oracle (RAM + coin-counter io), pulse + coarse-zero + modes 3/1/2/0");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const singleCredit = (m) => { m.mem8[COARSE]--; m.mem8[RELOAD] = 15; incrementCreditCount(m, CREDIT); };
  const skipReload = (m) => { m.mem8[COARSE]--; };
  // io tooth: a twin that counts the reload cell down like the pulse path but never pulses the coin latch --
  // RAM-identical (ramDiff==null) yet leaves coin_count_0 at 0, so only the io observation catches it.
  const noLatch = (m) => { m.mem8[RELOAD]--; };
  assert.ok(ramDiff(oracle, noOp, mode2()), "the no-op twin escaped (mode 2)");
  assert.ok(ramDiff(oracle, singleCredit, mode2()), "the single-credit twin escaped (mode 2)");
  assert.ok(ramDiff(oracle, skipReload, mode3()), "the skip-reload twin escaped (mode 3)");
  assert.notEqual(coinAfter(noLatch, pulseLatch()), coinAfter(oracle, pulseLatch()), "the no-latch twin escaped (io coin counter)");
  console.log("  TEETH: no-op, single-credit, skip-reload (RAM) + no-latch (io coin counter) all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["mode2", mode2()], ["mode3", mode3()], ["pulse", pulse()]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x1931, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x1931, mode2());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on mode-2 double-credit + mode-3 ret + pulse; adrift refused");
});

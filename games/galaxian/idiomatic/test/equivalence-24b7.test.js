// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_24b7 -- crafted-entry equivalence vs the frozen HUD sub-dispatcher at ROM 0x24b7.
 * Register live-in is A (the selector). Every live-out is a memory write (VRAM digit cells, the LFO
 * reset flag, the delegated marker/message columns) -- no caller reads a register back (its sole
 * caller redraws the credit HUD for side effects), so RAM equivalence is the whole story.
 * We craft each dispatch arm and both states of the dissolved rst-08 caller-skip flag (0x4007 bit0):
 *   coin (sel 0)  -- credit line, flag clear across the tens/units/drain span + flag set -> early ret.
 *   1P (sel 1)    -- score line, skip bit / both-dip message / clamped BCD digit split.
 *   convoy (sel 2)-- 0x40ac sentinel -> ret, else the low/high nibble VRAM split.
 *   default (>=3) -- marker-row redraw from 0x421d, flag clear + flag set -> early ret.
 * Teeth: a no-op twin, an ignore-the-skip-flag twin (proves the guard is load-bearing on the coin and
 * marker arms), and per-cell corruption twins for the convoy nibble and the score units digit.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_24b7 as cand } from "../loc_24b7.js";
import { loc_24b7 as oracle } from "../../translated/loc_24b7.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// work-RAM / VRAM cells the routine reads or writes
const FLAG_4007 = 0x4007, CREDIT_LINE = 0x4220, CREDIT_COUNT = 0x421c, LFO_RESET = 0x41d0;
const SCORE_SKIP = 0x4006, IN1_SHADOW = 0x4011, SCORE_VAL = 0x4002, MARKER_COUNT = 0x421d;
const CONVOY = 0x40ac, OBJ_ACTIVE = 0x4200;
const V_507e = 0x507e, V_5138 = 0x5138, V_5158 = 0x5158, V_529f = 0x529f, V_527f = 0x527f;

// A crafted attract-seed clone with a caller-return word seated, the selector in A, and cells poked.
function entry(sel, mut) {
  return craft((mem8, m) => {
    m.push16(0x9999);
    m.regs.a = sel;
    if (mut) mut(mem8, m);
  });
}
const coin = (credits, flag = 0, line = 1) =>
  entry(0, (mem) => { mem[FLAG_4007] = flag; mem[CREDIT_COUNT] = credits; mem[CREDIT_LINE] = line; });
const score = (val, skipBit = 0, dip = 0) =>
  entry(1, (mem) => { mem[SCORE_SKIP] = skipBit; mem[IN1_SHADOW] = dip; mem[SCORE_VAL] = val; });
const convoy = (v) => entry(2, (mem) => { mem[CONVOY] = v; });
const marker = (n, flag = 0, active = 0) =>
  entry(4, (mem) => { mem[FLAG_4007] = flag; mem[MARKER_COUNT] = n; mem[OBJ_ACTIVE] = active; });

function runOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_24b7 == oracle on every dispatch arm", { skip }, () => {
  // coin arm: no-tens, tens, drain, clamp, wraparound-to-zero credit, and the credit-line flag branch
  for (const c of [0x00, 0x03, 0x08, 0x09, 0x0a, 0x17, 0x2f, 0x30, 0x41, 0xff]) {
    assert.equal(ramDiff(oracle, cand, coin(c, 0, 1)), null, `coin credits 0x${c.toString(16)}`);
    assert.equal(ramDiff(oracle, cand, coin(c, 0, 0)), null, `coin (line flag clear) 0x${c.toString(16)}`);
  }
  assert.equal(ramDiff(oracle, cand, coin(5, 1, 1)), null, "coin flag set -> early ret");

  // 1P score arm: skip bit, both-dip message tail, and the BCD digit split incl. clamp
  assert.equal(ramDiff(oracle, cand, score(0x2a, 1, 0)), null, "score skip bit set -> ret");
  assert.equal(ramDiff(oracle, cand, score(0x2a, 0, 0xc0)), null, "score both dip bits -> message 0x10");
  for (const v of [0x00, 0x05, 0x2a, 0x62, 0x63, 0x99]) {
    assert.equal(ramDiff(oracle, cand, score(v, 0, 0x40)), null, `score 0x${v.toString(16)}`);
  }

  // convoy arm: sentinel and the nibble split (incl. high-nibble-zero -> tile 0x10)
  assert.equal(ramDiff(oracle, cand, convoy(0xff)), null, "convoy sentinel -> ret");
  for (const v of [0x00, 0x05, 0x35, 0x0a, 0xa7, 0xf0]) {
    assert.equal(ramDiff(oracle, cand, convoy(v)), null, `convoy 0x${v.toString(16)}`);
  }

  // default (marker) arm: several counts, the object-active drop, both flag states, sel 3 and 5.
  // (count 0 is out-of-contract for drawMarkerRow -- the shared do/while underflows past VRAM in
  //  BOTH layers -- so the default arm is exercised only over the valid 1..5 marker range.)
  for (const n of [1, 2, 3, 4, 5]) {
    assert.equal(ramDiff(oracle, cand, marker(n, 0, 0)), null, `marker n=${n}`);
  }
  assert.equal(ramDiff(oracle, cand, marker(3, 0, 1)), null, "marker with object-active set");
  assert.equal(ramDiff(oracle, cand, marker(3, 1, 0)), null, "marker flag set -> early ret");
  assert.equal(ramDiff(oracle, cand, entry(3, (mem) => { mem[FLAG_4007] = 0; mem[MARKER_COUNT] = 2; })), null, "sel 3 -> default");
  assert.equal(ramDiff(oracle, cand, entry(5, (mem) => { mem[FLAG_4007] = 0; mem[MARKER_COUNT] = 2; })), null, "sel 5 -> default");

  // Non-vacuous positive controls: the oracle writes the exact cells the EQUAL arms compare.
  const cn = runOracle(coin(5, 0, 1));
  assert.equal(cn.mem8[LFO_RESET], 1, "coin: credit-line flag set -> LFO reset request 1");
  assert.equal(cn.mem8[V_507e], 0x6c, "coin: first units tile stamped at 0x507e");
  const co = runOracle(convoy(0x35));
  assert.equal(co.mem8[V_5138], 0x05, "convoy: low nibble -> 0x5138");
  assert.equal(co.mem8[V_5158], 0x03, "convoy: high nibble (>>4) -> 0x5158");
  const sc = runOracle(score(0x2a, 0, 0x40));
  assert.equal(sc.mem8[V_529f], 0x04, "score: tens digit -> 0x529f");
  assert.equal(sc.mem8[V_527f], 0x02, "score: units digit -> 0x527f");
  console.log("  EQUAL: loc_24b7 == oracle on coin/1P/convoy/marker arms and both skip-flag states");
});

test("TEETH: broken twins are caught", { skip }, () => {
  // No-op twin: every writing arm must diverge (also proves those EQUAL arms are non-vacuous).
  const noOp = () => {};
  assert.ok(ramDiff(oracle, noOp, coin(5, 0, 1)), "no-op escaped the coin arm");
  assert.ok(ramDiff(oracle, noOp, score(0x2a, 0, 0x40)), "no-op escaped the score arm");
  assert.ok(ramDiff(oracle, noOp, convoy(0x35)), "no-op escaped the convoy arm");
  assert.ok(ramDiff(oracle, noOp, marker(3, 0, 0)), "no-op escaped the marker arm");

  // Ignore-the-skip-flag twin: clear 0x4007 bit0, run the body, then restore the cell so ONLY the
  // wrongful writes diverge -- proves the dissolved rst-08 guard is load-bearing on both gated arms.
  const ignoreGuard = (m) => {
    const saved = m.mem8[FLAG_4007];
    m.mem8[FLAG_4007] = saved & 0xfe;
    cand(m);
    m.mem8[FLAG_4007] = saved;
  };
  assert.ok(ramDiff(oracle, ignoreGuard, coin(5, 1, 1)), "coin skip-flag guard not load-bearing");
  assert.ok(ramDiff(oracle, ignoreGuard, marker(3, 1, 0)), "marker skip-flag guard not load-bearing");

  // Per-cell corruption twins: the EQUAL comparison observes each specific output cell.
  const bumpConvoyLow = (m) => { cand(m); if (m.mem8[CONVOY] !== 0xff) m.mem8[V_5138] = (m.mem8[V_5138] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, bumpConvoyLow, convoy(0x35)), "convoy low-nibble cell not observed");
  const bumpScoreUnits = (m) => { cand(m); m.mem8[V_527f] = (m.mem8[V_527f] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, bumpScoreUnits, score(0x2a, 0, 0x40)), "score units cell not observed");

  console.log("  TEETH: no-op, ignore-skip-flag, and per-cell corruption twins all caught");
});

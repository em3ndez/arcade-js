// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0ba9 — memory-equivalent to the frozen oracle at ROM 0x0BA9.
 * GATE: captured-entry. The score-header redraw dispatches this digit-writer constantly in attract, so
 * a corpus of REAL entry states is captured by hooking its address (each carries the caller's real A
 * digit and HL pointer). Live-out is NOT memory-only: loc_0ba0 chains two calls without reloading HL,
 * so a register arm compares HL after RAM. The target cell is painted a sentinel on BOTH sides so the
 * one-cell write is observable. Teeth: no-op and wrong-value make a RAM difference; stale-HL makes
 * only a register difference and must be caught on the HL arm.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0ba9 } from "../loc_0ba9.js";
import { loc_0ba9 as oracle } from "../../translated/loc_0ba9.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x0ba9;
const CAP = 150;
const STRIDE = 37;
const SENTINEL = 0xee;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let states = null;
function corpus() {
  if (states) return states;
  const out = [];
  let seen = 0;
  const real = TRANSLATED.get(TARGET);
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (seen++ % STRIDE === 0 && out.length < CAP) out.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  states = out;
  return states;
}

// null == equivalent. Live-out is memory + HL: paint the target cell a sentinel on both sides so the
// write is observable, run both, compare RAM first then the advanced pointer.
function breach(cand, machine) {
  const a = machine.clone(); a.mem8[a.regs.hl] = SENTINEL; oracle(a);
  const b = machine.clone(); b.mem8[b.regs.hl] = SENTINEL; cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (d) return `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}`;
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  return null;
}

function brokenNoOp() {}
function brokenWrongValue(m) { m.mem8[m.regs.hl] = ((m.regs.a & 0x0f) + 1) & 0x0f; m.regs.hl = (m.regs.hl - 32) & 0xffff; }
function brokenStaleHL(m) { m.mem8[m.regs.hl] = m.regs.a & 0x0f; } // correct RAM, HL not stepped

test("CAPTURED: over real attract dispatches, oracle == rewrite (RAM + HL)", { skip }, () => {
  const c = corpus();
  assert.ok(c.length > 0, "vacuous: no dispatches were captured");
  for (const s of c) assert.equal(breach(loc_0ba9, s), null, `diverged (hl=0x${s.regs.hl.toString(16)} a=0x${s.regs.a.toString(16)})`);
  // non-vacuous: the no-op twin diverging proves the oracle actually writes on the sample.
  assert.ok(breach(brokenNoOp, c[0]), "vacuous: oracle wrote nothing");
  console.log(`  CAPTURED: ${c.length} real dispatches, loc_0ba9 == oracle (RAM + HL)`);
});

test("TEETH: RAM twins are caught", { skip }, () => {
  const c = corpus();
  for (const [name, twin] of [["no-op", brokenNoOp], ["wrong-value", brokenWrongValue]]) {
    assert.ok(c.some((s) => { const b = breach(twin, s); return b && b.startsWith("RAM"); }), `the ${name} twin escaped the RAM diff on every state`);
  }
  console.log("  TEETH/RAM: no-op, wrong-value caught by the RAM diff");
});

test("TEETH: the stale-HL twin is caught ON THE HL ARM", { skip }, () => {
  const c = corpus();
  assert.ok(c.some((s) => { const b = breach(brokenStaleHL, s); return b && b.startsWith("HL"); }), "the stale-HL twin was not caught on the HL check — the arm may be inert");
  console.log("  TEETH/regs: stale-HL caught by the HL arm (RAM was identical)");
});

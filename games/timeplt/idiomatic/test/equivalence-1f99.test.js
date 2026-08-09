// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f99 — memory-equivalent to the frozen oracle at ROM 0x1F99.
 * GATE: crafted-entry. No input tape dispatches this table-as-code address, so real machine states
 * captured at loc_2010 (the routine that owns this table region) are replayed through both sides:
 * identical memory, registers and return when the churn comes back, identical fault when it
 * transfers off the map. Teeth below, with a register control proving the memory reach is real.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_1f99 } from "../loc_1f99.js";
import { loc_1f99 as oracle } from "../../translated/loc_1f99.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const NEIGHBOUR = 0x2010;
const CAP = 200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function captureNeighbours() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the neighbour was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

function run(fn, machine) {
  const c = machine.clone();
  try { return { ok: true, m: c, ret: fn(c) }; }
  catch (e) { return { ok: false, msg: e.message || String(e) }; }
}

// null == equivalent. Both-threw counts as equivalent only when the fault is identical, because a
// transfer off the map is this routine's real exit on many captured states.
function unitDiff(cand, machine) {
  const a = run(oracle, machine), b = run(cand, machine);
  if (a.ok !== b.ok) return `${a.ok ? "candidate" : "oracle"} threw where the other did not`;
  if (!a.ok) return a.msg === b.msg ? null : `different fault: ${a.msg} vs ${b.msg}`;
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (o) => a.m.stateOffsetToAddr(o));
  if (ram) return `ram 0x${(ram.addr ?? 0).toString(16)}: ${ram.a} vs ${ram.b}`;
  for (const k of REG_FIELDS) if (a.m.regs[k] !== b.m.regs[k]) return `reg ${k}`;
  if (a.ret !== b.ret) return `return ${a.ret} vs ${b.ret}`;
  return null;
}

// True only when both sides return AND their memory parts company -- the memory-reach probe.
function memParted(cand, machine) {
  const a = run(oracle, machine), b = run(cand, machine);
  return a.ok && b.ok && firstStateDiff(a.m.dumpState(), b.m.dumpState()) !== null;
}

function split() {
  let clean = 0, threw = 0;
  for (const e of captureNeighbours()) run(oracle, e).ok ? clean++ : threw++;
  return { clean, threw };
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
function brokenNoOp() {}
function brokenExtraReg(m) { const r = loc_1f99(m); m.regs.d = (m.regs.d + 1) & 0xff; return r; }

// The faithful body with ONE deliberate defect: omitPush drops the pointer push, offMapTarget
// re-points the sign-positive transfer.
function brokenBody({ omitPush = false, offMapTarget = 0xf1eb } = {}) {
  return (m) => {
    const { regs, mem, mem8 } = m;
    regs.af = m.pop16(); regs.af = m.pop16(); regs.c = regs.l;
    regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16();
    if (!omitPush) m.push16(regs.hl);
    regs.l = regs.dec8(regs.l); regs.l = mem8[regs.hl];
    regs.af = m.pop16(); regs.af = m.pop16(); regs.e = mem8[regs.hl];
    regs.h = regs.c; regs.and(0xf1);
    regs.af = m.pop16(); regs.af = m.pop16(); regs.or(regs.d);
    regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16();
    regs.d = regs.e;
    regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16();
    regs.sub(regs.l);
    regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16(); regs.b = regs.l;
    if (regs.fZ) return m.call(0xf1f1);
    regs.af = m.pop16(); regs.add(0x2c); regs.sub(regs.a);
    regs.af = m.pop16(); regs.af = m.pop16(); regs.add(regs.c);
    regs.l = regs.c; regs.e = 0xf1;
    regs.af = m.pop16(); regs.cp(regs.h); regs.and(regs.c); regs.h = regs.b;
    regs.af = m.pop16(); regs.af = m.pop16();
    if (regs.fP) { m.push16(0x1fcf); m.call(offMapTarget); }
    regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16(); regs.c = regs.b;
    regs.af = m.pop16(); regs.af = m.pop16(); regs.af = m.pop16();
    if (regs.fPO) return m.ret();
    regs.h = regs.e; regs.decMem8(mem, regs.hl);
    regs.af = m.pop16(); regs.af = m.pop16();
    regs.xor(regs.d); regs.or(regs.h); regs.adc(regs.d);
    regs.af = m.pop16(); regs.af = m.pop16(); regs.d = regs.c;
    return m.call(regs.hl);
  };
}
const brokenSkipPush = brokenBody({ omitPush: true });
const brokenWrongOffMap = brokenBody({ offMapTarget: 0xf1ec });

// ── the gate ────────────────────────────────────────────────────────────────────────────
test("NEIGHBOURS: every captured machine, oracle == rewrite", { skip }, () => {
  const entries = captureNeighbours();
  for (const e of entries) assert.equal(unitDiff(loc_1f99, e), null, "a captured machine diverged");
  const { clean, threw } = split();
  assert.ok(clean > 0, "no captured state returns, so memory is never actually compared");
  assert.ok(threw > 0, "no captured state transfers off the map, so that exit is never exercised");
  console.log(`  NEIGHBOURS: ${entries.length} machines identical (${clean} return, ${threw} off-map)`);
});

test("TEETH: broken twins are caught, with real memory and register reach", { skip }, () => {
  const entries = captureNeighbours();
  const { clean, threw } = split();
  const caught = (fn) => entries.filter((e) => unitDiff(fn, e)).length;
  const memHit = (fn) => entries.filter((e) => memParted(fn, e)).length;

  assert.equal(caught(brokenNoOp), entries.length, "the no-op twin escaped a state");
  assert.equal(caught(brokenSkipPush), entries.length, "the dropped-push twin escaped a state");
  assert.equal(memHit(brokenSkipPush), clean, "the dropped push does not show in memory where it must");
  // register control: caught only where the churn returns, and never through memory.
  assert.equal(caught(brokenExtraReg), clean, "the register scribble was not caught on a returning state");
  assert.equal(memHit(brokenExtraReg), 0, "a register scribble surfaced in memory, so the probe is not register-clean");
  assert.equal(caught(brokenWrongOffMap), threw, "the wrong-off-map twin escaped the off-map states");
  console.log(`  TEETH: no-op ${caught(brokenNoOp)}, skip-push ${caught(brokenSkipPush)} (${memHit(brokenSkipPush)} in memory), extra-reg ${caught(brokenExtraReg)}, wrong-off-map ${caught(brokenWrongOffMap)}`);
});

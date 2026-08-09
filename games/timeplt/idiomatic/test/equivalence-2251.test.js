// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2251 — memory-equivalent to the frozen oracle at ROM 0x2251.
 * GATE: crafted-entry. No tape dispatches this tamper-trap table-as-code, so real machine states
 * captured at loc_2010 (which owns this table region) are replayed through both sides. On a real
 * state the churn faults trying to write to ROM; oracle and rewrite must fault at the SAME target
 * address with identical register/memory state. Faults are keyed by name+addr, NOT the message: the
 * message carries a pc the step-free rewrite does not track. Teeth below, with a register control.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_2251 } from "../loc_2251.js";
import { loc_2251 as oracle } from "../../translated/loc_2251.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const NEIGHBOUR = 0x2010;
const CAP = 200;
// Bounds the terminal HALT so a no-fault state unwinds; well above the churn-to-fault cost.
const CYCLE_BUDGET = 4096;
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
  c.maxCycles = c.cycles + CYCLE_BUDGET;
  try { return { c, ret: fn(c), threw: null }; }
  catch (e) { return { c, threw: e }; }
}

// name + the register-derived target address; the message's pc is step bookkeeping the rewrite drops.
const faultKey = (e) => e.name + (e.addr === undefined ? "" : ":0x" + e.addr.toString(16));

// null == equivalent. Both faulting counts as equivalent only when the fault TYPE and target match;
// then, whether it faulted or halted, the memory and registers up to that point must agree too.
function unitDiff(cand, machine) {
  const a = run(oracle, machine), b = run(cand, machine);
  if (!!a.threw !== !!b.threw) return `${a.threw ? "candidate" : "oracle"} faulted where the other did not`;
  if (a.threw && faultKey(a.threw) !== faultKey(b.threw)) return `fault ${faultKey(a.threw)} vs ${faultKey(b.threw)}`;
  const ram = firstStateDiff(a.c.dumpState(), b.c.dumpState(), (o) => a.c.stateOffsetToAddr(o));
  if (ram) return `ram 0x${(ram.addr ?? 0).toString(16)}: ${ram.a} vs ${ram.b}`;
  for (const k of REG_FIELDS) if (a.c.regs[k] !== b.c.regs[k]) return `reg ${k}`;
  if (!a.threw && a.ret !== b.ret) return `return ${a.ret} vs ${b.ret}`;
  return null;
}

const faultAddr = (machine) => run(oracle, machine).threw?.addr ?? null;

// ── broken twins ────────────────────────────────────────────────────────────────────────
// Each exercises one arm of unitDiff. brokenNoOp never faults (fault-presence); brokenBcOff reaches
// the store with a wrong C so the ROM target moves (fault-address); brokenRegScribble stays faithful
// and scribbles a register the fault leaves untouched (register-comparison).
function brokenNoOp() {}

function brokenBcOff(m) {
  const { regs, mem8 } = m;
  regs.a = regs.inc8(regs.a); regs.a = regs.inc8(regs.a);
  regs.a = regs.inc8(regs.a); regs.a = regs.inc8(regs.a);
  regs.a = mem8[regs.bc]; regs.sub(regs.l); regs.h = regs.b;
  regs.b = regs.inc8(regs.b); regs.sbc(mem8[regs.hl]); regs.d = regs.e;
  // BUG: omit `dec c`, so BC's low byte is one higher than the oracle's target.
  regs.adc(regs.e);
  mem8[regs.bc] = regs.a;
}

function brokenRegScribble(m) {
  try { loc_2251(m); } finally { m.regs.iy = (m.regs.iy + 1) & 0xffff; }
}

// ── the gate ────────────────────────────────────────────────────────────────────────────
test("NEIGHBOURS: every captured machine faults identically, oracle == rewrite", { skip }, () => {
  const entries = captureNeighbours();
  for (const e of entries) assert.equal(unitDiff(loc_2251, e), null, "a captured machine diverged");
  const faulted = entries.filter((e) => run(oracle, e).threw).length;
  assert.ok(faulted > 0, "no captured state faults, so the ROM-write fault is never actually compared");
  const targets = new Set(entries.map(faultAddr).filter((a) => a !== null));
  console.log(`  NEIGHBOURS: ${entries.length} machines identical (${faulted} fault; ${targets.size} distinct ROM targets)`);
});

test("TEETH: broken twins are caught on every arm of the diff", { skip }, () => {
  const entries = captureNeighbours();
  const caught = (fn) => entries.filter((e) => unitDiff(fn, e)).length;
  assert.equal(caught(brokenNoOp), entries.length, "the no-op twin (fault-presence) escaped a state");
  assert.equal(caught(brokenBcOff), entries.length, "the moved-target twin (fault-address) escaped a state");
  assert.equal(caught(brokenRegScribble), entries.length, "the register-scribble twin escaped a state");
  console.log(`  TEETH: no-op ${caught(brokenNoOp)}, bc-off ${caught(brokenBcOff)}, reg-scribble ${caught(brokenRegScribble)}`);
});

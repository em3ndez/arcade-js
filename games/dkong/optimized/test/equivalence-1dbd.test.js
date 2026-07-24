// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_1dbd — THE ROUTER on the per-frame update state byte
 * 0x6340. It reads that byte and does `rst 0x28`, an inline-jump-table dispatch
 * through the 4-entry word table at ROM 0x1DC1, indexed by the byte:
 *   0 -> loc_1e49 (idle ret) · 1 -> loc_1dc9 (arm) · 2 -> loc_1e4a (countdown) ·
 *   3 -> 0x0000 (reset vector, an untranslated arm). It writes no work RAM of its
 * own and leaves entirely through the dispatched arm's exit.
 *
 * GATE — STRICT whole-machine (+ unit). sub_1dbd is ATOMIC on EVERY call path: all
 * three callers (loc_197a, loc_127c, sub_1641) run only inside the vblank NMI under
 * the handler's cleared mask, so the NMI cannot re-enter it. MEASURED over 855
 * dispatches (716 plain-boot attract + 139 coin+start driven): io.nmiMask == 0 at
 * 100%, and 0 NMI pushed-PC landings fell in the router region (0x1DBD-0x1DC8 /
 * 0x0028-0x0037). Atomic + total-preserving => the strict byte-exact gate is the
 * right, stronger one, and it self-validates atomicity. See optimized/sub_1dbd.js.
 *
 * REACHABILITY — NATURAL DISPATCH, no tape/poke needed. Over a 1300-frame plain
 * boot sub_1dbd dispatches 716x, covering ALL THREE translated arms naturally:
 * state 0 (idle) 651x, state 1 (arm) 1x, state 2 (countdown) 64x. So the
 * whole-machine gate exercises every reachable arm. The three arms are additionally
 * pinned by a captured-entry test (poke 0x6340 to each state, arm stubbed to isolate
 * the router) asserting the correct dispatch TARGET *and* the collapsed router CYCLE
 * TOTAL of 98 t — the mandatory pin for a collapsed routine. The state-3 reset arm
 * is the untranslated arm: both oracle and optimized throw NotImplemented (after the
 * same 98 t), exempt per doc 06 and asserted as such.
 *
 * Jobs: EQUAL (whole-machine over 716 dispatches, all arms + unit); BRANCH + CYCLE
 * COVERAGE (target + 98 t for states 0/1/2; NotImplemented + 98 t for state 3);
 * TEETH (a dropped cycle charge forks the PRNG -> CAUGHT whole-machine; a wrong
 * dispatch of the idle arm -> CAUGHT unit, naming 0x6341).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_1dbd as translated_1dbd } from "../../translated/state0.js";
import { sub_1dbd as optimized_1dbd } from "../sub_1dbd.js";
import { Machine } from "../../machine.js";
import { NotImplemented } from "../../../../boards/dkong/io.js";
import {
  unitEquivalence,
  wholeMachineEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1dbd;
const STATE = 0x6340; // the router state byte this routine indexes
const COUNTDOWN = 0x6341; // written by the state-2 arm (loc_1e4a); used as a teeth witness
const ROUTER_TOTAL = 98; // the collapsed straight-line dispatcher's exact cycle total
const ARM_TARGETS = { 0: 0x1e49, 1: 0x1dc9, 2: 0x1e4a }; // rst-28 table[state] -> arm
const FRAMES = 1300; // covers the natural 716-dispatch window (all three arms)
const MAX_FRAMES = 800; // first dispatch is ~frame 584

// Plain-boot attract: no input tape, no poke — sub_1dbd dispatches naturally.
function makeMachine(overrides) {
  return new Machine(ROM, overrides ? { overrides } : {});
}

// -- EQUAL --------------------------------------------------------------------

test("EQUAL (whole-machine): idiomatic optimized sub_1dbd matches translated every frame", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, optimized_1dbd]]));

  // The override must actually have run, or EQUAL would be vacuous — and over this
  // window it covers all three reachable arms (state 0/1/2).
  assert.ok(
    r.invocations.get(TARGET) >= 3,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `diverged at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  assert.equal(r.framesCompared, FRAMES);
  console.log(
    `  EQUAL/whole: ${r.framesCompared} frames identical, override fired ` +
      `${r.invocations.get(TARGET)}x (natural attract; arms 0/1/2 all reached)`,
  );
});

test("EQUAL (unit): idiomatic optimized sub_1dbd matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_1dbd, optimized_1dbd, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, HL, DE, SP) + pc identical (first entry, state 0)");
});

// -- BRANCH + CYCLE COVERAGE --------------------------------------------------

// Capture the pristine machine at sub_1dbd's FIRST natural dispatch (state 0),
// via the same construction-time snapshot the core unit gate uses.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1dbd(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`sub_1dbd never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

// Run `fn` on a clone poked into `state`, with the router's m.call STUBBED so the
// arm does not run: this isolates the router's dispatch DECISION (the first m.call
// target) and its collapsed CYCLE TOTAL from the downstream arm's own cost. Returns
// { firstCall, dCyc, machine }.
function runRouter(entry, state, fn) {
  const c = entry.clone();
  c.mem.write8(STATE, state);
  let firstCall = null;
  c.call = (addr) => { if (firstCall === null) firstCall = addr; return undefined; };
  const c0 = c.cycles;
  fn(c);
  return { firstCall, dCyc: c.cycles - c0, machine: c };
}

test("BRANCH + CYCLE COVERAGE: each state dispatches the right arm at exactly 98 t, EQUAL", () => {
  const entry = captureEntry();
  assert.equal(entry.mem.read8(STATE), 0x00, "captured entry must be in router state 0");
  for (const state of [0, 1, 2]) {
    const expected = ARM_TARGETS[state];
    const o = runRouter(entry, state, translated_1dbd);
    const p = runRouter(entry, state, optimized_1dbd);

    // dispatch decision: both route to the table's target for this state
    assert.equal(o.firstCall, expected, `oracle state ${state} -> 0x${(o.firstCall ?? 0).toString(16)}, expected 0x${expected.toString(16)}`);
    assert.equal(p.firstCall, expected, `optimized state ${state} -> 0x${(p.firstCall ?? 0).toString(16)}, expected 0x${expected.toString(16)}`);

    // observable state identical (router writes nothing; arm stubbed both sides)
    const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
    const regs = firstRegDiff(o.machine.regs, p.machine.regs);
    assert.equal(ram, null, ram ? `state ${state}: RAM diff at 0x${(ram.addr ?? 0).toString(16)} (${ram.a} vs ${ram.b})` : "");
    assert.equal(regs, null, regs ? `state ${state}: reg diff at ${regs.reg} (${regs.a} vs ${regs.b})` : "");
    assert.equal(o.machine.pc, p.machine.pc, `state ${state}: pc must match`);

    // collapsed router total must be the oracle's EXACTLY, and it must be 98 t
    assert.equal(p.dCyc, o.dCyc, `state ${state}: router cycle-total mismatch (oracle ${o.dCyc} vs collapsed ${p.dCyc})`);
    assert.equal(o.dCyc, ROUTER_TOTAL, `state ${state}: oracle router total is ${o.dCyc}, expected ${ROUTER_TOTAL}`);
    console.log(`  BRANCH+CYCLE/state ${state}: -> 0x${expected.toString(16)}, EQUAL (RAM+regs+pc), router total ${o.dCyc} == ${p.dCyc} t`);
  }
});

test("BRANCH + CYCLE COVERAGE: state 3 (reset vector 0x0000) is the untranslated arm — both throw NotImplemented after 98 t", () => {
  const entry = captureEntry();
  for (const [label, fn] of [["oracle", translated_1dbd], ["optimized", optimized_1dbd]]) {
    const c = entry.clone();
    c.mem.write8(STATE, 3);
    const c0 = c.cycles;
    let err = null;
    try { fn(c); } catch (e) { err = e; }
    assert.ok(err instanceof NotImplemented, `${label}: state 3 must throw NotImplemented, got ${err && err.constructor.name}`);
    assert.equal(c.cycles - c0, ROUTER_TOTAL, `${label}: router must charge ${ROUTER_TOTAL} t before the untranslated dispatch`);
  }
  console.log(`  BRANCH+CYCLE/state 3: oracle & optimized both throw NotImplemented after ${ROUTER_TOTAL} t (untranslated reset arm)`);
});

// -- TEETH (cycles, whole-machine) --------------------------------------------

/**
 * Cycle-drop twin: behaviourally optimized_1dbd, but the folded 98 t router charge
 * is shaved by 5 t (the first m.step of the routine — uniquely 98 t). A wrong total
 * reseeds SPIN_COUNT/PRNG (0x6019) and shifts NMI stack landings — a PERSISTENT
 * divergence the strict gate catches (it fires 651+ times in-window).
 */
function cyclebroken_1dbd(m) {
  const realStep = m.step.bind(m);
  let dropped = false;
  m.step = (pc, cyc) => {
    if (!dropped && cyc === ROUTER_TOTAL) {
      dropped = true;
      return realStep(pc, cyc - 5); // correct total is 98 t, short by 5
    }
    return realStep(pc, cyc);
  };
  try {
    return optimized_1dbd(m);
  } finally {
    m.step = realStep;
  }
}

test("TEETH (whole-machine): a dropped cycle charge (wrong router total) is CAUGHT and NOT-EQUAL", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, cyclebroken_1dbd]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total — it is worthless");
  assert.equal(typeof r.frame, "number");
  assert.ok(r.addr != null, "a caught divergence must name an address");
  console.log(
    `  TEETH/whole (cycles): caught at frame ${r.frame}, addr 0x${r.addr.toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

// -- TEETH (dispatch, unit) ---------------------------------------------------

/**
 * Wrong-dispatch twin: identical to optimized_1dbd EXCEPT the idle arm (state 0,
 * target 0x1E49) is mis-routed to the state-2 countdown 0x1E4A, which decrements
 * 0x6341 — a write the idle arm (a bare ret) never makes. On the natural first
 * entry (state 0) this surfaces at 0x6341, so the router-decision has teeth.
 */
function broken_dispatch(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(STATE);
  m.push16(0x1dc1);
  regs.add(regs.a);
  regs.hl = m.pop16();
  regs.e = regs.a;
  regs.d = 0x00;
  regs.addHl(regs.de);
  regs.e = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);
  const target = regs.de;
  regs.de = regs.hl;
  regs.hl = target;
  m.step(target, ROUTER_TOTAL);
  if (target === 0x1e49) return m.call(0x1e4a); // BUG: idle mis-dispatched to the countdown
  if (target === 0x1dc9) return m.call(0x1dc9);
  if (target === 0x1e4a) return m.call(0x1e4a);
  throw new Error("unreachable in this test (state 0 entry)");
}

test("TEETH (unit): a wrong dispatch of the idle arm is CAUGHT and names 0x6341", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_1dbd, broken_dispatch, { maxFrames: MAX_FRAMES });
  assert.equal(r.equal, false, "unit gate FAILED to catch a mis-dispatched arm — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    COUNTDOWN,
    `expected first diff at 0x${COUNTDOWN.toString(16)} (the countdown byte the wrong arm touches), got 0x${(r.ram.addr ?? 0).toString(16)}`,
  );
  console.log(`  TEETH/unit (dispatch): caught at 0x${r.ram.addr.toString(16)} (oracle ${r.ram.a} vs broken ${r.ram.b})`);
});

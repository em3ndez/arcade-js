// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_210e — memory-equivalent to the frozen oracle at ROM 0x210e.
 * GATE: crafted-entry. No tape reaches this seeder, so real machines captured at the frame NMI are
 * replayed with the demo selector and the two tamper cells poked to each arm, identically on both
 * sides. The return path is diffed on work RAM; the tamper path tails into the trap, whose first
 * store faults on a preserved pointer, so both sides fault at one address after the same seed writes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_210e } from "../loc_210e.js";
import { loc_210e as oracle } from "../../translated/loc_210e.js";
import { loc_2251 } from "../loc_2251.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u8 } from "../../../../core/int.js";

const NMI = 0x0066;
const SELECTOR = 0xad14;
const DWELL = 0xadf2;
const PTR_LO = 0xadf3;
const PTR_HI = 0xadf4;
const TAMPER_KEY = 0xadfb;
const TAMPER_VERDICT = 0xadfc;
const GENUINE = 0xfd;
const PASS_VERDICTS = [0x10, 0x05];
const FALLBACK_SCRIPT = 0x22fa;
const SELECTORS = [0, 1, 2, 3, 5];
const EXPECT_SCRIPT = { 0: 0x218c, 1: 0x2251, 2: 0x22fa, 3: 0x218c, 5: 0x22fa };
const CAP = 40;
// Bounds the frozen trap's terminal HALT so any non-faulting state still unwinds.
const CYCLE_BUDGET = 4096;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let bases = null;
function captureBases() {
  if (bases) return bases;
  const entries = [];
  const real = TRANSLATED.get(NMI);
  const m = makeMachine(new Map([[NMI, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the frame NMI was never dispatched, no state to craft from");
  bases = entries;
  return bases;
}

function craft(base, selector, key, verdict) {
  const m = base.clone();
  m.mem8[SELECTOR] = selector;
  m.mem8[TAMPER_KEY] = key;
  m.mem8[TAMPER_VERDICT] = verdict;
  return m;
}

function selectionStates() {
  const out = [];
  for (const b of captureBases()) for (const s of SELECTORS) out.push(craft(b, s, GENUINE, PASS_VERDICTS[0]));
  return out;
}

function tamperStates() {
  const out = [];
  for (const b of captureBases()) {
    out.push(craft(b, 0, 0x00, PASS_VERDICTS[0]));
    out.push(craft(b, 0, GENUINE, 0x99));
  }
  return out;
}

function run(fn, machine) {
  const c = machine.clone();
  c.maxCycles = c.cycles + CYCLE_BUDGET;
  try { return { c, ret: fn(c), threw: null }; }
  catch (e) { return { c, threw: e }; }
}

const faultKey = (e) => e.name + (e.addr === undefined ? "" : ":0x" + e.addr.toString(16));

function unitDiff(cand, machine) {
  const a = run(oracle, machine), b = run(cand, machine);
  if (!!a.threw !== !!b.threw) return `${a.threw ? "candidate" : "oracle"} returned where the other faulted`;
  if (a.threw && faultKey(a.threw) !== faultKey(b.threw)) return `fault ${faultKey(a.threw)} vs ${faultKey(b.threw)}`;
  const ram = firstStateDiff(a.c.dumpState(), b.c.dumpState(), (o) => a.c.stateOffsetToAddr(o));
  if (ram) return `ram 0x${(ram.addr ?? 0).toString(16)}: ${ram.a} vs ${ram.b}`;
  if (!a.threw && a.ret !== b.ret) return `return ${a.ret} vs ${b.ret}`;
  return null;
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

const count = (cand, states) => states.filter((s) => unitDiff(cand, s)).length;

// ── broken twins ──────────────────────────────────────────────────────────────────────────
function brokenNoOp() {}

function seatFallbackScript(m) { // BUG: ignores the selector, always the fallback script
  const { regs, mem8 } = m;
  const script = FALLBACK_SCRIPT;
  mem8[DWELL] = u8(mem8[script] + 1);
  mem8[PTR_LO] = script & 0xff;
  mem8[PTR_HI] = script >> 8;
  regs.de = script;
  if (mem8[TAMPER_KEY] !== GENUINE) { regs.hl = TAMPER_KEY; return loc_2251(m); }
  if (mem8[TAMPER_VERDICT] === 0x10 || mem8[TAMPER_VERDICT] === 0x05) return;
  regs.hl = TAMPER_VERDICT;
  return loc_2251(m);
}

function neverTraps(m) { // BUG: a failed readback returns instead of dropping into the trap
  const { mem8 } = m;
  const sel = mem8[SELECTOR];
  const script = sel === 0 || sel === 3 ? 0x218c : sel === 1 ? 0x2251 : FALLBACK_SCRIPT;
  mem8[DWELL] = u8(mem8[script] + 1);
  mem8[PTR_LO] = script & 0xff;
  mem8[PTR_HI] = script >> 8;
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────
test("RETURN PATH: every selector's seed matches, over real machines", { skip }, () => {
  const states = selectionStates();
  assert.equal(count(loc_210e, states), 0, "a return-path crafted state diverged");
  assert.ok(footprint(states[0]) > 0, "the oracle writes nothing here, so the diff is vacuous");
  console.log(`  RETURN PATH: ${states.length} states identical; oracle footprint ${footprint(states[0])} bytes`);
});

test("SEEDS: the seeder writes the counter and the selected pointer", { skip }, () => {
  for (const s of SELECTORS) {
    const m = craft(captureBases()[0], s, GENUINE, PASS_VERDICTS[0]);
    oracle(m);
    const script = EXPECT_SCRIPT[s];
    assert.equal(m.mem8[DWELL], u8(m.rom[script] + 1), `selector ${s} counter`);
    assert.equal(m.mem8[PTR_LO], script & 0xff, `selector ${s} pointer low`);
    assert.equal(m.mem8[PTR_HI], script >> 8, `selector ${s} pointer high`);
  }
  console.log("  SEEDS: counter and pointer correct for every selector");
});

test("TAMPER PATH: a failed readback drops into the trap and faults identically", { skip }, () => {
  const states = tamperStates();
  assert.equal(count(loc_210e, states), 0, "a tamper-path crafted state diverged");
  const faulted = states.filter((s) => run(oracle, s).threw).length;
  assert.equal(faulted, states.length, "a tamper state did not fault, so the trap arm is vacuous");
  console.log(`  TAMPER PATH: ${states.length} states fault identically`);
});

test("TEETH: broken twins are CAUGHT on the arm each corrupts", { skip }, () => {
  const sel = selectionStates(), tam = tamperStates();
  assert.equal(count(brokenNoOp, sel), sel.length, "no-op escaped a return state");
  assert.equal(count(brokenNoOp, tam), tam.length, "no-op escaped a tamper state");
  // The fallback twin is caught wherever the selector should have chosen another script, on the
  // return path AND before the trap's fault, since the seed writes precede it.
  assert.ok(count(seatFallbackScript, sel) > 0, "the fallback-script twin escaped every return state");
  assert.equal(count(seatFallbackScript, tam), tam.length, "the fallback-script twin escaped a tamper state");
  assert.equal(count(neverTraps, sel), 0, "the never-traps twin diverges on a return state it should match");
  assert.equal(count(neverTraps, tam), tam.length, "the never-traps twin escaped a tamper state");
  console.log(`  TEETH: no-op ${sel.length}/${tam.length}, fallback ${count(seatFallbackScript, sel)}/` +
    `${count(seatFallbackScript, tam)}, never-traps ${count(neverTraps, sel)}/${count(neverTraps, tam)}`);
});

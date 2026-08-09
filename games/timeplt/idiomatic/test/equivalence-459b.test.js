// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence for loc_459b, a warp/flash sequence step nothing dispatches — no tape ever branches
 * into it (a dispatcher, 0x176A, does run in attract, but its jump here is never taken). So states
 * come from the drift site 0x2B60, which the body calls with the same object ix / sprite iy, plus
 * crafts that walk the state byte through every
 * branch. The dissolved calls drop their ROM pushes and the exit `ret` is gone, so [push, push+2) is
 * masked and the scratch registers are a ceiling; memory is exact. Teeth bite in memory. HOLE: the
 * misaligned prologue's conditional life-loss is unreachable in real play, forced synthetically.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-459b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_459b } from "../loc_459b.js";
import { loc_459b as oracle } from "../../translated/loc_459b.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x459b;
const DRIFT_SITE = 0x2b60;
const DISPATCHERS = [0x176a, 0x43f0];
const LOSE_LIFE = 0x11ed;
const STACK_FLOOR = 0xae00;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** Scratch left by dropped pushes and the vanished exit ret; memory is the live-out. */
const EXCLUDED = ["a", "f", "c", "d", "e", "h", "l", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "registers" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical";

let drifts = null;
function captureDrifts() {
  if (drifts) return drifts;
  const entries = [];
  const real = TRANSLATED.get(DRIFT_SITE);
  const m = makeMachine(new Map([[DRIFT_SITE, (mm) => {
    if (entries.length < 40) entries.push(mm.clone());
    return real(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the drift run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the drift run ran short");
  assert.ok(entries.length > 0, "vacuous: the drift site was never dispatched, so there is no state");
  drifts = entries;
  return drifts;
}

/** Oracle vs candidate on independent clones: memory outside the exact bytes the frozen side's
 *  pushes wrote, then registers outside the ceiling. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const scratch = new Set();
  const push = a.push16.bind(a);
  a.push16 = (v) => {
    const sp = (a.regs.sp - 2) & 0xffff;
    scratch.add(sp).add((sp + 1) & 0xffff);
    push(v);
  };
  try { oracle(a); } catch (e) { return { addr: null, a: `frozen threw ${String(e).slice(0, 30)}`, b: "-" }; }
  try { candidate(b); } catch (e) { return { addr: null, a: "returned", b: String(e).slice(0, 30) }; }
  for (const off of scratch) if (off < STACK_FLOOR) throw new Error(`scratch ${hex4(off)} reached data`);
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (scratch.has(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
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

/** A real drift-site machine with the object's state byte forced, to walk every branch. */
function craft(stateByte, mut) {
  const c = captureDrifts()[0].clone();
  c.mem8[c.regs.ix & 0xffff] = stateByte;
  if (mut) mut(c);
  return c;
}

/** The misaligned prologue's `adc a,b` carries when a popped word's high byte plus b overflow;
 *  force both so the unreachable life-loss branch runs. */
function craftLoseLife() {
  const c = captureDrifts()[0].clone();
  const sp = c.regs.sp & 0xffff;
  c.regs.b = 0xff;
  c.mem8[(sp + 1) & 0xffff] = 0x00;
  c.mem8[(sp + 2) & 0xffff] = 0xff;
  return c;
}

const CRAFTS = [
  ["below-trigger", () => craft(0x30)],
  ["at-trigger", () => craft(0xb4)],
  ["at-trigger+warp", () => craft(0xb4, (c) => { c.mem8[0xa800] = 0xff; })],
  ["above-trigger", () => craft(0xc4)],
  ["spends-to-idle", () => craft(0x01)],
  ["down-to-0x5a", () => craft(0x5b)],
];

test("UNREACHED: no tape branches into this address, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [DRIFT_SITE]: 0 };
    for (const d of DISPATCHERS) seen[d] = 0;
    const map = new Map();
    for (const addr of Object.keys(seen).map(Number)) {
      const real = TRANSLATED.get(addr);
      map.set(addr, (mm) => { seen[addr]++; return real(mm); });
    }
    const m = makeMachine(map, opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // control: the drift site always fires, and a dispatcher reaches its own jump-here in attract,
    // yet the target stays zero -- the jump is simply never taken.
    assert.ok(seen[DRIFT_SITE] + DISPATCHERS.reduce((s, d) => s + seen[d], 0) > 0,
      `${label} counted nothing anywhere, so the target zero means nothing`);
    assert.equal(seen[TARGET], 0, `${label} now dispatches ${hex4(TARGET)}; capture plain entries instead`);
    console.log(`  UNREACHED: ${label} — target ${seen[TARGET]}, dispatchers ${DISPATCHERS.map((d) => seen[d]).join("/")}, control ${seen[DRIFT_SITE]}`);
  }
});

test("REALISTIC: the drift-site captures, identical outside the ceiling", { skip }, () => {
  const entries = captureDrifts();
  for (const e of entries) assert.equal(unitDiff(loc_459b, e), null, () => show(unitDiff(loc_459b, e)));
  const prints = entries.slice(0, 5).map(footprint);
  assert.ok(prints.every((n) => n > 0), "a capture moved no memory, so a no-op rewrite would pass");
  console.log(`  REALISTIC: ${entries.length} captures identical; footprints ${prints.join(", ")}`);
});

test("BRANCHES: every state-byte path, identical outside the ceiling", { skip }, () => {
  for (const [label, make] of CRAFTS) {
    const d = unitDiff(loc_459b, make());
    assert.equal(d, null, `${label} diverged — ${show(d)}`);
    console.log(`  BRANCH ${label}: footprint ${footprint(make())} bytes`);
  }
});

test("GARBAGE PATH: the forced life-loss branch writes identical memory", { skip }, () => {
  let fired = false;
  const probe = (mm) => {
    const real = mm.routines.get(LOSE_LIFE);
    mm.routines.set(LOSE_LIFE, (x) => { fired = true; return real(x); });
    try { return oracle(mm); } finally { mm.routines.set(LOSE_LIFE, real); }
  };
  const base = craftLoseLife();
  assert.equal(unitDiff(probe, base), null, "the forced life-loss path is vacuous or diverged");
  assert.ok(fired, "the craft did not actually reach the life-loss branch");
  assert.equal(unitDiff(loc_459b, base), null, () => show(unitDiff(loc_459b, base)));
  assert.ok(footprint(base) > 20, "the life-loss path moved little memory; the craft is wrong");
  console.log(`  GARBAGE PATH: life-loss fired, footprint ${footprint(base)} bytes, identical`);
}); // probe restores the shared registry so later arms are unaffected

// ── teeth ─────────────────────────────────────────────────────────────────────────────────
const noOp = () => {};
const skipDrift = (mm) => {
  const real = mm.routines.get(DRIFT_SITE);
  mm.routines.set(DRIFT_SITE, () => {});
  try { return oracle(mm); } finally { mm.routines.set(DRIFT_SITE, real); }
};
const scribbleData = (mm) => { loc_459b(mm); mm.mem8[0xa878] ^= 0xff; };
const scribbleKeptReg = (mm) => { loc_459b(mm); mm.regs.b = (mm.regs.b + 1) & 0xff; };

/** memory-only catch, so a broad register ceiling cannot be what is doing the biting. */
function caughtInMemory(twin, machine) {
  const a = machine.clone(), b = machine.clone();
  const scratch = new Set();
  const push = a.push16.bind(a);
  a.push16 = (v) => { const sp = (a.regs.sp - 2) & 0xffff; scratch.add(sp).add((sp + 1) & 0xffff); push(v); };
  oracle(a);
  try { twin(b); } catch { return true; }
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    if (scratch.has(a.stateOffsetToAddr(i))) continue;
    return true;
  }
  return false;
}

test("TEETH: broken twins are caught", { skip }, () => {
  const states = [captureDrifts()[0], ...CRAFTS.map(([, make]) => make())];
  const bites = (twin) => states.filter((s) => unitDiff(twin, s) !== null).length;
  assert.equal(bites(noOp), states.length, "the no-op twin escaped");
  assert.equal(bites(skipDrift), states.length, "the skip-drift twin escaped");
  assert.equal(bites(scribbleData), states.length, "the data-scribble twin escaped");
  assert.equal(bites(scribbleKeptReg), states.length, "the kept-register control escaped, so the ceiling is vacuous");
  assert.ok(states.every((s) => caughtInMemory(noOp, s)), "the no-op twin is not caught in memory");
  assert.ok(states.every((s) => caughtInMemory(skipDrift, s)), "the skip-drift twin is not caught in memory");
  console.log(`  TEETH: no-op, skip-drift, data-scribble caught on ${states.length}/${states.length}; kept-register control also caught`);
});

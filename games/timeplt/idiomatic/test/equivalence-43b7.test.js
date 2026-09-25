// SPDX-License-Identifier: GPL-3.0-only
/**
 * armMotherShipOrStep against the frozen oracle: one booted machine, cloned and poked to land each of the five
 * exits — wave-hold set, a special already live, an off-phase frame, an occupied bank, and the spawn.
 * Every arm compares the whole work-RAM dump, the stack scratch both sides push masked off; registers,
 * the flag byte and the stack pointer are excluded, and the teeth below prove each gate condition is
 * independently load-bearing.
 *
 * DISSOLVED FORM: the active arm's `m.call(loc_43f0)` is dissolved to a direct `stepMotherShip(m)`
 * (frogger call=0 form). The caller no longer dispatches the stepper through the routine map, so this
 * arm can no longer be stubbed via the registry — it runs the REAL stepper on both sides and compares
 * work RAM with the stack scratch masked (the ROM's call pushes a return frame the direct JS call does
 * not). The stepper's own byte-equivalence is proven by equivalence-43f0.test.js; here we only prove the
 * caller reaches it and returns its result. Its scratch registers (a,f,b,c,d,e,h,l + shadows, sp) are the
 * dissolved-form live-out excluded set for that arm; ix/iy — the stepper's real pointer live-out — are
 * still held.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { armMotherShipOrStep } from "../armMotherShipOrStep.js";
import { loc_43b7 as oracle } from "../../translated/loc_43b7.js";
import { retireEntryPairIntoCooldown } from "../retireEntryPairIntoCooldown.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x43b7;
const STEP_ACTIVE = 0x43f0;

const WAVE_HOLD = 0xacc6;
const SPECIAL_ACTIVE = 0xad0d;
const FRAME_TICK = 0xa980;
const SPAWN_GATE = 0xad02;
const RECORD = 0xa8a0;
const RECORD_STRIDE = 0x10;
const FIRE_BYTE = 0x04;
const HELD = 0xff;
const PHASE_DUE = 0x05;
const PHASE_OFF = 0x00;
const OCCUPIED = 0x99;
const A_LIVE = 0x42;
const FIRE_WRONG = 0x06;

const BOOT_FRAMES = 700;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const EXCLUDED = ["a", "f", "sp"];
/** The active arm delegates to the deep stepper, whose scratch registers legitimately move; ix/iy —
 *  its real pointer live-out — stay held (proven by equivalence-43f0.test.js). */
const STEPPER_EXCLUDED = ["a", "f", "sp", "b", "c", "d", "e", "h", "l",
  "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];
const ARM_NAMES = ["hold", "active", "phase", "occupied", "spawn"];

// ── one booted machine, cloned per arm ────────────────────────────────────────────────────────

let base = null;
function captureBase() {
  if (base) return base;
  const m = makeMachine();
  const frames = m.runFrames(BOOT_FRAMES);
  assert.equal(m.stoppedBy, null, `boot stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, BOOT_FRAMES, "boot ran short");
  base = m.clone();
  return base;
}

/** A booted clone poked so the routine reaches the spawn: hold clear, no live special, on phase, bank empty. */
function spawnReady() {
  const m = captureBase().clone();
  m.mem8[WAVE_HOLD] = 0x00;
  m.mem8[SPECIAL_ACTIVE] = 0x00;
  m.mem8[FRAME_TICK] = PHASE_DUE;
  m.mem8[SPAWN_GATE] = 0x00;
  m.mem8[RECORD] = 0x00;
  m.mem8[RECORD + RECORD_STRIDE] = 0x00;
  return m;
}

function craftArm(name) {
  const m = spawnReady();
  if (name === "hold") m.mem8[WAVE_HOLD] = HELD;
  else if (name === "active") m.mem8[SPECIAL_ACTIVE] = A_LIVE;
  else if (name === "phase") m.mem8[FRAME_TICK] = PHASE_OFF;
  else if (name === "occupied") m.mem8[RECORD] = OCCUPIED;
  return m;
}

/** Whole-dump oracle-vs-candidate on independent clones, the stack scratch both sides push masked off
 * (the active arm's ROM `call` pushes a return frame the dissolved direct call does not; every other arm
 * pushes nothing, so its scratch set is empty and the diff is exact). Identical throws count as equal. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const scratch = new Set();
  const track = (mm) => {
    const push = mm.push16.bind(mm);
    mm.push16 = (v) => { const sp = (mm.regs.sp - 2) & 0xffff; scratch.add(sp).add((sp + 1) & 0xffff); push(v); };
  };
  track(a); track(b);
  let ea, eb;
  try { oracle(a); } catch (e) { ea = e; }
  try { candidate(b); } catch (e) { eb = e; }
  if (ea || eb) {
    if (ea && eb && String(ea) === String(eb)) return null;
    return { addr: null, a: ea ? `threw ${ea.message}` : "returned", b: eb ? `threw ${eb.message}` : "returned" };
  }
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off), (addr) => scratch.has(addr));
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

/** Arms where a twin's RAM parts from the oracle's, over the five crafted entries. */
function caughtOn(candidate) {
  return ARM_NAMES.filter((arm) => unitDiff(candidate, craftArm(arm)) !== null);
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────────

test("EQUAL on every exit arm: work RAM identical to the oracle", { skip }, () => {
  for (const arm of ARM_NAMES) {
    const d = unitDiff(armMotherShipOrStep, craftArm(arm));
    assert.equal(d, null, `arm ${arm} diverged: ${show(d)}`);
  }
  console.log(`  EQUAL: ${ARM_NAMES.length} arms, whole-dump identical`);
});

test("NON-VACUOUS: the two writing arms move memory, the three ret arms move none", { skip }, () => {
  const fp = Object.fromEntries(ARM_NAMES.map((a) => [a, footprint(craftArm(a))]));
  assert.ok(fp.active > 0 && fp.spawn > 0, "a writing arm moved nothing, so its comparison is vacuous");
  for (const arm of ["hold", "phase", "occupied"]) {
    assert.equal(fp[arm], 0, `the ${arm} arm wrote to memory; it is meant to be a bare ret`);
  }
  console.log(`  NON-VACUOUS: footprints ${ARM_NAMES.map((a) => `${a}=${fp[a]}`).join(" ")}`);
});

test("REAL TAIL: the live-special arm runs the true stepper and still agrees", { skip }, () => {
  const m = spawnReady(); // no stub: the real registry dispatches the stepper end to end
  m.mem8[SPECIAL_ACTIVE] = A_LIVE;
  const d = unitDiff(armMotherShipOrStep, m);
  assert.equal(d, null, `the real stepper tail diverged: ${show(d)}`);
  console.log("  REAL TAIL: the true stepper subtree ran on both sides, byte-identical");
});

test("EXCLUDED, deliberately: the caller-owned arms move only a, f and sp; the delegated arm holds ix/iy", { skip }, () => {
  const escaped = [];
  for (const arm of ARM_NAMES) {
    // the active arm delegates to the deep stepper — its scratch registers legitimately move, ix/iy held.
    const excl = arm === "active" ? STEPPER_EXCLUDED : EXCLUDED;
    const a = craftArm(arm);
    const b = a.clone();
    oracle(a);
    armMotherShipOrStep(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k] && !excl.includes(k)) escaped.push(`${arm}:${k}`);
  }
  const control = new Set();
  const a = craftArm("spawn");
  const b = a.clone();
  oracle(a);
  armMotherShipOrStep(b);
  b.regs.h = (b.regs.h + 1) & 0xff; // ★ a spare register the routine never touches
  for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) control.add(k);
  assert.ok(control.has("h"), "the register instrument is blind, so the clean reading proves nothing");
  assert.deepEqual(escaped.sort(), [], "a register moved outside its arm's excluded set");
  console.log(`  EXCLUDED: no register escaped its arm's set (active holds ix/iy); control also moves h`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

function spawn(m) {
  const { regs, mem8 } = m;
  regs.ix = RECORD;
  regs.iy = 0xaa24;
  mem8[SPECIAL_ACTIVE] = HELD;
  mem8[RECORD + FIRE_BYTE] = 0x07;
  return retireEntryPairIntoCooldown(m);
}

/** BUG: does nothing, so no arm spawns or steps. */
function brokenNoOp() {}
/** BUG: spawns without checking the wave-hold flag. */
function brokenIgnoresHold(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[SPECIAL_ACTIVE];
  if (regs.a !== 0) return m.call(STEP_ACTIVE);
  if ((mem8[FRAME_TICK] & 0x07) !== PHASE_DUE) return;
  if ((mem8[SPAWN_GATE] | mem8[RECORD] | mem8[RECORD + RECORD_STRIDE]) !== 0) return;
  return spawn(m);
}
/** BUG: spawns instead of deferring to the stepper when a special is live. */
function brokenIgnoresActive(m) {
  const { mem8 } = m;
  if (mem8[WAVE_HOLD] === HELD) return;
  if ((mem8[FRAME_TICK] & 0x07) !== PHASE_DUE) return;
  if ((mem8[SPAWN_GATE] | mem8[RECORD] | mem8[RECORD + RECORD_STRIDE]) !== 0) return;
  return spawn(m);
}
/** BUG: spawns on every frame, not one in eight. */
function brokenIgnoresPhase(m) {
  const { regs, mem8 } = m;
  if (mem8[WAVE_HOLD] === HELD) return;
  regs.a = mem8[SPECIAL_ACTIVE];
  if (regs.a !== 0) return m.call(STEP_ACTIVE);
  if ((mem8[SPAWN_GATE] | mem8[RECORD] | mem8[RECORD + RECORD_STRIDE]) !== 0) return;
  return spawn(m);
}
/** BUG: spawns over an occupied bank. */
function brokenIgnoresOccupancy(m) {
  const { regs, mem8 } = m;
  if (mem8[WAVE_HOLD] === HELD) return;
  regs.a = mem8[SPECIAL_ACTIVE];
  if (regs.a !== 0) return m.call(STEP_ACTIVE);
  if ((mem8[FRAME_TICK] & 0x07) !== PHASE_DUE) return;
  return spawn(m);
}
/** BUG: arms the fire byte with the wrong value. */
function brokenWrongFire(m) {
  const { regs, mem8 } = m;
  if (mem8[WAVE_HOLD] === HELD) return;
  regs.a = mem8[SPECIAL_ACTIVE];
  if (regs.a !== 0) return m.call(STEP_ACTIVE);
  if ((mem8[FRAME_TICK] & 0x07) !== PHASE_DUE) return;
  regs.ix = RECORD;
  regs.iy = 0xaa24;
  if ((mem8[SPAWN_GATE] | mem8[RECORD] | mem8[RECORD + RECORD_STRIDE]) !== 0) return;
  mem8[SPECIAL_ACTIVE] = HELD;
  mem8[RECORD + FIRE_BYTE] = FIRE_WRONG;
  return retireEntryPairIntoCooldown(m);
}

const TWINS = [
  ["no-op", brokenNoOp, ["active", "spawn"]],
  ["ignores-hold", brokenIgnoresHold, ["hold"]],
  ["ignores-active", brokenIgnoresActive, ["active"]],
  ["ignores-phase", brokenIgnoresPhase, ["phase"]],
  ["ignores-occupancy", brokenIgnoresOccupancy, ["occupied"]],
  ["wrong-fire", brokenWrongFire, ["spawn"]],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly ${expected.join(", ")}`, { skip }, () => {
    const got = caughtOn(twin);
    assert.deepEqual(got, expected, `the ${label} twin's caught arms moved: ${got.join(", ")}`);
    console.log(`  TEETH/${label}: caught on ${got.join(", ") || "nothing"}`);
  });
}

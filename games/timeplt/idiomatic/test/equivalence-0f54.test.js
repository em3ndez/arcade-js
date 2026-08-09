// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAttractTowardGameStart — memory-equivalent to the frozen oracle at ROM 0x0F54.
 * GATE: every real dispatch (all take the play-active bail), plus crafted entries for the four
 *   other branches, plus a handoff-path SP arm. Live-out is work-RAM; a/f/sp are dead (the dropped
 *   ret and its dead accumulator). Teeth: six twins, each caught on an exact scenario count.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { advanceAttractTowardGameStart } from "../advanceAttractTowardGameStart.js";
import { loc_0f54 as oracle } from "../../translated/loc_0f54.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0f54;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const PLAY_ACTIVE = 0xad30;
const PENDING_RESET = 0xa986;
const SUBSTEP = 0xa9ac;
const PHASE = 0xa9ab;
const PHASE_CONST = 0x1736;
const FREE_PLAY = 0xa9c0;
const IN0 = 0xa9ae;
const INPUT_BITS = 0x18;
const RETURN_SLOT = 0x0f6d;

// a and f carry the dead accumulator/flags the oracle leaves; sp is the ret pop the rewrite reshapes;
// h and l are the fill cursor the frozen 0x15b6 walked to 0xaa71, which the dissolved hideAllSprites
// leaves untouched — dead, since the handoff into loc_1690 reads neither.
const EXCLUDED = ["a", "f", "sp", "h", "l"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "reg" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical";

// ── capture, comparison, crafting ─────────────────────────────────────────────────────────

let real = null;
function captureReal() {
  if (real) return real;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  real = entries;
  return real;
}

/** Oracle vs candidate on independent clones: whole RAM dump, then every non-excluded register. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "survived", b: String(e).slice(0, 40) };
  }
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

/** A real (play-active) entry, nudged onto one branch. */
function craft(patch) {
  const m = captureReal()[0].clone();
  for (const [addr, val] of patch) m.mem8[addr] = val;
  return m;
}

/** The four branches the natural tape never takes, each keyed by the cells that select it. */
const PATCH = {
  B: [[PLAY_ACTIVE, 0], [PENDING_RESET, 5]],
  C: [[PLAY_ACTIVE, 0], [PENDING_RESET, 0], [FREE_PLAY, 0]],
  D: [[PLAY_ACTIVE, 0], [PENDING_RESET, 0], [FREE_PLAY, 1], [IN0, 0]],
  E: [[PLAY_ACTIVE, 0], [PENDING_RESET, 0], [FREE_PLAY, 1], [IN0, INPUT_BITS]],
};
function scenarios() {
  return { A: captureReal()[0], B: craft(PATCH.B), C: craft(PATCH.C), D: craft(PATCH.D), E: craft(PATCH.E) };
}

/** Bytes the oracle moves from this entry, so a "branch taken" claim is not vacuous. */
function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────

function handoff(m) {
  m.push16(RETURN_SLOT);
  m.call(0x15b6);
  return m.call(0x1690);
}

/** BUG: does nothing, so the reset and the handoff never happen. */
function brokenNoOp() {}

/** BUG: on the reset branch it reloads the phase but leaves the sub-step cursor untouched. */
function brokenResetSkipsSubstep(m) {
  const M = m.mem8;
  if (M[PLAY_ACTIVE] !== 0) return;
  if (M[PENDING_RESET] !== 0) { M[PHASE] = M[PHASE_CONST]; return; }
  if (M[FREE_PLAY] === 0) return;
  if ((M[IN0] & INPUT_BITS) === 0) return;
  return handoff(m);
}

/** BUG: reloads the phase from a literal instead of the table constant. */
function brokenWrongPhase(m) {
  const M = m.mem8;
  if (M[PLAY_ACTIVE] !== 0) return;
  if (M[PENDING_RESET] !== 0) { M[SUBSTEP] = 0; M[PHASE] = 3; return; }
  if (M[FREE_PLAY] === 0) return;
  if ((M[IN0] & INPUT_BITS) === 0) return;
  return handoff(m);
}

/** BUG: drops the input-bit guard, so it hands off even when neither bit is held. */
function brokenIgnoresInputGuard(m) {
  const M = m.mem8;
  if (M[PLAY_ACTIVE] !== 0) return;
  if (M[PENDING_RESET] !== 0) { M[SUBSTEP] = 0; M[PHASE] = M[PHASE_CONST]; return; }
  if (M[FREE_PLAY] === 0) return;
  return handoff(m);
}

/** BUG: passes every guard but never hands off. */
function brokenSkipsHandoff(m) {
  const M = m.mem8;
  if (M[PLAY_ACTIVE] !== 0) return;
  if (M[PENDING_RESET] !== 0) { M[SUBSTEP] = 0; M[PHASE] = M[PHASE_CONST]; return; }
  if (M[FREE_PLAY] === 0) return;
  if ((M[IN0] & INPUT_BITS) === 0) return;
}

/** BUG: hands off without parking the slot the first callee pops, so the stack unwinds too far. */
function brokenDropsPush(m) {
  const M = m.mem8;
  if (M[PLAY_ACTIVE] !== 0) return;
  if (M[PENDING_RESET] !== 0) { M[SUBSTEP] = 0; M[PHASE] = M[PHASE_CONST]; return; }
  if (M[FREE_PLAY] === 0) return;
  if ((M[IN0] & INPUT_BITS) === 0) return;
  m.call(0x15b6);
  return m.call(0x1690);
}

/** Twin, and the exact number of the five scenarios (A..E) its catch must cover. */
const TWINS = [
  ["no-op", brokenNoOp, ["B", "E"]],
  ["reset-skips-substep", brokenResetSkipsSubstep, ["B"]],
  ["wrong-phase", brokenWrongPhase, ["B"]],
  ["ignores-input-guard", brokenIgnoresInputGuard, ["D"]],
  ["skips-handoff", brokenSkipsHandoff, ["E"]],
  ["drops-push", brokenDropsPush, ["E"]],
];

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("REAL DISPATCHES: every captured entry replays identically", { skip }, () => {
  const entries = captureReal();
  assert.ok(entries.length > 0, "vacuous: the tape never reached the routine");
  let caught = 0;
  for (const e of entries) if (unitDiff(advanceAttractTowardGameStart, e)) caught++;
  assert.equal(caught, 0, `${caught} real dispatches diverged`);
  const anyWork = entries.some((e) => footprint(e) > 0);
  assert.equal(anyWork, false, "a real dispatch did work, so this tape no longer takes only the " +
    "play-active bail and the crafted branches are no longer the only evidence for the rest");
  console.log(`  REAL: ${entries.length} dispatches identical, all the play-active bail`);
});

test("CRAFTED BRANCHES: the four unreached branches replay identically", { skip }, () => {
  const sc = scenarios();
  for (const k of ["B", "C", "D", "E"]) {
    assert.equal(unitDiff(advanceAttractTowardGameStart, sc[k]), null, `branch ${k} diverged: ${show(unitDiff(advanceAttractTowardGameStart, sc[k]))}`);
  }
  // The reset branch and the handoff must actually do work, or their comparisons prove nothing;
  // the two bail branches must do none, or the craft missed the branch it names.
  assert.ok(footprint(sc.B) > 0, "the reset craft writes nothing, so it did not take the reset branch");
  assert.ok(footprint(sc.E) > 0, "the handoff craft writes nothing, so it did not take the handoff");
  assert.equal(footprint(sc.C), 0, "the free-play-zero craft did work, so it did not bail");
  assert.equal(footprint(sc.D), 0, "the input-clear craft did work, so it did not bail");
  console.log(`  CRAFTED: B moves ${footprint(sc.B)}, E moves ${footprint(sc.E)}, C and D bail`);
});

test("HANDOFF SP: the parked slot returns the stack to its seat", { skip }, () => {
  const a = scenarios().E.clone();
  const b = scenarios().E.clone();
  const c = scenarios().E.clone();
  oracle(a);
  advanceAttractTowardGameStart(b);
  brokenDropsPush(c);
  assert.equal(b.regs.sp, a.regs.sp, "the rewrite left the stack pointer off its seat on the handoff");
  // ★ Without the parked slot the still-frozen callee pops the wrong word: measured drift proves
  //   the arm has teeth and is not asserting an equality that holds either way.
  assert.notEqual(c.regs.sp, a.regs.sp, "dropping the parked push left sp on its seat too, so this " +
    "arm would pass a rewrite that omits the push");
  console.log(`  HANDOFF SP: seat ${hex4(a.regs.sp)}; drop-push drifts to ${hex4(c.regs.sp)}`);
});

test("EXCLUDED, deliberately: only a/f/sp/h/l move, and the check still sees a register", { skip }, () => {
  const control = (m) => { advanceAttractTowardGameStart(m); m.regs.c = (m.regs.c + 1) & 0xff; };
  const moved = (cand) => {
    const set = new Set();
    for (const mm of Object.values(scenarios())) {
      const a = mm.clone();
      const b = mm.clone();
      oracle(a);
      cand(b);
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) set.add(k);
    }
    return set;
  };
  const self = moved(advanceAttractTowardGameStart);
  const ctrl = moved(control);
  assert.ok(ctrl.has("c") && !EXCLUDED.includes("c"), "the control twin's scribble on c is invisible, " +
    "so the register check measures nothing and the empty result below proves nothing");
  const unexpected = REG_FIELDS.filter((k) => self.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], `a register diverged outside the excluded set: ${unexpected}`);
  console.log(`  EXCLUDED: rewrite moves ${[...self].join(", ")}; control also moves c`);
});

for (const [label, twin, targets] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const sc = scenarios();
    const caughtOn = Object.keys(sc).filter((k) => unitDiff(twin, sc[k]));
    assert.deepEqual(caughtOn, targets, `the ${label} twin's caught scenarios moved`);
    assert.ok(caughtOn.length > 0, `every scenario PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: caught on ${caughtOn.join(",")}`);
  });
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * armAttractScreenShowingHighScore — memory-equivalent to the frozen oracle at ROM 0x15FE.
 * GATE: unit-capture with a measured 10-byte stack-scratch mask and the printer running; the
 *   natural dispatches (guard-block and one proceed), crafted proceed/full arms the tape never
 *   reaches, a boundary probe, register-ceiling and dissolve checks, and teeth.
 * ★ The dissolved printer at paintHighScoreReadout takes no return the direct call takes, so dead scratch sits
 *   below the seat and a/f/sp are the measured register ceiling; every arm masks ONLY that window.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { armAttractScreenShowingHighScore } from "../armAttractScreenShowingHighScore.js";
import { loc_15fe as oracle } from "../../translated/loc_15fe.js";
import { paintHighScoreReadout } from "../paintHighScoreReadout.js";
import { postCommand } from "../postCommand.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x15fe;
const COUNTER = 0xa988;
const GATE = 0xa9c0;
const SEED_CELL = 0xa701;
const RING_CURSOR = 0xa9b2;
const CELL_SEED = 0x13;
const GATE_OPEN = 7;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 10;

/** The register-divergence ceiling, measured: the printer's dissolved chain leaves the accumulator
 * and its flags elsewhere on the proceed arm, and the oracle takes a return the rewrite does not.
 * A ceiling, not a demand — a rewrite that moved fewer still passes. */
const MOVED = ["a", "f", "sp"];
const SPARE_REG = "d";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  !d ? "identical" : d.addr == null
    ? `${d.reg}: oracle=${d.a} rewrite=${d.b}` : `${hex4(d.addr)}: oracle=${d.a} rewrite=${d.b}`;

// ── captures ────────────────────────────────────────────────────────────────────────────

let real = null;
function captureReal() {
  if (real) return real;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  real = entries;
  return real;
}

const guardBlock = () => captureReal().find((e) => e.mem8[COUNTER] !== 1);
const proceed = () => captureReal().find((e) => e.mem8[COUNTER] === 1);

function craft(base, mut) {
  const c = base.clone();
  mut(c);
  return c;
}

/** The arms the coin-and-play tape never reaches: the fifth-command branch (gate cell non-zero),
 * and a proceed and a full path forced from a guard-block entry by one poked cell. */
function craftedArms() {
  return {
    full: craft(proceed(), (c) => { c.mem8[GATE] = GATE_OPEN; }),
    forcedProceed: craft(guardBlock(), (c) => { c.mem8[COUNTER] = 1; c.mem8[GATE] = 0; }),
    forcedFull: craft(guardBlock(), (c) => { c.mem8[COUNTER] = 1; c.mem8[GATE] = GATE_OPEN; }),
  };
}

const allArms = () => [...captureReal(), ...Object.values(craftedArms())];

// ── diff plumbing ─────────────────────────────────────────────────────────────────────────

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inScratch = (addr, sp) => addr != null && addr >= sp - SCRATCH_BYTES && addr < sp;

/** Oracle vs candidate on clones of `machine`: the whole dump masked to the window, then every
 * register outside the ceiling. A candidate that raises counts as caught; the oracle is not
 * wrapped, so a raise from it is a harness fault and surfaces. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => { const r = push(v); if (c.regs.sp < deepest) deepest = c.regs.sp; return r; };
  oracle(c);
  return seat - deepest;
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

const cursorAfter = (machine) => { const c = machine.clone(); oracle(c); return c.mem8[RING_CURSOR]; };

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A faithful re-run of the routine with one behaviour swapped, transferring the way the module
// transfers -- m.call over push16 for the still-frozen guard, direct calls to postCommand and
// paintHighScoreReadout -- so a twin's divergence shows at a real cell rather than hiding in the masked scratch.
// `null` is the baseline.

function variant(bug) {
  return (m) => {
    const { regs, mem8 } = m;
    if (bug === "noop") return;
    if (bug !== "no-guard") {
      m.push16(0x1601); m.call(0x01c2);
      if (regs.fNZ) return;
    }
    regs.de = 0x0105; postCommand(m);
    regs.de = 0x0106; postCommand(m);
    regs.de = 0x0107; postCommand(m);
    regs.de = 0x0601; postCommand(m);
    const seed = bug === "wrong-seed" ? CELL_SEED + 1 : CELL_SEED;
    mem8[0xa701] = seed; mem8[0xa6e1] = seed;
    if (bug !== "skip-patch") {
      let cursor = 0x163f;
      for (let i = 0; i < 6; i++) {
        const dest = mem8[cursor] | (mem8[cursor + 1] << 8);
        mem8[dest] = mem8[cursor + 2];
        mem8[dest + 1] = bug === "wrong-marker" ? 0x06 : 0x05;
        cursor += 3;
      }
    }
    if (bug !== "skip-printer") paintHighScoreReadout(m);
    mem8[0xa9ab] = bug === "wrong-substate" ? 9 : 1;
    mem8[0xa9ac] = bug === "wrong-substate" ? 9 : 2;
    if (bug !== "ignore-gate" && mem8[0xa9c0] === 0) return;
    regs.de = 0x010d; postCommand(m);
  };
}

const TWINS = [
  "noop", "no-guard", "wrong-seed", "skip-patch", "skip-printer",
  "wrong-marker", "wrong-substate", "ignore-gate",
];

/** The BOUNDARY probe: the ORACLE itself, one byte flipped at `sp + offset`. Built on the oracle so
 * what the arm reports is a property of the MASK alone, not of any rewrite. */
function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatches: identical outside the measured window", { skip }, () => {
  const entries = captureReal();
  assert.ok(entries.length > 0, "vacuous: the tape never reached the routine");
  assert.ok(guardBlock() && proceed(), "the tape did not exercise both a guard-block and a proceed");
  for (const e of entries) {
    const d = unitDiff(armAttractScreenShowingHighScore, e);
    assert.equal(d, null, `a real dispatch diverged: ${show(d)}`);
  }
  console.log(`  EQUAL: ${entries.length} real dispatches, seat ${hex4(entries[0].regs.sp)}`);
});

test("WINDOW: the oracle's deepest push over every arm, measured and pinned", { skip }, () => {
  const depths = Object.fromEntries(
    Object.entries({ ...craftedArms(), block: guardBlock(), proceed: proceed() })
      .map(([k, mc]) => [k, oracleDepth(mc)]));
  const deepest = Math.max(...Object.values(depths));
  console.log(`  WINDOW (measured): deepest ${deepest} bytes — ` +
    Object.entries(depths).map(([k, d]) => `${k} ${d}`).join(", "));
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so every arm masks the " +
    "wrong bytes");
});

test("CRAFTED: the arms the tape never reaches, each forced by one cell", { skip }, () => {
  const arms = craftedArms();
  for (const [label, mc] of Object.entries(arms)) {
    assert.equal(unitDiff(armAttractScreenShowingHighScore, mc), null, `the ${label} arm diverged: ${show(unitDiff(armAttractScreenShowingHighScore, mc))}`);
  }
  // Non-vacuity: the guard blocks by default, a proceed reaches the body, and the gate-open arm
  // does the fifth enqueue the proceed arm does not (its ring cursor advances one command further).
  assert.equal(footprint(craft(guardBlock(), () => {})) > 0, true, "the guard-block arm wrote nothing");
  assert.equal(cursorAfter(guardBlock()), guardBlock().mem8[RING_CURSOR],
    "the guard-block arm moved the ring cursor, so it did not block");
  assert.equal(cursorAfter(arms.forcedProceed) !== arms.forcedProceed.mem8[RING_CURSOR], true,
    "the forced-proceed arm never enqueued, so the guard was not really forced");
  assert.notEqual(cursorAfter(arms.full), cursorAfter(proceed()),
    "the gate-open arm enqueued no more than the proceed arm, so the fifth command never ran");
  console.log(`  CRAFTED: guard blocks, proceed enqueues, gate-open advances the cursor to ` +
    `${hex4(cursorAfter(arms.full))}`);
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const e = proceed();
  const sp = e.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), e);
  const seat = unitDiff(scribbler(0), e);
  const inside = unitDiff(scribbler(-1), e);
  console.log(`  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ` +
    `${hex4(sp - 1)} masked`);
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed, so the mask " +
    "is wider than it declares and a leaking stack pointer would walk out of sight");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed; live stack above the " +
    "window must still fail");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the two above are the " +
    "instrument catching everything rather than the boundary being where it says");
});

function movedOver(candidate) {
  const moved = new Set();
  for (const mc of allArms()) {
    const a = mc.clone();
    const b = mc.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(armAttractScreenShowingHighScore);
  const control = movedOver((m) => { armAttractScreenShowingHighScore(m); m.regs[SPARE_REG] = (m.regs[SPARE_REG] + 1) & 0xff; });
  assert.ok(control.has(SPARE_REG) && !MOVED.includes(SPARE_REG),
    "the measurement misses a twin that scribbles a spare register, so a clean reading proves nothing");
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
  console.log(`  EXCLUDED (measured): moves ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")}; ` +
    `ceiling ${MOVED.join(", ")}; control also moves ${SPARE_REG}`);
});

test("DISSOLVED: the printer and the enqueue are called directly, only the guard stays wired", () => {
  const module = readFileSync(new URL("../armAttractScreenShowingHighScore.js", import.meta.url), "utf8");
  assert.ok(module.includes('from "./paintHighScoreReadout.js"'), "the module does not import paintHighScoreReadout");
  assert.ok(module.includes("paintHighScoreReadout(m)"), "the module does not call paintHighScoreReadout directly");
  assert.ok(module.includes('from "./postCommand.js"'), "the module does not import postCommand");
  assert.ok(module.includes("postCommand(m)"), "the module does not call postCommand directly");
  assert.ok(!module.includes("m.call(ENQUEUE)"),
    "an enqueue still goes through the registry; it should be a direct postCommand");
  assert.ok(!module.includes("m.call(0x"), "a raw-hex m.call survived; the frozen guard goes by name");
  assert.ok(module.includes("m.call(COUNTDOWN)"),
    "the still-frozen guard is no longer reached through the registry");
  // the text check can tell files apart: a sibling that does not call the printer must fail it.
  assert.ok(!readFileSync(new URL("../paintSixDigitFieldSuppressingLeadingZeros.js", import.meta.url), "utf8").includes("paintHighScoreReadout(m)"),
    "a sibling that does not call paintHighScoreReadout passes the same check, so it proves nothing");
  console.log("  DISSOLVED: paintHighScoreReadout and postCommand called directly; the guard stays m.call by name");
});

test("BASELINE: the twin factory with no bug is itself memory-equivalent", { skip }, () => {
  for (const mc of allArms()) {
    assert.equal(unitDiff(variant(null), mc), null,
      `the unbroken baseline diverged, so the teeth below differ from a wrong start: ${show(unitDiff(variant(null), mc))}`);
  }
  console.log(`  BASELINE: unbroken factory identical over ${allArms().length} arms`);
});

for (const bug of TWINS) {
  test(`TEETH: the ${bug} twin is CAUGHT`, { skip }, () => {
    const arms = allArms();
    let caughtAny = 0;
    let caughtInRam = 0;
    for (const mc of arms) {
      const d = unitDiff(variant(bug), mc);
      if (d) { caughtAny++; if (d.addr != null) caughtInRam++; }
    }
    console.log(`  TEETH/${bug}: caught on ${caughtAny}/${arms.length} arms, ${caughtInRam} in memory`);
    assert.ok(caughtAny > 0, `every arm PASSED the ${bug} twin — it has no teeth`);
    assert.ok(caughtInRam > 0, `the ${bug} twin is caught only on a register, so nothing says a ` +
      "cell it should have written is wrong");
  });
}

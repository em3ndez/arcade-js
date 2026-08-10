// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_5866 — memory-equivalent to the frozen oracle at ROM 0x5866.
 * GATE: crafted-boot-entry; the single boot dispatch replayed with the foreground loop (0x0B93)
 * severed to an empty coroutine so both arms stop at the same handover, comparing work RAM outside
 * the stack window, the LS259 and sound latches, and the watchdog kicks. The raw return is that
 * coroutine, driven not compared; fill priors prove the two fills are no accidental match.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5866.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_5866 as candidate } from "../loc_5866.js";
import { loc_5866 as oracle } from "../../translated/loc_5866.js";
import { initColdStartRamThenSeedConfig } from "../initColdStartRamThenSeedConfig.js";
import manifest from "../../manifest.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x5866;
const DRAIN = 0x0b93; // the foreground loop, severed so both arms stop at the same handover
const DERAIL = 0x59d7; // the tampered-image branch: data, never a genuine tail
const [STACK_LO, STACK_HI] = manifest.convergence.stateExclude.stack;

const COLOUR_BASE = 0xa000;
const VIDEO_BASE = 0xa400;
const FILL_BYTES = 0x400;
const COLOUR_FILL = 0x10;
const VIDEO_FILL = 0xf1;
const WATCHDOG = 0xc200;
const SOUND_SEED = 0x5a;
const FILL_PRIORS = [0x00, 0x10, 0xf1, 0xff];
const EXPECTED_DISPATCHES = 1; // boot-time; it runs once under any tape

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? d.k : "identical");
const outsideStack = (addr) => addr === null || addr < STACK_LO || addr >= STACK_HI;
const u8 = (x) => x & 0xff;
const u16 = (x) => x & 0xffff;

// ── the rig: capture the boot entry, sever the foreground, drive the coroutine ────────────

let entry = null;
let dispatches = 0;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatches++;
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    const frames = m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
    assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  }
  return entry;
}

/** A clone with the two fill regions pre-loaded to a prior; everything the routine writes overwrites it. */
function craftFill(prior) {
  const m = entryState().clone();
  for (let i = 0; i < FILL_BYTES; i++) {
    m.mem8[COLOUR_BASE + i] = prior;
    m.mem8[VIDEO_BASE + i] = prior;
  }
  return m;
}

/** A clone whose foreground loop is a recorder returning an empty iterable, reached by the frozen
 *  side's plain call and the rewrite's coroutine handover alike. */
function severed(machine, log) {
  const c = machine.clone();
  c.routines = new Map(c.routines);
  c.routines.set(DRAIN, (mm) => {
    log.push({ a: mm.regs.a, kicks: mm.io.watchdogKicks });
    return { [Symbol.iterator]: function* () {} };
  });
  return c;
}

function drive(fn, m) {
  const r = fn(m);
  if (!r || typeof r.next !== "function") return r;
  for (let i = 0; i <= 64; i++) {
    const step = r.next();
    if (step.done) return step.value;
  }
  throw new Error("still yielding after the budget");
}

/** The frozen side run to the severed handover, returned for inspection. */
function runOracle(machine) {
  const c = severed(machine, []);
  c.io.soundData = SOUND_SEED;
  drive(oracle, c);
  return c;
}

/** The live-out at the severed handover: RAM outside the stack window, the latches, the kicks. */
function diff(cand, machine) {
  const logA = [];
  const logB = [];
  const a = severed(machine, logA);
  const b = severed(machine, logB);
  a.io.soundData = SOUND_SEED;
  b.io.soundData = SOUND_SEED;
  drive(oracle, a);
  try {
    drive(cand, b);
  } catch (e) {
    return { k: "threw:" + String(e).slice(0, 40) };
  }
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram && outsideStack(ram.addr)) return { k: "ram@" + hex4(ram.addr) };
  for (let i = 0; i < a.io.latch.length; i++) {
    if (a.io.latch[i] !== b.io.latch[i]) return { k: "latch" + i };
  }
  if (a.io.soundData !== b.io.soundData) return { k: "sound" };
  if (a.io.watchdogKicks !== b.io.watchdogKicks) return { k: "kicks" };
  if (logA.length !== logB.length) return { k: "handovers" };
  for (const [i, x] of logA.entries()) {
    if (x.a !== logB[i].a || x.kicks !== logB[i].kicks) return { k: "handover" };
  }
  return null;
}

// ── broken twins: the rewrite with one deliberate defect each ────────────────────────────────

/** A faithful body with one field flipped; the handoff reaches the same severed loop as the real one. */
function body({ fillColour = true, colourVal = COLOUR_FILL, fillVideo = true, videoVal = VIDEO_FILL,
  kick1 = true, handoff = true } = {}) {
  return (m) => {
    const { mem8, mem16 } = m;
    if (fillColour) {
      const base = mem16[0x2581];
      for (let i = 0; i < FILL_BYTES; i++) mem8[u16(base + i)] = colourVal;
    }
    if (kick1) mem8[WATCHDOG] = 0;
    if (fillVideo) {
      const base = mem16[0x4a37];
      for (let i = 0; i < FILL_BYTES; i++) mem8[u16(base + i)] = videoVal;
    }
    let addr = 0x0000;
    let total = mem8[0x0000];
    for (;;) {
      total = u8(total + mem8[addr]);
      addr = u16(addr + 1);
      if (((addr >> 8) & 0xff) >= 0x60) break;
      mem8[WATCHDOG] = total;
    }
    if (!handoff) return undefined;
    if (u8(total - 0xaf) !== 0) return m.call(DERAIL);
    return initColdStartRamThenSeedConfig(m);
  };
}

const TWINS = [
  ["no-op", () => {}],
  ["faithful-body", body()],
  ["skip-colour-fill", body({ fillColour: false })],
  ["wrong-colour-fill", body({ colourVal: 0x11 })],
  ["skip-video-fill", body({ fillVideo: false })],
  ["wrong-video-fill", body({ videoVal: 0xf2 })],
  ["skip-first-kick", body({ kick1: false })],
  ["no-handoff", body({ handoff: false })],
];

function states() {
  return [entryState(), ...FILL_PRIORS.map(craftFill)];
}

function caughtOver(cand) {
  let caught = 0;
  for (const s of states()) if (diff(cand, s)) caught++;
  return caught;
}

// ── the gate ─────────────────────────────────────────────────────────────────────────────────

test("DISPATCHED: boot reaches the routine once under both tapes, and both replay", { skip }, () => {
  entryState();
  assert.equal(dispatches, EXPECTED_DISPATCHES, "the dispatch count moved");
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    let seen = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      seen++;
      assert.equal(show(diff(candidate, mm)), "identical", `${label}: a real dispatch diverged`);
      return oracle(mm);
    }]]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    assert.equal(seen, EXPECTED_DISPATCHES, `${label} dispatch count moved`);
    console.log(`  DISPATCHED: ${label} — ${seen} dispatch, replayed identical`);
  }
});

test("EQUAL at the boot dispatch: RAM outside stack, latches, kicks and handover", { skip }, () => {
  assert.equal(show(diff(candidate, entryState())), "identical");
  console.log("  EQUAL: the boot entry replays identically to the severed handover");
});

test("WRITES: the routine really lays both fills and takes the genuine (init) tail", { skip }, () => {
  const before = entryState();
  const after = runOracle(entryState());
  for (let i = 0; i < FILL_BYTES; i++) {
    assert.equal(after.mem8[COLOUR_BASE + i], COLOUR_FILL, `colour byte ${i} is not 0x10`);
  }
  let colourMoved = 0;
  for (let i = 0; i < FILL_BYTES; i++) {
    if (after.mem8[COLOUR_BASE + i] !== before.mem8[COLOUR_BASE + i]) colourMoved++;
  }
  // ★ vacuity: if the fills already held their value at capture, EQUAL would pass a no-op rewrite.
  assert.ok(colourMoved > 0 || FILL_PRIORS.length > 0,
    "colour RAM never moved from the captured state; the fill comparison agrees on a no-change");
  const kicks = after.io.watchdogKicks - before.io.watchdogKicks;
  assert.ok(kicks > FILL_BYTES, `only ${kicks} watchdog kicks; the per-byte sum never ran`);
  console.log(`  WRITES: colour all 0x10 (${colourMoved} bytes moved), ${kicks} watchdog kicks`);
});

test("FILL PRIORS: the fills overwrite any prior, so EQUAL is no accidental match", { skip }, () => {
  for (const prior of FILL_PRIORS) {
    assert.equal(show(diff(candidate, craftFill(prior))), "identical", `prior ${hex4(prior)} diverged`);
    const after = runOracle(craftFill(prior));
    for (let i = 0; i < FILL_BYTES; i++) {
      assert.equal(after.mem8[COLOUR_BASE + i], COLOUR_FILL, `prior ${hex4(prior)}: colour byte ${i} not repainted`);
    }
  }
  console.log(`  FILL PRIORS: ${FILL_PRIORS.length} priors repainted, candidate identical`);
});

test("FAITHFUL BODY: the reconstructed body matches, so the teeth measure real defects", { skip }, () => {
  assert.equal(caughtOver(body()), 0, "the faithful body diverged; a teeth catch below could be spurious");
  console.log("  FAITHFUL BODY: the reconstructed body is identical on every state");
});

for (const [label, twin] of TWINS) {
  if (label === "faithful-body") continue;
  test(`TEETH: the ${label} twin is caught`, { skip }, () => {
    const caught = caughtOver(twin);
    assert.ok(caught > 0, `every state PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: caught on ${caught}/${states().length} states`);
  });
}

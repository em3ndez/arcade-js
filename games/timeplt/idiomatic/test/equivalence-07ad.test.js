// SPDX-License-Identifier: GPL-3.0-only
/**
 * parkTheImageTotalForTheTamperVerdict — the real dispatch (a genuine image, the match arm) plus
 * crafted tamper entries forcing the trap arm, compared with the dead push words below the seat
 * masked out. This entry parks the total in B and tails into the verdict; the dissolved verdict
 * drops its tail return and brackets its own call with a push the rewrite never writes, so [low,
 * seat) is masked (floor watched off the oracle's pushes, proved above the data), the SP drift is
 * asserted per arm, and the scanline is pinned so the trap's cycle-driven fixup read matches a
 * cycle-free rewrite. Registers are not compared: the dissolved callees drop the register dance and
 * the verdict's own return carries this entry, so nothing downstream consumes what it leaves.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-07ad.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { parkTheImageTotalForTheTamperVerdict as candidate } from "../parkTheImageTotalForTheTamperVerdict.js";
import { loc_07ad as oracle } from "../../translated/loc_07ad.js";
import { buildRoutines } from "../../routines.js";
import { SEQUENCE_SUBSTEP } from "../names.js";

const TARGET = 0x07ad;
const CONTINUATION = 0x5303;
/** The fold that jumps here with the total in A; the positive control for the REACH arm. */
const FOLDER = 0x43e8;
const GENUINE = 0x67;
const MATCH_DRIFT = 2; // match arm: the oracle's tail rets, the cycle-free rewrite leaves SP put
const MISMATCH_DRIFT = 0; // trap arm: both reach the trap's unwind, so SP tracks
const WINDOW_BYTES = 4; // the two dead words the verdict brackets its own call with
/** Work RAM tops here; the stack seats above every game variable, so what sits below is scratch. */
const DATA_TOP = 0xadff;
/** The trap falls through eight sprite slots; arming these Y bytes and pinning a carrying scanline
 * makes that fixup write, so the trap comparison has something to hold. */
const SLOT_Y = [0xb411, 0xb413, 0xb415, 0xb437, 0xb439, 0xb43b, 0xb43d, 0xb43f];
const ARMED = 0xf0;
const FIRING_SCANLINE = 0x30;
const VALUES = 256;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────
/**
 * Oracle vs a candidate on clones with the scanline pinned identically. The verdict pushes a return
 * word its dissolved rewrite never writes, so the diff excludes [low, seat) — low watched off the
 * oracle's own pushes. Anything outside that window has escaped.
 */
function compare(cand, machine, scanline) {
  const a = machine.clone();
  const b = machine.clone();
  a.io.readScanline = () => scanline & 0xff;
  b.io.readScanline = () => scanline & 0xff;
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const retOracle = oracle(a);
  let retCand, threw = null;
  try { retCand = cand(b); } catch (e) { threw = String(e).slice(0, 40); }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: ((a.regs.sp - b.regs.sp) << 16) >> 16, retOracle, retCand, threw };
}

/** Cells the oracle moves from a state, ignoring the push scratch — one arm's footprint. */
function footprint(machine, scanline) {
  const a = machine.clone();
  a.io.readScanline = () => scanline & 0xff;
  const seat = a.regs.sp;
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && !(addr < seat && addr >= seat - WINDOW_BYTES)) cells.push(addr);
  }
  return cells;
}

// ── the captured entry, and the crafted tamper entries ────────────────────────────────────
let captured = null;
function entryState() {
  if (captured === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (captured === null) captured = mm.clone();
      return oracle(mm);
    }]]));
    const frames = m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  }
  return captured;
}

const craft = (mutate) => { const m = entryState().clone(); mutate(m); return m; };

/** The captured entry is a genuine image (A is the good total, so the match arm). Each tamper arm
 * forces A off that value — this entry parks A into B — and arms the slots the trap falls through. */
function scenarios() {
  const tamper = (a) => craft((m) => { m.regs.a = a; for (const y of SLOT_Y) m.mem8[y] = ARMED; });
  return [
    { label: "match", m: craft(() => {}), sp: MATCH_DRIFT, scan: 0 },
    { label: "tamper-00", m: tamper(0x00), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
    { label: "tamper-66", m: tamper(0x66), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
    { label: "tamper-68", m: tamper(0x68), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
    { label: "tamper-ff", m: tamper(0xff), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
  ];
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
// The twins reach the verdict by dispatch, so they run the frozen continuation with matching
// scratch; a staging bug shows as the wrong arm (SP drift) or the wrong game state.
const brokenNoCopy = (m) => m.call(CONTINUATION);
const brokenCopiesC = (m) => { m.regs.b = m.regs.c; return m.call(CONTINUATION); };
const brokenCopiesBackwards = (m) => { m.regs.a = m.regs.b; return m.call(CONTINUATION); };
const brokenClearsTotal = (m) => { m.regs.b = m.regs.a; m.regs.a = 0; return m.call(CONTINUATION); };
const brokenNeverHandsOn = (m) => { m.regs.b = m.regs.a; };
// ★ correct staging, one word too many popped: the control that proves the SP check has teeth.
const brokenExtraPop = (m) => { const r = candidate(m); m.pop16(); return r; };
// ★ correct control flow, then scribbles a data cell below the mask: proves the mask hides no data.
const brokenScribblesData = (m) => {
  const r = candidate(m);
  m.mem8[SEQUENCE_SUBSTEP] = (m.mem8[SEQUENCE_SUBSTEP] + 7) & 0xff;
  return r;
};

// The four staging twins flip the genuine image to the trap, so they are caught on the match arm
// where the correct total passes; the trap itself is total-blind, so the tamper arms cannot see a
// wrong total. never-hands-on and extra-pop diverge on every scenario, in the return and the SP.
const TWINS = [
  ["no-copy", brokenNoCopy, 1],
  ["copies-c", brokenCopiesC, 1],
  ["copies-backwards", brokenCopiesBackwards, 1],
  ["clears-total", brokenClearsTotal, 1],
  ["never-hands-on", brokenNeverHandsOn, 5],
  ["extra-pop", brokenExtraPop, 5],
];

function isCaught(twin, sc) {
  const r = compare(twin, sc.m, sc.scan);
  return r.threw !== null || r.escaped !== null || r.spDiff !== sc.sp || r.retOracle !== r.retCand;
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────
test("REACH: the tamper chain really passes through here, with a positive control", { skip }, () => {
  for (const [label, opts] of [["attract", { tape: [] }], ["coin-start", {}]]) {
    const real = buildRoutines();
    const counts = { [TARGET]: 0, [FOLDER]: 0 };
    const overrides = new Map();
    for (const addr of [TARGET, FOLDER]) {
      const body = real.get(addr);
      overrides.set(addr, (mm, ...args) => { counts[addr]++; return body(mm, ...args); });
    }
    const m = makeMachine(overrides, opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} reach run stopped early: ${m.stoppedBy}`);
    assert.ok(counts[FOLDER] > 0, `the ${label} tap counted nothing for the fold, so the instrument is broken`);
    assert.ok(counts[TARGET] > 0, `vacuous: the ${label} tape never reached this entry`);
    console.log(`  REACH/${label}: entered ${counts[TARGET]} times (fold ${counts[FOLDER]})`);
  }
});

test("REAL DISPATCH: the tape reaches this address on the genuine-image match arm", { skip }, () => {
  const e = entryState();
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  assert.equal(e.regs.a, GENUINE, "the captured total is not the genuine value, so this is not the match arm");
  const r = compare(candidate, craft(() => {}), 0);
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  console.log(`  REAL DISPATCH: total ${hex4(e.regs.a)} at SP ${hex4(e.regs.sp)}, match arm identical`);
});

test("ARMS: match and trap are memory-equivalent, and the arms really differ", { skip }, () => {
  const prints = {};
  for (const sc of scenarios()) {
    const r = compare(candidate, sc.m, sc.scan);
    assert.equal(r.threw, null, `${sc.label} threw: ${r.threw}`);
    assert.equal(r.escaped, null, `${sc.label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[sc.label] = footprint(sc.m, sc.scan).map(hex4).join(",");
  }
  // ★ Vacuity guard: the two arms must move DIFFERENT cells, or the poke changed nothing.
  assert.notEqual(prints.match, prints["tamper-00"], "the match and trap arms move the same cells");
  assert.ok(prints["tamper-00"].length > 0, "the trap arm's fixup never fired, so its comparison is vacuous");
  console.log(`  ARMS: 5 scenarios equivalent; match moves ${prints.match.split(",").length}, trap ${prints["tamper-00"].split(",").length} cells`);
});

test("TOTAL: all 256 totals parked and carried, both arms of the verdict", { skip }, () => {
  let trap = 0, clean = 0;
  for (let v = 0; v < VALUES; v++) {
    const scan = v === GENUINE ? 0 : FIRING_SCANLINE;
    const m = craft((mm) => { mm.regs.a = v; for (const y of SLOT_Y) mm.mem8[y] = ARMED; });
    const r = compare(candidate, m, scan);
    assert.equal(r.escaped, null, `total ${hex4(v)} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, v === GENUINE ? MATCH_DRIFT : MISMATCH_DRIFT, `total ${hex4(v)}: SP drift moved`);
    if (v === GENUINE) clean++; else trap++;
  }
  // ★ The sweep drives BOTH ends of the verdict, or it exercises only one side of the comparison.
  assert.ok(trap > 0 && clean > 0, "the total sweep did not drive both the trap and the clean arm");
  console.log(`  TOTAL: ${VALUES} totals identical; ${clean} clean, ${trap} trap`);
});

test("SP and RETURN: the match arm lifts two over the rewrite, the trap arm tracks", { skip }, () => {
  for (const sc of scenarios()) {
    const r = compare(candidate, sc.m, sc.scan);
    assert.equal(r.spDiff, sc.sp, `${sc.label}: SP drift moved`);
    assert.equal(r.retOracle, r.retCand, `${sc.label}: the return value diverged`);
  }
  console.log(`  SP: match +${MATCH_DRIFT}, trap +${MISMATCH_DRIFT}; returns identical`);
});

test("MASK: the window is the dead words above all game data, and a data diff still escapes", { skip }, () => {
  const r = compare(candidate, craft(() => {}), 0);
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  assert.equal(r.seat - r.low, WINDOW_BYTES, "the masked window is not the words the verdict brackets its call with");
  // The mask is safe only if a real data divergence still escapes it: the control must be caught.
  assert.ok(isCaught(brokenScribblesData, scenarios()[0]), "a twin scribbling a data cell is not caught, so the mask is blind");
  console.log(`  MASK: [${hex4(r.low)},${hex4(r.seat)}) excluded; the data-scribble control escapes`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const sc of scenarios()) if (isCaught(twin, sc)) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} scenarios`);
  });
}

// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequenceUnlessImageTampered — memory-equivalent to the frozen oracle at ROM 0x5303.
 * GATE: the real dispatch (a genuine image, so the match arm) plus crafted tamper entries forcing
 *   the mismatch arm; RAM compared with the two dead push words below the seat masked out (the
 *   oracle brackets its call, the rewrite dissolves it), SP drift and return asserted per arm, and
 *   the scanline pinned so the trap's cycle-driven fixup read matches a cycle-free rewrite.
 *   Registers are not compared: the dissolved callees drop the register dance and no caller consumes
 *   one. Run: node --test games/timeplt/idiomatic/test/equivalence-5303.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { advanceSequenceUnlessImageTampered as candidate } from "../advanceSequenceUnlessImageTampered.js";
import { loc_5303 as oracle } from "../../translated/loc_5303.js";
import { loc_0f8d as springTamperTrap } from "../loc_0f8d.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { presentChecksumForTamperTest } from "../presentChecksumForTamperTest.js";
import { SEQUENCE_SUBSTEP } from "../names.js";

const TARGET = 0x5303;
const GENUINE = 0x67;
const MATCH_DRIFT = 2; // match arm: the oracle's tail rets, the cycle-free rewrite leaves SP put
const MISMATCH_DRIFT = 0; // mismatch arm: both reach the trap's unwind, so SP tracks
// Work RAM tops here; the stack seats above every game variable, so the words the oracle leaves
// below its seat are pure scratch. Asserted against the measured window in the MASK arm.
const DATA_TOP = 0xadff;
// The trap falls through eight sprite slots; arming these Y bytes and pinning a carrying scanline
// makes that fixup actually write, so the mismatch comparison has something to hold.
const SLOT_Y = [0xb411, 0xb413, 0xb415, 0xb437, 0xb439, 0xb43b, 0xb43d, 0xb43f];
const ARMED = 0xf0;
const FIRING_SCANLINE = 0x30;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────
/**
 * Oracle vs a candidate on clones with the scanline pinned identically. The oracle pushes a return
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
    if (now[i] !== before[i] && !(addr < seat && addr >= seat - 4)) cells.push(addr);
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

function craft(mutate) {
  const m = entryState().clone();
  mutate(m);
  return m;
}

/** The captured entry is a genuine image (match arm); the mismatch arm is poked in by forcing the
 * carried checksum off its one good value and arming the slots the trap falls through. */
function scenarios() {
  const tamper = (b) => craft((m) => { m.regs.b = b; for (const y of SLOT_Y) m.mem8[y] = ARMED; });
  return [
    { label: "match", m: craft(() => {}), sp: MATCH_DRIFT, scan: 0 },
    { label: "tamper-00", m: tamper(0x00), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
    { label: "tamper-66", m: tamper(0x66), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
    { label: "tamper-68", m: tamper(0x68), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
    { label: "tamper-ff", m: tamper(0xff), sp: MISMATCH_DRIFT, scan: FIRING_SCANLINE },
  ];
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
const brokenNoOp = () => {};
const brokenInverted = (m) => {
  const c = presentChecksumForTamperTest(m);
  if (c === GENUINE) return springTamperTrap(m);
  return advanceSequenceSubStep(m);
};
const brokenWrongConstant = (m) => {
  const c = presentChecksumForTamperTest(m);
  if (c !== GENUINE - 1) return springTamperTrap(m);
  return advanceSequenceSubStep(m);
};
// BUG: branches on the accumulator left at entry, not the byte the checksum call presents.
const brokenStaleAccumulator = (m) => {
  const c = m.regs.a;
  presentChecksumForTamperTest(m);
  if (c !== GENUINE) return springTamperTrap(m);
  return advanceSequenceSubStep(m);
};
// ★ correct RAM, one word too many popped: the control that proves the SP check has teeth.
const brokenExtraPop = (m) => { const r = candidate(m); m.pop16(); return r; };
// ★ correct control flow, then scribbles a data cell below the mask: proves the mask hides no data.
const brokenScribblesData = (m) => {
  const r = candidate(m);
  m.mem8[SEQUENCE_SUBSTEP] = (m.mem8[SEQUENCE_SUBSTEP] + 7) & 0xff;
  return r;
};

const TWINS = [
  ["no-op", brokenNoOp, 5],
  ["inverted", brokenInverted, 5],
  ["wrong-constant", brokenWrongConstant, 2],
  ["stale-accumulator", brokenStaleAccumulator, 4],
  ["extra-pop", brokenExtraPop, 5],
];

function isCaught(twin, sc) {
  const r = compare(twin, sc.m, sc.scan);
  return r.threw !== null || r.escaped !== null || r.spDiff !== sc.sp || r.retOracle !== r.retCand;
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────
test("REAL DISPATCH: the tape reaches this address, on the genuine-image match arm", { skip }, () => {
  const e = entryState();
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  assert.equal(e.regs.b, GENUINE, "the captured checksum is not the genuine value, so this is not the match arm");
  const r = compare(candidate, craft(() => {}), 0);
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  console.log(`  REAL DISPATCH: checksum ${hex4(e.regs.b)} at SP ${hex4(e.regs.sp)}, match arm identical`);
});

test("ARMS: match and mismatch are memory-equivalent, and the arms really differ", { skip }, () => {
  const prints = {};
  for (const sc of scenarios()) {
    const r = compare(candidate, sc.m, sc.scan);
    assert.equal(r.threw, null, `${sc.label} threw: ${r.threw}`);
    assert.equal(r.escaped, null, `${sc.label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[sc.label] = footprint(sc.m, sc.scan).map(hex4).join(",");
  }
  // ★ Vacuity guard: the two arms must move DIFFERENT cells, or the poke changed nothing and the
  // mismatch scenarios would pass a rewrite that ignored the branch entirely.
  assert.notEqual(prints.match, prints["tamper-00"], "the match and mismatch arms move the same cells");
  assert.ok(prints["tamper-00"].length > 0, "the mismatch arm's fixup never fired, so its comparison is vacuous");
  console.log(`  ARMS: 5 scenarios equivalent; match moves ${prints.match.split(",").length}, tamper ${prints["tamper-00"].split(",").length} cells`);
});

test("SP and RETURN: the match arm lifts two over the rewrite, the mismatch arm tracks", { skip }, () => {
  for (const sc of scenarios()) {
    const r = compare(candidate, sc.m, sc.scan);
    assert.equal(r.spDiff, sc.sp, `${sc.label}: SP drift moved`);
    assert.equal(r.retOracle, r.retCand, `${sc.label}: the return value diverged`);
  }
  console.log(`  SP: match +${MATCH_DRIFT}, mismatch +${MISMATCH_DRIFT}; returns identical`);
});

test("MASK: the window is the two dead words above all game data, and a data diff still escapes", { skip }, () => {
  const r = compare(candidate, craft(() => {}), 0);
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  assert.equal(r.seat - r.low, 4, "the masked window is not the two words the oracle brackets its call with");
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

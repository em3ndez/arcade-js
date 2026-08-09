// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1830 — memory-equivalent to the frozen oracle at ROM 0x1830.
 * GATE: unit-capture with a 2-byte dead-stack window, a replayed corpus, a crafted 2x2 branch
 *   grid, an asserted parked-return drift, and teeth. Hole: what each posted code draws is not
 *   checked here, only that the same (1, code) pairs reach the writer and the same counter bumps
 *   land. Run: node --test games/timeplt/idiomatic/test/equivalence-1830.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_1830 } from "../loc_1830.js";
import { loc_1830 as oracle } from "../../translated/loc_1830.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x1830;
const DISPATCHER = 0x1651; // fires every frame the sequence runs, so it mints a real-state corpus
const SCRATCH_BYTES = 2;
// The dissolved tail advanceSequenceSubStep does the counter inc but takes no ROM ret, so the
// oracle's inc-and-ret leaves f/h/l set and pops two bytes the rewrite keeps. All dead: loc_1830 is
// itself a tail and nothing downstream reads them. sp is proved on its own arm, not masked away here.
const EXCLUDED_REGS = ["f", "h", "l", "sp"];
const FLIP_CELL = 0xa9c3;
const BRANCH_CELL = 0xa986;
const CORPUS_CAP = 200;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let entry = null;
const corpus = [];
function capture() {
  if (entry !== null) return;
  const real1830 = TRANSLATED.get(TARGET);
  const real1651 = TRANSLATED.get(DISPATCHER);
  const m = makeMachine(new Map([
    [TARGET, (mm) => { if (entry === null) entry = mm.clone(); return real1830(mm); }],
    [DISPATCHER, (mm) => { if (corpus.length < CORPUS_CAP) corpus.push(mm.clone()); return real1651(mm); }],
  ]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
}

/** The first divergence OUTSIDE the dead stack window, registers included, or null. */
function stray(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { threw: String(e).slice(0, 60) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) {
      const ad = a.stateOffsetToAddr(i);
      if (ad === null || ad < sp - SCRATCH_BYTES || ad >= sp) return { addr: ad, a: da[i], b: db[i] };
    }
  }
  const moved = REG_FIELDS.filter((k) => !EXCLUDED_REGS.includes(k) && a.regs[k] !== b.regs[k]);
  if (moved.length) return { reg: moved[0], a: a.regs[moved[0]], b: b.regs[moved[0]] };
  return null;
}

/** A real state with the two decision cells forced, to reach the branches the tape does not. */
function craft(flip, branch) {
  const s = entry.clone();
  s.mem8[FLIP_CELL] = flip;
  s.mem8[BRANCH_CELL] = branch;
  return s;
}
// branch spans the a986>=2 credit boundary: 1 below, 2 AT it (guards the >=2/>2 off-by-one), 5 above.
const GRID = [[0, 1], [0x80, 1], [0, 2], [0x80, 2], [0, 5], [0x80, 5]];

// ── twins ─────────────────────────────────────────────────────────────────────────────────
const park = (m) => (addr) => { m.push16(0); m.call(addr); };
function twinNoParks(m) {
  const { mem8, regs } = m;
  const call = (addr) => m.call(addr);
  call(0x0b06); call(0x0b39);
  const post = (c) => { regs.de = 0x0100 | c; call(0x0038); };
  post(0x01); post(0x14); post(0x15);
  const flip = mem8[FLIP_CELL] === 0 ? 0x0f : 0x11;
  post(flip); post(flip + 1); post(0x16); post(0x00);
  if (mem8[BRANCH_CELL] >= 2) { post(0x19); call(0x0f1a); return m.call(0x0f1a); }
  post(0x17); return m.call(0x0f1a);
}
function twinDropPost(m) {
  const { mem8, regs } = m; const call = park(m);
  call(0x0b06); call(0x0b39);
  const post = (c) => { regs.de = 0x0100 | c; call(0x0038); };
  post(0x01); post(0x14); // one code short
  const flip = mem8[FLIP_CELL] === 0 ? 0x0f : 0x11;
  post(flip); post(flip + 1); post(0x16); post(0x00);
  if (mem8[BRANCH_CELL] >= 2) { post(0x19); call(0x0f1a); return m.call(0x0f1a); }
  post(0x17); return m.call(0x0f1a);
}
function twinIgnoreFlip(m) {
  const { mem8, regs } = m; const call = park(m);
  call(0x0b06); call(0x0b39);
  const post = (c) => { regs.de = 0x0100 | c; call(0x0038); };
  post(0x01); post(0x14); post(0x15);
  post(0x0f); post(0x10); post(0x16); post(0x00); // flip cell never consulted
  if (mem8[BRANCH_CELL] >= 2) { post(0x19); call(0x0f1a); return m.call(0x0f1a); }
  post(0x17); return m.call(0x0f1a);
}
function twinIgnoreBranch(m) {
  const { mem8, regs } = m; const call = park(m);
  call(0x0b06); call(0x0b39);
  const post = (c) => { regs.de = 0x0100 | c; call(0x0038); };
  post(0x01); post(0x14); post(0x15);
  const flip = mem8[FLIP_CELL] === 0 ? 0x0f : 0x11;
  post(flip); post(flip + 1); post(0x16); post(0x00);
  post(0x17); return m.call(0x0f1a); // always the low arm, one counter bump
}
function twinSingleCounter(m) {
  const { mem8, regs } = m; const call = park(m);
  call(0x0b06); call(0x0b39);
  const post = (c) => { regs.de = 0x0100 | c; call(0x0038); };
  post(0x01); post(0x14); post(0x15);
  const flip = mem8[FLIP_CELL] === 0 ? 0x0f : 0x11;
  post(flip); post(flip + 1); post(0x16); post(0x00);
  if (mem8[BRANCH_CELL] >= 2) { post(0x19); return m.call(0x0f1a); } // bumps once, not twice
  post(0x17); return m.call(0x0f1a);
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────
test("EQUAL: the real dispatch is identical outside the dead stack window", { skip }, () => {
  capture();
  assert.notEqual(entry, null, "vacuous: the tape never reached this arm");
  assert.equal(stray(loc_1830, entry), null, "a divergence escaped the scratch window");
  console.log(`  EQUAL: flip=${entry.mem8[FLIP_CELL]} branch=${entry.mem8[BRANCH_CELL]} sp=${hex4(entry.regs.sp)}`);
});

test("SP: the rewrite drops exactly the tail return the oracle pops", { skip }, () => {
  capture();
  for (const s of [entry, ...corpus]) {
    const a = s.clone(); const b = s.clone();
    oracle(a); loc_1830(b);
    assert.equal((a.regs.sp - b.regs.sp) & 0xffff, 2,
      "the sp drift is not the single dropped tail return advanceSequenceSubStep omits");
  }
  console.log(`  SP: oracle pops the tail return, the rewrite leaves it — sp+2 across ${corpus.length + 1} states`);
});

test("NOT VACUOUS: the masked diff catches a do-nothing twin", { skip }, () => {
  capture();
  assert.notEqual(stray(() => {}, entry), null, "the masked diff passed a no-op, so it is not a gate");
});

test("WINDOW: the widest divergence is exactly the declared 2-byte window", { skip }, () => {
  capture();
  let widest = 0;
  for (const s of [entry, ...corpus, ...GRID.map(([f, b]) => craft(f, b))]) {
    const sp = s.regs.sp; const a = s.clone(); const b = s.clone();
    oracle(a); loc_1830(b);
    const da = a.dumpState(); const db = b.dumpState();
    for (let i = 0; i < da.length; i++) {
      if (da[i] !== db[i]) { const ad = a.stateOffsetToAddr(i); if (ad !== null && ad < sp) widest = Math.max(widest, sp - ad); }
    }
  }
  assert.equal(widest, SCRATCH_BYTES, "the widest scratch divergence moved; the window is the wrong size");
  console.log(`  WINDOW: widest divergence sp-${widest}`);
});

test("PARKED RETURNS are load-bearing: dropping them leaves SP 20 bytes adrift", { skip }, () => {
  capture();
  for (const s of [entry, ...corpus]) {
    const ref = s.clone(); oracle(ref);
    const c = s.clone(); twinNoParks(c);
    assert.equal((c.regs.sp - ref.regs.sp) & 0xffff, 20,
      "the ten frozen callees each pop an unparked slot; if this is ever not 20 the parks may go");
  }
  const ref0 = entry.clone(); oracle(ref0); const c0 = entry.clone(); twinNoParks(c0);
  console.log(`  PARKED: without parks sp=${hex4(c0.regs.sp)} vs oracle ${hex4(ref0.regs.sp)} over ${corpus.length + 1} states`);
});

test("CORPUS: every captured real state replays identically", { skip }, () => {
  capture();
  assert.ok(corpus.length > 0, "vacuous: no states captured");
  let caught = 0;
  for (const s of corpus) if (stray(loc_1830, s)) caught++;
  assert.equal(caught, 0, `the rewrite diverged on ${caught} of ${corpus.length} captured states`);
  console.log(`  CORPUS: ${corpus.length} states identical`);
});

test("CRAFTED: both branch decisions replay identically", { skip }, () => {
  capture();
  for (const [flip, branch] of GRID) {
    assert.equal(stray(loc_1830, craft(flip, branch)), null, `flip=${flip} branch=${branch} diverged`);
  }
  console.log("  CRAFTED: the 2x2 branch grid is identical");
});

test("EXCLUDED: only the dead registers differ, and a scribbling control is still caught", { skip }, () => {
  capture();
  const a = entry.clone(); const b = entry.clone();
  oracle(a); loc_1830(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved.filter((k) => !EXCLUDED_REGS.includes(k)), [], "a register diverged outside the dead set");
  assert.ok(EXCLUDED_REGS.some((k) => moved.includes(k)), "no dead register moved, so the exclusion measures nothing");
  const scribble = (m) => { loc_1830(m); m.regs.a = (m.regs.a + 1) & 0xff; };
  assert.notEqual(stray(scribble, entry), null, "the register check cannot even see a scribbled live register");
  console.log(`  EXCLUDED: ${moved.join(", ")} move (all dead); a scribble on a live register is caught`);
});

// no-parks is a stack-only defect the sp-excluded diff cannot see; the PARKED arm above is its gate.
const STRUCTURAL = [["no-op", () => {}], ["drop-a-post", twinDropPost]];
for (const [label, twin] of STRUCTURAL) {
  test(`TEETH: the ${label} twin is caught across the whole corpus`, { skip }, () => {
    capture();
    assert.notEqual(stray(twin, entry), null, `${label} slipped past the real dispatch`);
    let caught = 0;
    for (const s of corpus) if (stray(twin, s)) caught++;
    assert.equal(caught, corpus.length, `${label} escaped ${corpus.length - caught} captured states`);
    console.log(`  TEETH/${label}: caught on the real dispatch and all ${corpus.length} states`);
  });
}

const BRANCH = [
  ["ignore-flip", twinIgnoreFlip, ([flip]) => flip !== 0],
  ["ignore-branch", twinIgnoreBranch, ([, branch]) => branch >= 2],
  ["single-counter", twinSingleCounter, ([, branch]) => branch >= 2],
];
for (const [label, twin, shouldCatch] of BRANCH) {
  test(`TEETH: the ${label} twin is caught on exactly the crafted combos that trip it`, { skip }, () => {
    capture();
    for (const combo of GRID) {
      const caught = stray(twin, craft(combo[0], combo[1])) !== null;
      assert.equal(caught, shouldCatch(combo), `${label} at flip=${combo[0]} branch=${combo[1]}: caught=${caught}`);
    }
    console.log(`  TEETH/${label}: caught on exactly the combos that trip it`);
  });
}

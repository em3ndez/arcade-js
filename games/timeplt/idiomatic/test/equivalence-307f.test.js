// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_307f — memory-equivalent to the frozen oracle at ROM 0x307F. UNREACHED by both tapes, so the
 * entries are crafted from a real end-of-session machine over painted sprite-entry bands. The three
 * dissolved callees (placeTileAtTableSuppliedOffset, fetchTableWord=0x0010, placeDiagonallyAbuttingTile=0x308a) drop the
 * ROM `ret` chain and the register dance, so RAM is compared outside the measured dead-stack window
 * [low, seat), the +2 SP drift is asserted, the live-out cursors ix/iy and A are checked, and the
 * scrambled register set {f,b,c,d,e,h,l} is excluded with a control twin proving the check sees one.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-307f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_307f } from "../loc_307f.js";
import { loc_307f as oracle } from "../../translated/loc_307f.js";
// A batch sibling dispatched by both sessions -- the positive control for the UNREACHED arm.
import { loc_290e as controlModule } from "../loc_290e.js";
import { loc_290e as controlOracle } from "../../translated/loc_290e.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x307f;
const CONTROL = 0x290e;

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;
const RECORD_SEAT = 0xa800;
const ENTRY_SEAT = 0xac00; // sprite-entry band, clear of the table below it
const TABLE = 0xa900; // word table the last-slot lookup walks, in low work RAM

// Every crafted write lands at or below here; the stack seats far above it, so masking the scratch
// window can never hide a game-data divergence. Both bounds are asserted.
const DATA_TOP = 0xadff;
const SP_DRIFT = 2; // the dropped final ROM ret
const EXCLUDED = ["f", "b", "c", "d", "e", "h", "l", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── backdrop + crafting ───────────────────────────────────────────────────────────────────

let backdropCache = null;
function backdrop() {
  if (backdropCache === null) {
    const m = makeMachine();
    const frames = m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the backdrop session stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, "the backdrop session ran short");
    backdropCache = m.clone();
  }
  return backdropCache;
}

const marker = (addr, salt) => ((addr & 0xff) ^ salt) || salt;

/** A real machine with the entry band painted, a table laid down, and the registers the routine
 * reads seated. B=1 exhausts the counter (last-slot path); anything else takes the straight path.
 * The index the last-slot lookup uses is a&(hl-after-write), forced here to `index` via a=0xff. */
function craft(bval, { index = 0, c = 0x11, entry = ENTRY_SEAT, record = RECORD_SEAT } = {}) {
  const m = backdrop().clone();
  for (let d = -4; d <= ENTRY_STRIDE + 6; d++) {
    m.mem8[entry + d] = marker(entry + d, 0x5a);
    m.mem8[entry + 49 + d] = marker(entry + 49 + d, 0x33);
  }
  for (let d = 0; d < 260; d++) m.mem8[(TABLE + d) & 0xffff] = (d * 7 + 3) & 0xff;
  m.regs.iy = entry;
  m.regs.ix = record;
  m.regs.hl = TABLE;
  m.regs.b = bval;
  m.regs.a = 0xff;
  m.regs.e = index; // written through HL, then anded with A=0xff -> the lookup index
  m.regs.c = c;
  return m;
}

/**
 * Oracle vs candidate on clones. RAM is diffed with the dead-stack window [low, seat) masked, low
 * measured by watching the oracle's own pushes; the SP drift, the two cursors and A are returned.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => {
    push(v);
    if (a.regs.sp < low) low = a.regs.sp;
  };
  const retOracle = oracle(a);
  const retCand = cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, a: da[i], b: db[i] };
  }
  const regMoved = REG_FIELDS.filter((k) => !EXCLUDED.includes(k) && a.regs[k] !== b.regs[k]);
  return {
    escaped,
    low,
    seat,
    spDiff: (((a.regs.sp - b.regs.sp) & 0xffff) << 16) >> 16,
    regMoved,
    ixMatch: a.regs.ix === b.regs.ix,
    iyMatch: a.regs.iy === b.regs.iy,
    retOracle,
    retCand,
  };
}

/** A defect fails compare() if RAM escaped the mask, a live-out register moved, or SP drifted wrong. */
function caught(cand, machine) {
  const r = compare(cand, machine);
  return !!r.escaped || r.regMoved.length > 0 || !r.ixMatch || !r.iyMatch || r.spDiff !== SP_DRIFT;
}

/** The largest cell the oracle moves outside the stack, so the mask cannot be hiding a data write. */
function footprintTop(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  const seat = a.regs.sp;
  oracle(a);
  const now = a.dumpState();
  let top = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] === before[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= seat - 8 && addr <= seat + 4) continue;
    if (addr > top) top = addr;
  }
  return top;
}

// A fixed corpus: the straight path at several counter values, and the last-slot path swept over
// the lookup index across the byte-doubling wrap.
const PATH1_B = [0, 2, 3, 5, 200, 255];
const PATH2_INDEX = [0, 1, 2, 15, 16, 127, 128, 200, 254, 255];
function corpus() {
  const out = [];
  for (const b of PATH1_B) out.push(craft(b));
  for (const index of PATH2_INDEX) out.push(craft(1, { index }));
  return out;
}
const corpusCaught = (cand) => corpus().filter((m) => caught(cand, m)).length;

// ── twins ─────────────────────────────────────────────────────────────────────────────────

function brokenNoOp() {}

/** Control: everything right, then scribbles a live-out register the check must see. */
function brokenMovesLiveReg(m) {
  loc_307f(m);
  m.regs.a = (m.regs.a + 1) & 0xff;
}

/** BUG: never stores the coordinate through the pointer, so the fold and the table byte are off. */
function brokenSkipStore(m) {
  const { regs } = m;
  regs.and(m.mem.read8(regs.hl));
  if (regs.djnz() !== 0) return importStraight(m);
  return importLast(m);
}

/** BUG: takes the straight placer on the last slot too, never looking up the table. */
function brokenAlwaysStraight(m) {
  const { regs, mem } = m;
  mem.write8(regs.hl, regs.e);
  regs.and(mem.read8(regs.hl));
  regs.djnz();
  return importStraight(m);
}

/** BUG: the last slot never takes two bytes off the stack, so A and the SP drift are wrong. */
function brokenSkipPop(m) {
  const { regs, mem } = m;
  mem.write8(regs.hl, regs.e);
  regs.and(mem.read8(regs.hl));
  if (regs.djnz() !== 0) return importStraight(m);
  importFetch(m);
  regs.incMem8(mem, regs.hl);
  return importLast(m);
}

/** BUG: the byte just past the looked-up entry is never bumped. */
function brokenSkipInc(m) {
  const { regs, mem } = m;
  mem.write8(regs.hl, regs.e);
  regs.and(mem.read8(regs.hl));
  if (regs.djnz() !== 0) return importStraight(m);
  importFetch(m);
  regs.af = m.pop16();
  return importLast(m);
}

// Late-bound so the twins can reuse the real dissolved callees without another import block.
let importStraight, importLast, importFetch;

const TWINS = [
  ["no-op", brokenNoOp],
  ["skip-store", brokenSkipStore],
  ["always-straight", brokenAlwaysStraight],
  ["skip-pop", brokenSkipPop],
  ["skip-inc", brokenSkipInc],
];

// Measured catch counts over the corpus (6 straight-path B values + 10 last-slot indices).
const EXPECTED = {
  "no-op": 16,
  "skip-store": 16,
  "always-straight": 10,
  "skip-pop": 10,
  "skip-inc": 10,
};

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("wire the dissolved callees for the twins", { skip }, async () => {
  ({ placeTileAtTableSuppliedOffset: importStraight } = await import("../placeTileAtTableSuppliedOffset.js"));
  ({ placeDiagonallyAbuttingTile: importLast } = await import("../placeDiagonallyAbuttingTile.js"));
  ({ fetchTableWord: importFetch } = await import("../fetchTableWord.js"));
  assert.ok(importStraight && importLast && importFetch, "a dissolved callee did not import");
});

test("UNREACHED: neither tape dispatches it, and the same rig reaches a live control", { skip }, () => {
  for (const [label, opts] of [["coin -> start", {}], ["undriven attract", { tape: [] }]]) {
    let controlErr = null;
    try {
      unitEquivalence((ov) => makeMachine(ov, opts), CONTROL, controlOracle, controlModule, {
        maxFrames: ENTRY_FRAMES,
      });
    } catch (e) {
      controlErr = e;
    }
    assert.ok(!(controlErr && /never entered/.test(controlErr.message)),
      `the ${label} rig cannot reach the live control ${hex4(CONTROL)}, so a zero here says nothing`);
    assert.throws(
      () => unitEquivalence((ov) => makeMachine(ov, opts), TARGET, oracle, loc_307f, {
        maxFrames: ENTRY_FRAMES,
      }),
      /never entered/,
      `${label} unexpectedly reached the routine — this gate should become a real capture`);
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} never entered, control ${hex4(CONTROL)} entered`);
  }
});

test("BOTH PATHS EQUAL: RAM identical outside the mask, cursors and A carried, SP drift +2", { skip }, () => {
  for (const [label, m] of [["straight (B=3)", craft(3)], ["last-slot (B=1)", craft(1, { index: 5 })]]) {
    const r = compare(loc_307f, m);
    assert.equal(r.escaped, null, `${label} escaped the mask at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.deepEqual(r.regMoved, [], `${label} moved a live register: ${r.regMoved}`);
    assert.ok(r.ixMatch && r.iyMatch, `${label} did not carry the cursors`);
    assert.equal(r.spDiff, SP_DRIFT, `${label} SP drift moved`);
    assert.equal(r.retOracle, r.retCand, `${label} return value diverged`);
    // The mask floor sits above every cell either side moves -- proven, not assumed.
    assert.ok(r.low > DATA_TOP, `${label} stack window ${hex4(r.low)} reached into game data`);
    assert.ok(footprintTop(m) <= DATA_TOP, `${label} wrote above ${hex4(DATA_TOP)}`);
    console.log(`  ${label}: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
  }
});

test("NOT VACUOUS: a no-op candidate is caught on both paths", { skip }, () => {
  assert.ok(caught(brokenNoOp, craft(3)), "the straight path passed a no-op, so RAM is not the gate");
  assert.ok(caught(brokenNoOp, craft(1, { index: 5 })), "the last-slot path passed a no-op");
  console.log("  NOT VACUOUS: the empty candidate is caught on both paths");
});

test("EXCLUDED, deliberately: only the scrambled set moves, and the check can still see A", { skip }, () => {
  const moved = new Set();
  for (const m of corpus()) {
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    loc_307f(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  assert.ok(caught(brokenMovesLiveReg, craft(1, { index: 5 })),
    "the control twin scribbles A and is NOT caught, so the live-out check proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], `a register moved outside the excluded set: ${unexpected}`);
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")}`);
});

test("BRANCH SWEEP: every one of the 256 counter values replays identically", { skip }, () => {
  let path2 = 0;
  for (let b = 0; b < 256; b++) {
    const m = craft(b, { index: b });
    assert.ok(!caught(loc_307f, m), `B=${b} diverged: ${show(compare(loc_307f, m).escaped)}`);
    if (compare(loc_307f, m).spDiff === SP_DRIFT && ((b - 1) & 0xff) === 0) path2++;
  }
  assert.equal(path2, 1, "exactly one counter value should exhaust to the last-slot path");
  console.log("  BRANCH SWEEP: 256 counter values identical, one last-slot path among them");
});

test("INDEX SWEEP: the last-slot lookup is identical across all 256 indices, wrap included", { skip }, () => {
  for (let index = 0; index < 256; index++) {
    const m = craft(1, { index });
    assert.ok(!caught(loc_307f, m), `index ${index} diverged: ${show(compare(loc_307f, m).escaped)}`);
  }
  console.log("  INDEX SWEEP: 256 last-slot indices identical");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the corpus`, { skip }, () => {
    const n = corpusCaught(twin);
    console.log(`  TEETH/${label}: caught on ${n} of ${corpus().length}`);
    assert.ok(n > 0, `the corpus missed the ${label} twin everywhere`);
    assert.equal(n, EXPECTED[label], `the ${label} twin's catch count moved`);
  });
}

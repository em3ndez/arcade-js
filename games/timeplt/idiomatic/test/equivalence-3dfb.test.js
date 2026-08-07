// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireSlotIntoSharedCooldown — memory-equivalent to the frozen oracle at ROM 0x3DFB.
 *
 * GATE: unit-capture on a REAL dispatch with ONE exclusion, a two-tape corpus, and a crafted
 *   sweep over both index bases and every value of the shared source byte. 0x40AB is already
 *   decompiled as retireSlot, so the transfer to it is dissolved into a direct call here — this
 *   caller's own unit of work — and the corpus is what proves the dissolve faithful.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM identical outside the scratch window, accumulator too.
 *   1a. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION. The oracle brackets its callee with a push
 *      and a matching pop, so the two bytes just below the entry stack pointer hold the pushed
 *      address afterwards; the rewrite models no stack. The window is exactly [SP-2, SP), it is
 *      MEASURED dirty at the real dispatch rather than assumed, and every arm walks the whole
 *      dump and asserts no divergence escapes it, so it cannot quietly widen.
 *   2. THE REAL CORPUS IS THIN, AND THE TEST SAYS SO RATHER THAN IMPLYING OTHERWISE. Two tapes
 *      dispatch it once and twice in the entry budget, always at the same pair of bases, with the
 *      source byte taking two values between them. Those sets are measured and asserted, so the
 *      crafted sweep below is the load-bearing arm and a change in the real data is a finding.
 *   3. CRAFTED SWEEP — six base pairs against all 256 source values, each a real captured machine
 *      with the bases and the source byte poked. It covers a record whose stocked byte lands on
 *      the far side of the work-RAM boundary, which no real dispatch does.
 *   4. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to exactly {sp}. The accumulator is
 *      NOT excluded: the rewrite is held to the oracle's value for it.
 *   5. TEETH — six twins, each asserted caught at the real dispatch and on an exact count of the
 *      crafted space.
 *
 * HOLE: WHETHER ANY CALLER CONSUMES THE ACCUMULATOR IS NOT ESTABLISHED. The rewrite writes it
 * because the oracle leaves it written and the comparison holds it there; nothing here watches a
 * caller read it, so "live-out" is a faithfulness claim and not an observed dependency.
 *
 * HOLE: the sweep pokes the source byte and the two bases and nothing else, so it says nothing
 * about states where the record or the sprite entry hold values the game never puts there.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3dfb.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { retireSlotIntoSharedCooldown } from "../retireSlotIntoSharedCooldown.js";
import { loc_3dfb as oracle } from "../../translated/loc_3dfb.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x3dfb;
const SHARED_SOURCE = 0xa8f6;
const RECORD_BYTE = 14;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

/** What the two tapes really present. Measured; a move here is a finding. */
const DISPATCHES = { attract: 1, "coin-start": 2 };
const REAL_RECORD = 0xa8e0;
const REAL_ENTRY = 0xaa2c;
const REAL_SOURCES = { attract: [0], "coin-start": [0, 78] };

/**
 * The bases the sweep drives. The first is the pair every real dispatch presents; the next three
 * are further slots of the same record array; the last two put the stocked byte and the entry's
 * second axis across the top of work RAM, which no real dispatch reaches.
 */
const BASE_PAIRS = [
  [0xa8e0, 0xaa2c],
  [0xa810, 0xaa10],
  [0xa8f0, 0xaa2e],
  [0xa890, 0xaa40],
  [0xaff2, 0xafc0],
  [0xaffe, 0xafce],
];

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(retireSlotIntoSharedCooldown);
  return entry;
}

const SCRATCH_BYTES = 2;

/** The window the oracle's bracketing push dirties: the bytes just below the entry stack pointer. */
function inScratch(addr, sp) {
  return addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;
}

/** Every differing byte of two dumps, as {addr, a, b} — the scratch window included. */
function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Masked state dump plus the accumulator: oracle against candidate on clones of one machine. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.a !== b.regs.a) return { addr: null, a: a.regs.a, b: b.regs.a };
  return null;
}

/**
 * Distinctive values planted in the four cells the routine can touch, so that every write it makes
 * is observable. Without them the arm is blind to the retire: at the captured entry all three
 * retired cells already hold zero, which the corpus arm below asserts.
 */
const PLANTED_OCCUPANCY = 0x5a;
const PLANTED_FIRST_AXIS = 0x6b;
const PLANTED_SECOND_AXIS = 0x7c;
const PLANTED_STOCK = 0x2e;
const PLANTED_NEXT = 0x8d;
const SECOND_AXIS_OFFSET = 49;

/** A real captured machine with the two bases, the source byte and the four targets forced. */
function craft(record, slotEntry, source) {
  const m = entryState().clone();
  m.regs.ix = record;
  m.regs.iy = slotEntry;
  m.mem8[SHARED_SOURCE] = source;
  m.mem8[record] = PLANTED_OCCUPANCY;
  m.mem8[slotEntry] = PLANTED_FIRST_AXIS;
  m.mem8[(slotEntry + SECOND_AXIS_OFFSET) & 0xffff] = PLANTED_SECOND_AXIS;
  m.mem8[(record + RECORD_BYTE) & 0xffff] = PLANTED_STOCK;
  m.mem8[(record + RECORD_BYTE + 1) & 0xffff] = PLANTED_NEXT;
  return m;
}

const SWEEP_SIZE = BASE_PAIRS.length * 256;

function sweepCaught(candidate) {
  let caught = 0;
  for (const [record, slotEntry] of BASE_PAIRS) {
    for (let source = 0; source < 256; source++) {
      if (unitDiff(candidate, craft(record, slotEntry, source))) caught++;
    }
  }
  return caught;
}

/** Replay one whole session, comparing at every dispatch and recording what it presented. */
function replaySession(opts, candidate) {
  const base = buildRoutines();
  const original = base.get(TARGET);
  let dispatches = 0;
  let caught = 0;
  const records = new Set();
  const entries = new Set();
  const sources = new Set();
  const overrides = new Map([[TARGET, (mm) => {
    dispatches++;
    records.add(mm.regs.ix);
    entries.add(mm.regs.iy);
    sources.add(mm.mem8[SHARED_SOURCE]);
    if (unitDiff(candidate, mm)) caught++;
    return original(mm);
  }]]);
  const m = makeMachine(overrides, opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "session ran short");
  return { dispatches, caught, records, entries, sources };
}

let cache = null;
function sessions() {
  if (!cache) cache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, retireSlotIntoSharedCooldown) }));
  return cache;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: retireSlotIntoSharedCooldown == oracle outside the scratch window", { skip: SKIP }, () => {
  gate(retireSlotIntoSharedCooldown);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  retireSlotIntoSharedCooldown(b);

  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.a, b.regs.a, "the accumulator diverged");

  const dirty = allDiffs(a, b).map((d) => d.addr);
  assert.deepEqual(
    dirty,
    [sp - 2, sp - 1],
    "the scratch window is not both bytes here, so the exclusion is the wrong shape",
  );
  console.log(
    `  EQUAL: entry ix=${hex4(entryState().regs.ix)} iy=${hex4(entryState().regs.iy)} ` +
      `source=${entryState().mem8[SHARED_SOURCE]} sp=${hex4(sp)}; identical outside ` +
      `${dirty.map(hex4).join(" ")}`,
  );
});

test("THE REAL CORPUS IS THIN: one base pair, two source values, three dispatches", { skip: SKIP }, () => {
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.deepEqual([...s.records], [REAL_RECORD], `the ${s.label} tape presented a second record base`);
    assert.deepEqual([...s.entries], [REAL_ENTRY], `the ${s.label} tape presented a second entry base`);
    assert.deepEqual(
      [...s.sources].sort((x, y) => x - y),
      REAL_SOURCES[s.label],
      `the ${s.label} tape's source-byte set moved, so the crafted sweep covers the wrong hole`,
    );
  }
  const e = entryState();
  assert.deepEqual(
    [e.mem8[REAL_RECORD], e.mem8[REAL_ENTRY], e.mem8[REAL_ENTRY + 49], e.regs.a],
    [0, 0, 0, 0],
    "the captured entry no longer arrives with the retired cells already zero, so the crafted " +
      "plant below is covering a hole the real data has started to cover itself",
  );
  console.log(
    `  THIN CORPUS: ${sessions().map((s) => `${s.label} ${s.dispatches}`).join(", ")} dispatches, ` +
      `one base pair, sources ${sessions().flatMap((s) => [...s.sources]).join("/")}; the three ` +
      "retired cells already read zero at the captured entry",
  );
});

test("CRAFTED SWEEP: six base pairs against all 256 source values", { skip: SKIP }, () => {
  assert.equal(sweepCaught(retireSlotIntoSharedCooldown), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  CRAFTED SWEEP: ${SWEEP_SIZE} base x source comparisons identical`);
});

test("EXCLUDED, deliberately: the stack pointer and pc, and nothing else", { skip: SKIP }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  retireSlotIntoSharedCooldown(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["sp"], "the excluded set changed shape: only the stack pointer may differ");
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.a, b.regs.a, "the accumulator is held, not excluded");
  console.log(`  EXCLUDED: sp and pc — the accumulator and RAM are held`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: stocks the byte but never takes the slot out of play. */
function brokenSkipsRetire(m) {
  m.regs.a = m.mem8[SHARED_SOURCE];
  m.mem8[(m.regs.ix + RECORD_BYTE) & 0xffff] = m.regs.a;
}

/** BUG: takes the slot out of play and leaves the record byte standing. */
function brokenSkipsStock(m) {
  m.mem8[m.regs.ix] = 0;
  m.mem8[m.regs.iy] = 0;
  m.mem8[(m.regs.iy + SECOND_AXIS_OFFSET) & 0xffff] = 0;
}

/** BUG: stocks a zero rather than the shared value, which is invisible while that value is zero. */
function brokenStocksZero(m) {
  brokenSkipsStock(m);
  m.regs.a = 0;
  m.mem8[(m.regs.ix + RECORD_BYTE) & 0xffff] = 0;
}

/** BUG: stocks the byte one place further along the record. */
function brokenWrongRecordByte(m) {
  brokenSkipsStock(m);
  m.regs.a = m.mem8[SHARED_SOURCE];
  m.mem8[(m.regs.ix + RECORD_BYTE + 1) & 0xffff] = m.regs.a;
}

/** BUG: stocks the right byte and leaves the accumulator holding whatever the caller had. */
function brokenDropsAccumulator(m) {
  brokenSkipsStock(m);
  m.mem8[(m.regs.ix + RECORD_BYTE) & 0xffff] = m.mem8[SHARED_SOURCE];
}

/**
 * Per twin: how many of the crafted comparisons it gets wrong. Every number is measured and
 * asserted as an equality, so a twin caught on the WRONG set fails as loudly as one not caught.
 * The two that fall short of the whole space do so for one reason: the accumulator they leave
 * behind is zero, so the source value 0 hides them, once per base pair.
 */
const HIDDEN_BY_ZERO_SOURCE = BASE_PAIRS.length;

const TWINS = [
  ["no-op", brokenNoOp, SWEEP_SIZE],
  ["skips-retire", brokenSkipsRetire, SWEEP_SIZE],
  ["skips-stock", brokenSkipsStock, SWEEP_SIZE],
  ["stocks-zero", brokenStocksZero, SWEEP_SIZE - HIDDEN_BY_ZERO_SOURCE],
  ["wrong-record-byte", brokenWrongRecordByte, SWEEP_SIZE],
  ["drops-accumulator", brokenDropsAccumulator, SWEEP_SIZE - HIDDEN_BY_ZERO_SOURCE],
];

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip: SKIP }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} crafted entries`);
  });
}

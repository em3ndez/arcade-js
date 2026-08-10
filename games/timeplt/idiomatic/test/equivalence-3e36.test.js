// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepFourActorSlots — memory-equivalent to the frozen oracle at ROM 0x3E36.
 *
 * GATE: strict unit-capture with ONE exclusion, a corpus replay of every dispatch of a driven
 *   session, and an EXHAUSTIVE sweep of the byte that decides what each of the four slots does.
 *   What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — everything outside a four-byte dead scratch window below the
 *      entry stack pointer, the two words the frozen oracle parks and calls through and the rewrite
 *      no longer touches (the step is now a direct call that neither parks nor lifts).
 *   2. THE FOUR SLOTS ARE THE CONTENT — asserted by twins that visit three of them, one of them
 *      twice, or the right records paired with the wrong entries, since nothing else about this
 *      entry is a decision.
 *   3. EXHAUSTIVE — the head byte of all four records swept 0..255 TOGETHER, which covers all
 *      three exits of the step, and then every MIXED pattern over a four-value alphabet, which is
 *      what discriminates the pairing of records to entries: with all four slots alike, every
 *      entry is written either way.
 *   4. CORPUS — every dispatch of a driven session, on a clone taken at the dispatch, with the
 *      head bytes the session actually presented reported rather than assumed.
 *   5. TEETH — six twins, each caught on its own exact count over the sweep.
 *
 * HOLE: the ORDER the four slots are visited in is not observable to this gate and no twin
 * attacks it. The four act on disjoint records and disjoint entries, so any order leaves the same
 * memory; a reordering twin would be caught zero times and would read as coverage it is not.
 *
 * HOLE: the sweep drives all four records to the SAME head byte. A per-slot mixture is covered
 * only by whatever the corpus happened to present, which the corpus arm reports.
 * HOLE: what the four slots hold is not settled here.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3e36.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stepFourActorSlots } from "../stepFourActorSlots.js";
import { loc_3e36 as oracle } from "../../translated/loc_3e36.js";
import { dispatchObjectSlotByHeadByte } from "../dispatchObjectSlotByHeadByte.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3e36;

/** Record base and entry base for each of the four slots. */
const SLOTS = [
  [0xa810, 0xaa12],
  [0xa820, 0xaa14],
  [0xa830, 0xaa16],
  [0xa840, 0xaa18],
];
const IDLE = 0;

// Dead stack scratch below entry sp: the oracle parks a resume address (sp-2) and calls into the step
// (sp-4); the direct-call rewrite touches neither. sp is restored, nothing reads below it -> four dead
// bytes. Measured as the deepest divergence over every judged state; live writes all land in game RAM.
const SCRATCH_BYTES = 4;

// Upper bound on register divergence: nothing outside this set may move (fewer dirty still passes). The
// two cursors are outside it -- the fourth slot leaves them put on both sides, and EQUAL checks them.
const EXCLUDED = ["a", "f", "sp"];

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 303;

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function outsideScratch(a, b, sp) {
  return allDiffs(a, b).filter((d) => d.addr < sp - SCRATCH_BYTES || d.addr >= sp);
}

function compare(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return outsideScratch(a, b, sp)[0] ?? null;
}

let captured = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const heads = new Set();
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    for (const [record] of SLOTS) heads.add(mm.mem8[record]);
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  return { dispatches, caught, heads };
}

function entryState() {
  if (captured === null) replay(stepFourActorSlots);
  return captured;
}

/** A real captured machine with every one of the four record head bytes forced to one value. */
function craft(head) {
  const m = entryState().clone();
  for (const [record] of SLOTS) m.mem8[record] = head;
  return m;
}

// Each slot gets its OWN head byte from a four-value alphabet (inert, the two split values, one that
// clamps). A uniform sweep can't see which entry a record was paired with -- every slot writes either way.
const ALPHABET = [0, 1, 255, 60];

function craftMixed(pattern) {
  const m = entryState().clone();
  SLOTS.forEach(([record], i) => {
    m.mem8[record] = ALPHABET[(pattern >> (2 * i)) & 3];
  });
  return m;
}

const MIXED = ALPHABET.length ** SLOTS.length;

function judgingStates() {
  const out = [];
  for (let head = 0; head < 256; head++) out.push(craft(head));
  for (let pattern = 0; pattern < MIXED; pattern++) out.push(craftMixed(pattern));
  return out;
}

const JUDGED = 256 + MIXED;

function sweepCaught(candidate) {
  let caught = 0;
  for (const machine of judgingStates()) if (compare(candidate, machine)) caught++;
  return caught;
}


// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the scratch window", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  stepFourActorSlots(b);
  assert.deepEqual(
    outsideScratch(a, b, sp),
    [],
    `a divergence escaped the scratch window — ${show(outsideScratch(a, b, sp)[0])}`,
  );
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.equal(a.regs.ix, b.regs.ix, "the record cursor diverged");
  assert.equal(a.regs.iy, b.regs.iy, "the entry cursor diverged");
  console.log(`  EQUAL: sp ${hex4(sp)}, cursors ${hex4(a.regs.ix)}/${hex4(a.regs.iy)}`);
});

test("EXHAUSTIVE: every uniform head byte and every mixed pattern behaves alike", { skip }, () => {
  for (let head = 0; head < 256; head++) {
    const d = compare(stepFourActorSlots, craft(head));
    assert.equal(d, null, `head=${head}: ${show(d)}`);
  }
  for (let pattern = 0; pattern < MIXED; pattern++) {
    const d = compare(stepFourActorSlots, craftMixed(pattern));
    assert.equal(d, null, `pattern=${pattern}: ${show(d)}`);
  }
  console.log(`  EXHAUSTIVE: 256 uniform head bytes and ${MIXED} mixed patterns identical`);
});

test("THE SWEEP REACHES BOTH SIDES OF THE PARK, and the idle arm is inert", { skip }, () => {
  const idle = craft(IDLE);
  const before = idle.clone();
  oracle(idle);
  assert.deepEqual(
    outsideScratch(before, idle, before.regs.sp),
    [],
    "the all-idle sweep entry now moves memory, so the park's condition covers the wrong set",
  );
  let live = 0;
  for (let head = 1; head < 256; head++) {
    const m = craft(head);
    const was = m.clone();
    oracle(m);
    if (outsideScratch(was, m, was.regs.sp).length > 0) live++;
  }
  assert.ok(live > 0, "no non-idle head byte moved anything, so the live side is untested");
  console.log(`  BOTH SIDES: the idle head is inert; ${live} of 255 non-idle heads move memory`);
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(stepFourActorSlots);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  console.log(
    `  CORPUS: ${r.dispatches} dispatches identical; head bytes presented ${[...r.heads].join(",")}`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin visits a different set of slots (the whole of what this entry decides); none parks, so
// a catch measures the slot set, nothing else.

function visit(m, slots) {
  for (const [record, entry] of slots) {
    m.regs.ix = record;
    m.regs.iy = entry;
    dispatchObjectSlotByHeadByte(m);
  }
}

/** The same four records paired with the entry bases rotated by one. */
const CROSSED = SLOTS.map(([record], i) => [record, SLOTS[(i + 1) % 4][1]]);
const ONE_RECORD_ON = SLOTS.map(([record, entry]) => [record + 16, entry]);
const ONE_ENTRY_ON = SLOTS.map(([record, entry]) => [record, entry + 2]);

const TWINS = [
  ["no-op", () => {}, 510],
  ["three-slots", (m) => visit(m, SLOTS.slice(0, 3)), 447],
  ["first-slot-twice", (m) => visit(m, [SLOTS[0], ...SLOTS]), 65],
  ["crossed-pairs", (m) => visit(m, CROSSED), 238],
  ["wrong-record-stride", (m) => visit(m, ONE_RECORD_ON), 510],
  ["wrong-entry-stride", (m) => visit(m, ONE_ENTRY_ON), 508],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the judged states`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${JUDGED} judged states`);
  });
}

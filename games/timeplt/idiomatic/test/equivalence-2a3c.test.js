// SPDX-License-Identifier: GPL-3.0-only
/**
 * refreshSpriteFromHeading — memory-equivalent to the frozen oracle at ROM 0x2A3C.
 *
 * GATE: unit-capture judged by a MASKED RAM diff plus a declared live-out comparison, a replayed
 *   corpus of every dispatch, an exhaustive crafted sweep of the whole input space, and teeth.
 *
 *   THE ONE EXCLUSION is the dead stack scratch: the frozen routine reaches the pair it stores
 *   through a call, and that call pushes further, so the four bytes just below the entry stack
 *   pointer can hold return slots the rewrite never writes. The window is exactly [SP-4, SP) and
 *   every arm PINS it — each walks the whole dump and asserts no divergence escapes it.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — identical outside that four-byte window, the shape and the
 *      mirroring byte included.
 *   2. NOT VACUOUS — a candidate that does nothing FAILS the same masked comparison.
 *   3. CORPUS — every dispatch of the driven session. THE UNDRIVEN SESSION NEVER REACHES THIS
 *      ROUTINE, which is asserted rather than passed over, because it is what makes the tape
 *      load-bearing here.
 *   4. LIVE-OUT — the shape left in the accumulator is compared as well as the two slots.
 *   5. EXCLUDED — the register divergence BOUNDED by a declared set: nothing outside it may move,
 *      and a rewrite that clobbers fewer of them stays green.
 *   6. EXHAUSTIVE — the whole input space is the heading byte and the one counter bit that
 *      chooses between the two shape banks: 256 headings against both parities, and the two
 *      target slots pre-loaded with a value the correct answer never leaves, so every point
 *      would catch a routine that wrote nothing.
 *   7. TEETH — six twins, each caught on an exact count of crafted entries. The bank-ignoring
 *      twin scores exactly half, which is the arm reporting its own shape: it can only be wrong
 *      on the parity where the bank is actually added.
 *
 * HOLE: the sweep varies the heading and the counter and nothing else. The two cursors are the
 * ones the captured dispatch arrived with, so which slot is written is not varied — a twin that
 * writes the right bytes into the wrong object would be caught only by the corpus arm, where the
 * cursors do move.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2a3c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { refreshSpriteFromHeading } from "../refreshSpriteFromHeading.js";
import { spriteForHeading } from "../spriteForHeading.js";
import { loc_2a3c as oracle } from "../../translated/loc_2a3c.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";
import { FRAME_TICK } from "../names.js";

const TARGET = 0x2a3c;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const SCRATCH_BYTES = 4;
const HEADING_SLOT = 0x02;
const SHAPE_SLOT = 0x01;
const ATTRIBUTE_SLOT = 0x30;
const BANK_BIT = 0x02;
/** A value the correct answer never leaves in either slot, so no crafted point can be vacuous. */
const POISON = 0xa5;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 2009, attract: 0 };

const EXCLUDED = ["f", "d", "e", "h", "l", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry, and the masked comparison ────────────────────────────────────────────────

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
  if (entry === null) gate(refreshSpriteFromHeading);
  return entry;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Masked RAM first, then the shape left in the accumulator and the pair beside it. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of ["a", "b", "c"]) {
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

function craft(heading, counter) {
  const m = entryState().clone();
  m.mem8[u16(m.regs.ix + HEADING_SLOT)] = heading;
  m.mem8[FRAME_TICK] = counter;
  m.mem8[u16(m.regs.iy + SHAPE_SLOT)] = POISON;
  m.mem8[u16(m.regs.iy + ATTRIBUTE_SLOT)] = POISON;
  return m;
}

const COUNTERS = [0x00, BANK_BIT];
const SWEEP_SIZE = 256 * COUNTERS.length;

function sweepCaught(candidate) {
  let caught = 0;
  for (const counter of COUNTERS) {
    for (let heading = 0; heading < 256; heading++) {
      if (unitDiff(candidate, craft(heading, counter))) caught++;
    }
  }
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const entries = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      entries.add(mm.regs.iy);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, entries };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, refreshSpriteFromHeading) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the two bytes go into each other's slot. */
function brokenSwapsTheSlots(m) {
  const { regs, mem8 } = m;
  const iy = regs.iy;
  spriteForHeading(m);
  mem8[u16(iy + ATTRIBUTE_SLOT)] = regs.b;
  regs.a = regs.b;
  mem8[u16(iy + SHAPE_SLOT)] = regs.c;
}

/** BUG: only the shape is stored, so the mirroring byte keeps whatever it held. */
function brokenDropsTheAttribute(m) {
  const { regs, mem8 } = m;
  const iy = regs.iy;
  spriteForHeading(m);
  regs.a = regs.b;
  mem8[u16(iy + SHAPE_SLOT)] = regs.a;
}

/** BUG: the pair lands one slot on, in the next entry. */
function brokenWritesTheNextEntry(m) {
  const { regs, mem8 } = m;
  const iy = u16(regs.iy + 2);
  spriteForHeading(m);
  mem8[u16(iy + ATTRIBUTE_SLOT)] = regs.c;
  regs.a = regs.b;
  mem8[u16(iy + SHAPE_SLOT)] = regs.a;
}

/** BUG: the slots land right and the accumulator is left holding whatever it had. */
function brokenDropsTheLiveOut(m) {
  const { regs, mem8 } = m;
  const iy = regs.iy;
  spriteForHeading(m);
  mem8[u16(iy + ATTRIBUTE_SLOT)] = regs.c;
  mem8[u16(iy + SHAPE_SLOT)] = regs.b;
}

/** BUG: the shape is taken without the bank the counter selects. */
function brokenIgnoresTheBank(m) {
  const { regs, mem8 } = m;
  const iy = regs.iy;
  const before = mem8[FRAME_TICK];
  mem8[FRAME_TICK] = before & ~BANK_BIT;
  spriteForHeading(m);
  mem8[FRAME_TICK] = before;
  mem8[u16(iy + ATTRIBUTE_SLOT)] = regs.c;
  regs.a = regs.b;
  mem8[u16(iy + SHAPE_SLOT)] = regs.a;
}

const TWINS = [
  ["no-op", brokenNoOp, 512],
  ["swaps-the-slots", brokenSwapsTheSlots, 512],
  ["drops-the-attribute", brokenDropsTheAttribute, 512],
  ["writes-the-next-entry", brokenWritesTheNextEntry, 512],
  ["drops-the-live-out", brokenDropsTheLiveOut, 512],
  ["ignores-the-bank", brokenIgnoresTheBank, 256],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the four-byte scratch window", { skip }, () => {
  gate(refreshSpriteFromHeading);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  refreshSpriteFromHeading(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.a, b.regs.a, "the shape left in the accumulator diverged");
  console.log(
    `  EQUAL: entry record=${hex4(entryState().regs.ix)} entry-slot=${hex4(entryState().regs.iy)} ` +
      `sp=${hex4(sp)}; identical outside [SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same masked comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed an empty candidate, so it measures nothing here");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CORPUS: the driven session's every dispatch; the undriven one reaches none", { skip }, () => {
  const [driven, undriven] = sessions();
  assert.equal(driven.dispatches, DISPATCHES.shared, "the driven dispatch count moved");
  assert.equal(driven.caught, 0, `the rewrite diverged on ${driven.caught} driven dispatches`);
  assert.equal(
    undriven.dispatches,
    DISPATCHES.attract,
    "the undriven session now reaches this routine, so the tape is no longer what buys the corpus",
  );
  assert.ok(driven.entries.size > 1, "vacuous: every dispatch wrote the same slot");
  console.log(
    `  CORPUS: ${driven.dispatches} driven dispatches over ${driven.entries.size} slots, ` +
      "identical on each; the undriven session reaches none",
  );
});

test("EXCLUDED, deliberately: registers and pc, and the scratch pushes", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  refreshSpriteFromHeading(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set: the shape and the mirroring byte are " +
      "live-outs and must not appear here",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("EXHAUSTIVE: every heading against both shape banks", { skip }, () => {
  assert.equal(sweepCaught(refreshSpriteFromHeading), 0, "the rewrite diverged somewhere in the crafted space");
  const m = craft(0, 0);
  refreshSpriteFromHeading(m);
  assert.notEqual(m.mem8[u16(m.regs.iy + SHAPE_SLOT)], POISON, "the shape slot was left poisoned, " +
    "so every crafted point is agreeing on an unwritten cell");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} heading x bank points identical, from a poisoned pair`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${SWEEP_SIZE} crafted entries`);
  });
}

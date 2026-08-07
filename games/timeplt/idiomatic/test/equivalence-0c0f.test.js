// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCaptionInPenColour — memory-equivalent to the frozen oracle at ROM 0x0C0F.
 *
 * GATE: unit-capture judged by a MASKED RAM diff, plus a replayed corpus, plus a crafted sweep
 *   over the whole of the routine's input space, plus a declared live-out comparison, plus teeth.
 *
 *   THE ONE EXCLUSION is the dead stack scratch: the frozen routine brackets its table lookup
 *   with a call, so the two bytes just below the entry stack pointer can hold that call's return
 *   slot, and the rewrite models no stack. The window is exactly [SP-2, SP) and every arm PINS
 *   it — each walks the whole dump and asserts no divergence escapes it, so it cannot widen.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — identical outside that two-byte window.
 *   2. NOT VACUOUS — a candidate that does nothing FAILS the same masked comparison.
 *   3. CORPUS — every dispatch of a driven and an undriven session. The two sessions present
 *      DIFFERENT records and different colours, which is asserted rather than hoped for.
 *   4. LIVE-OUT — the cursor the painter leaves standing is compared explicitly, because the
 *      caller steps it on twice without reloading it. RAM equality is not blind to it here, and
 *      the arm says so rather than claiming credit it has not earned.
 *   5. EXCLUDED — the register divergence pinned to a measured set.
 *   6. EXHAUSTIVE — the routine's whole input space is the record index and the colour cell.
 *      Every index the table can be walked to is swept against sixteen colours, and the colour
 *      is swept over its full 0..255 at a fixed index to pin the low-nibble mask.
 *   7. TEETH — six twins, each caught on an exact count of crafted entries. Two score below
 *      the total: the whole-colour twin agrees wherever the colour cell's high nibble is already
 *      clear, and the unscaled-index twin dies on some records instead of differing, which the
 *      comparison counts as caught either way.
 *
 * HOLE: THE INDEX SWEEP STOPS AT 32. Beyond that the pointer table has run out and the bytes
 * read as a record send the painter into the program image, where BOTH sides throw identically.
 * That is measured — the arm asserts the throw for index 33 — but it means nothing above 32 is
 * compared, and no caller is known to pass one.
 * HOLE: one captured backdrop. The character and colour planes carry whatever the session left,
 * which matters only in that a caption painted over identical priors is compared on both sides.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0c0f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { drawCaptionInPenColour } from "../drawCaptionInPenColour.js";
import { loc_0c0f as oracle } from "../../translated/loc_0c0f.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0c0f;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const COLOUR = 0xad0c;
const COLOUR_FIELD = 0x0f;
const SCRATCH_BYTES = 2;

const LAST_RECORD = 32;
const FIRST_UNBACKED_RECORD = 33;
const SWEEP_COLOURS = 16;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 25, attract: 13 };
/** The records each session selects. Measured, and asserted as sets, because they differ. */
const REAL_RECORDS = { shared: [2, 9, 14, 26], attract: [2, 27] };

const EXCLUDED = ["a", "f", "sp"];

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
  if (entry === null) gate(drawCaptionInPenColour);
  return entry;
}

/** The window the frozen call's return slot dirties: the bytes just below the entry pointer. */
const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

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

/**
 * Masked RAM first, then the cursor the painter leaves standing. A candidate that DIES where the
 * frozen routine survives is a divergence too, and one twin only fails that way.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "survived", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.de !== b.regs.de) return { addr: null, a: a.regs.de, b: b.regs.de };
  return null;
}

/** A real captured machine with the record index and the colour cell forced. */
function craft(record, colour) {
  const m = entryState().clone();
  m.regs.a = record;
  m.mem8[COLOUR] = colour;
  return m;
}

function craftedPoints() {
  const points = [];
  for (let record = 0; record <= LAST_RECORD; record++) {
    for (let colour = 0; colour < SWEEP_COLOURS; colour++) points.push([record, colour]);
  }
  for (let colour = 0; colour < 256; colour++) points.push([REAL_RECORDS.shared[0], colour]);
  return points;
}

const POINTS = craftedPoints();

function sweepCaught(candidate) {
  let caught = 0;
  for (const [record, colour] of POINTS) {
    if (unitDiff(candidate, craft(record, colour))) caught++;
  }
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const records = new Set();
  const colours = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      records.add(mm.regs.a);
      colours.add(mm.mem8[COLOUR]);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, records, colours };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, drawCaptionInPenColour) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

const RECORD_TABLE = 0x0c50;
const GLYPHS_START = 3;

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the record's own third byte is used as the colour instead of the colour cell. */
function brokenUsesTheRecordColour(m) {
  const { regs, mem8 } = m;
  const record = m.mem16[RECORD_TABLE + 2 * regs.a];
  regs.de = m.mem16[record];
  regs.c = mem8[record + 2];
  regs.hl = record + GLYPHS_START;
  paint(m);
}

/** BUG: the whole colour byte goes out, not just its low half. */
function brokenKeepsTheWholeColour(m) {
  const { regs, mem8 } = m;
  const record = m.mem16[RECORD_TABLE + 2 * regs.a];
  regs.de = m.mem16[record];
  regs.c = mem8[COLOUR];
  regs.hl = record + GLYPHS_START;
  paint(m);
}

/** BUG: the third byte is not stepped over, so the run starts one glyph early. */
function brokenStartsOneEarly(m) {
  const { regs, mem8 } = m;
  const record = m.mem16[RECORD_TABLE + 2 * regs.a];
  regs.de = m.mem16[record];
  regs.c = mem8[COLOUR] & COLOUR_FIELD;
  regs.hl = record + GLYPHS_START - 1;
  paint(m);
}

/** BUG: the index is not scaled, so it selects a record straddling two table entries. */
function brokenIndexNotScaled(m) {
  const { regs, mem8 } = m;
  const record = m.mem16[RECORD_TABLE + regs.a];
  regs.de = m.mem16[record];
  regs.c = mem8[COLOUR] & COLOUR_FIELD;
  regs.hl = record + GLYPHS_START;
  paint(m);
}

/** BUG: the caption lands right but the cursor is left where it started. */
function brokenDropsTheCursor(m) {
  const { regs, mem8 } = m;
  const record = m.mem16[RECORD_TABLE + 2 * regs.a];
  const before = regs.de;
  regs.de = m.mem16[record];
  regs.c = mem8[COLOUR] & COLOUR_FIELD;
  regs.hl = record + GLYPHS_START;
  paint(m);
  regs.de = before;
}

/** The shared painter, reached the same way the rewrite reaches it. */
function paint(m) {
  const { regs, mem8 } = m;
  const END_OF_TEXT = 185;
  const PLANE_BIT = 0x0400;
  for (;;) {
    const glyph = mem8[regs.hl];
    if (glyph === END_OF_TEXT) break;
    mem8[regs.de] = glyph;
    mem8[regs.de & ~PLANE_BIT] = regs.c;
    regs.de = (regs.de | PLANE_BIT) - 32;
    regs.hl = (regs.hl + 1) & 0xffff;
  }
}

const TWINS = [
  ["no-op", brokenNoOp, 784],
  ["uses-the-record-colour", brokenUsesTheRecordColour, 751],
  ["keeps-the-whole-colour", brokenKeepsTheWholeColour, 240],
  ["starts-one-early", brokenStartsOneEarly, 784],
  ["index-not-scaled", brokenIndexNotScaled, 768],
  ["drops-the-cursor", brokenDropsTheCursor, 784],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the two-byte scratch window", { skip }, () => {
  gate(drawCaptionInPenColour);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  drawCaptionInPenColour(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.de, b.regs.de, "the cursor left standing diverged");
  console.log(
    `  EQUAL: entry record=${entryState().regs.a} colour=${entryState().mem8[COLOUR]} ` +
      `sp=${hex4(sp)}; identical outside [SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same masked comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed an empty candidate, so it measures nothing here");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell, not on the cursor alone");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CORPUS: two sessions, different records each, every dispatch identical", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.deepEqual(
      [...s.records].sort((x, y) => x - y),
      REAL_RECORDS[s.label],
      `the ${s.label} tape's record set moved`,
    );
    total += s.dispatches;
  }
  const all = new Set(sessions().flatMap((s) => [...s.records]));
  assert.ok(all.size > REAL_RECORDS.shared.length, "the two tapes no longer differ, so the second " +
    "session adds nothing and this arm should be re-derived");
  console.log(
    `  CORPUS: ${total} dispatches, ${all.size} distinct records across the two sessions, ` +
      `colours ${sessions().map((s) => [...s.colours].join("/")).join(" and ")}`,
  );
});

test("EXCLUDED, deliberately: registers and pc, and the scratch push", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  drawCaptionInPenColour(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape: the cursor is a live-out and must not appear here",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("EXHAUSTIVE: every backed record against sixteen colours, and one record against all", { skip }, () => {
  assert.equal(sweepCaught(drawCaptionInPenColour), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${POINTS.length} crafted entries identical`);
});

test("THE SWEEP'S EDGE: one record past the table throws on BOTH sides", { skip }, () => {
  const a = craft(FIRST_UNBACKED_RECORD, 0);
  const b = craft(FIRST_UNBACKED_RECORD, 0);
  assert.throws(() => oracle(a), "the frozen routine no longer throws past the table, so the " +
    "sweep's upper bound is arbitrary and should be raised");
  assert.throws(() => drawCaptionInPenColour(b), "the rewrite survives where the frozen routine dies");
  console.log(`  EDGE: record ${FIRST_UNBACKED_RECORD} throws on both sides, as the hole records`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${POINTS.length} crafted entries`);
  });
}

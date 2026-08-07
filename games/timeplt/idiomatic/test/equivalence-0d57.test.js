// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d57 — memory-equivalent to the frozen oracle at ROM 0x0D57.
 *
 * GATE: strict unit-capture through unitEquivalence, PLUS a poisoned-plane comparison,
 *   because the strict one alone would rest on the wrong evidence. At the captured
 *   dispatch the run being painted is identical to what is already on screen, so no
 *   plane cell CHANGES and a broken twin can only show up in stack scratch. Filling both
 *   tilemap planes with a marker first makes every cell the painter WRITES visible, and
 *   loading the two adjacent packed-decimal fields with different digits is what makes a
 *   twin reading the wrong field diverge at a painted cell. Every twin below is required
 *   to be caught inside the planes, not merely somewhere.
 *
 *   1. EQUAL      — RAM byte-identical across the whole state dump at the real dispatch.
 *   2. PAINTS     — over the poisoned planes a run really appears in both of them, and
 *                   every colour cell written carries the colour this entry fixes.
 *   3. REGISTERS  — nothing is excluded here: the whole register file and pc agree too.
 *   4. PRIORS     — the packed-decimal field swept over a spread of values, since what
 *                   is painted depends on it and on nothing else this routine controls.
 *   5. TEETH      — four broken twins, each caught AT A PLANE CELL.
 *
 * The painter itself is still frozen on both sides, so what this file gates is the CHOICE
 * of the three arguments handed to it.
 *
 * HOLE: one captured machine. The prior sweep covers the content of the field, not the
 * surrounding machine, and the run's position and colour are constants that cannot be
 * swept at all — the twins vary them instead.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0d57.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0d57 } from "../loc_0d57.js";
import { loc_0d57 as oracle } from "../../translated/loc_0d57.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0d57;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FIRST_CELL = 0xa781;
const FIELD_HIGH_END = 0xad35;
const FIELD_BYTES = 3;
const COLOUR = 0x10;
const PAINTER = 0x0d73;

/** The two 1KB tilemap planes the painter writes, colour first in the address space. */
const COLOUR_PLANE = 0xa000;
const CHARACTER_PLANE = 0xa400;
const PLANE_BYTES = 0x400;
/** No glyph code and no colour this routine can lay down, so any write is visible. */
const POISON = 0x5a;
/** Two packed-decimal fields that share no digit, so reading the wrong one shows. */
const MINE_DIGITS = [0x12, 0x34, 0x56];
const OTHER_DIGITS = [0x98, 0x76, 0x54];

let entry = null;

function strict(candidate) {
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
  if (entry === null) strict(loc_0d57);
  return entry;
}

/**
 * A clone of the captured entry with both planes filled with a marker byte, and the two
 * adjacent packed-decimal fields loaded with DIFFERENT digits. Both are needed: the marker
 * makes every cell written visible, and distinct fields are what let a twin reading the
 * wrong one diverge at a painted cell rather than only in stack scratch — at the captured
 * entry the two fields hold the same digits, so a wrong-field twin paints the same run.
 */
function poisoned() {
  const mm = entryState().clone();
  for (let a = COLOUR_PLANE; a < CHARACTER_PLANE + PLANE_BYTES; a++) mm.mem8[a] = POISON;
  for (let i = 0; i < FIELD_BYTES; i++) {
    mm.mem8[FIELD_HIGH_END - i] = MINE_DIGITS[i];
    mm.mem8[FIELD_HIGH_END + FIELD_BYTES - i] = OTHER_DIGITS[i];
  }
  return mm;
}

/** Oracle vs candidate over a poisoned plane, so every cell written is visible. */
function poisonedDiff(candidate) {
  const a = poisoned();
  const b = poisoned();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Oracle vs candidate from the captured entry, with the field loaded from `bytes`. */
function fieldDiff(candidate, bytes) {
  const a = entryState().clone();
  const b = entryState().clone();
  for (const mm of [a, b]) {
    for (let i = 0; i < FIELD_BYTES; i++) mm.mem8[FIELD_HIGH_END - i] = bytes[i];
  }
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** Every packed-decimal digit pair, plus values no valid field can hold. */
const FIELD_CASES = [];
for (let hi = 0; hi < 256; hi += 17) FIELD_CASES.push([hi, (hi * 7) & 0xff, (hi * 13) & 0xff]);
FIELD_CASES.push([0, 0, 0], [0x99, 0x99, 0x99], [0xff, 0xff, 0xff], [0x0a, 0xbc, 0xde]);

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the twin that proves the comparison sees a real dispatch. */
function brokenNoOp() {}

/** BUG: starts the run one cell further along the line. */
function brokenWrongCell(m) {
  const { regs } = m;
  regs.de = FIRST_CELL + 1;
  regs.hl = FIELD_HIGH_END;
  regs.c = COLOUR;
  m.call(PAINTER);
}

/** BUG: reads the other player's field. */
function brokenWrongField(m) {
  const { regs } = m;
  regs.de = FIRST_CELL;
  regs.hl = FIELD_HIGH_END + FIELD_BYTES;
  regs.c = COLOUR;
  m.call(PAINTER);
}

/** BUG: lays down a different colour beside every cell. */
function brokenWrongColour(m) {
  const { regs } = m;
  regs.de = FIRST_CELL;
  regs.hl = FIELD_HIGH_END;
  regs.c = COLOUR + 1;
  m.call(PAINTER);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["wrong-cell", brokenWrongCell],
  ["wrong-field", brokenWrongField],
  ["wrong-colour", brokenWrongColour],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_0d57 == oracle on RAM", { skip }, () => {
  const r = strict(loc_0d57);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  console.log(`  EQUAL: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("PAINTS: over a poisoned plane the run really appears, in both planes", { skip }, () => {
  const after = poisoned();
  oracle(after);
  const glyphs = [];
  const colours = [];
  for (let a = COLOUR_PLANE; a < CHARACTER_PLANE + PLANE_BYTES; a++) {
    if (after.mem8[a] === POISON) continue;
    (a >= CHARACTER_PLANE ? glyphs : colours).push(a);
  }
  assert.ok(glyphs.length > 0, "no character cell was written: this gate has no teeth");
  assert.ok(colours.length > 0, "no colour cell was written: the colour argument is untested");
  assert.ok(
    colours.every((a) => after.mem8[a] === COLOUR),
    "a colour cell was written with something other than the colour this entry fixes",
  );
  console.log(
    `  PAINTS: ${glyphs.length} character cells from ${hex4(glyphs[0])}, ` +
      `${colours.length} colour cells from ${hex4(colours[0])}`,
  );
});

test("REGISTERS: nothing is excluded here — the whole file agrees too", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_0d57(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, [], "a register moved: the two arms no longer hand over identically");
  assert.equal(a.pc, b.pc, "both arms leave through the same painter, so pc agrees as well");
  assert.equal(firstStateDiff(a.dumpState(), b.dumpState()), null, "RAM must still agree");
  console.log("  REGISTERS: whole register file and pc identical, not merely excluded");
});

test("PRIORS: the same run is painted for every field value tried", { skip }, () => {
  for (const bytes of FIELD_CASES) {
    const d = fieldDiff(loc_0d57, bytes);
    assert.equal(d, null, `field=${bytes.join(",")}: ${show(d)}`);
  }
  console.log(`  PRIORS: ${FIELD_CASES.length} field values identical`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT, at a plane cell`, { skip }, () => {
    const r = strict(twin);
    assert.notEqual(r.ram, null, `the strict gate PASSED the ${label} twin`);
    assert.equal(r.equal, false, "a RAM divergence must fail the whole comparison");

    const d = poisonedDiff(twin);
    assert.notEqual(d, null, `the poisoned comparison PASSED the ${label} twin`);
    assert.ok(
      d.addr >= COLOUR_PLANE && d.addr < CHARACTER_PLANE + PLANE_BYTES,
      `the ${label} twin diverges first at ${hex4(d.addr)}, outside the two planes — the ` +
        "teeth would then rest on stack scratch rather than on anything painted",
    );
    console.log(`  TEETH/${label}: caught at a plane cell — ${show(d)}`);
  });
}

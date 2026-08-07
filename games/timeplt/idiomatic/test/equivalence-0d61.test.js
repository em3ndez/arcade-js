// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d61 — memory-equivalent to the frozen oracle at ROM 0x0D61.
 *
 * GATE: crafted-entry, because no dispatch of 0x0D61 exists to capture. The shared
 *   coin -> start tape is a ONE-PLAYER tape, and the caller picks between this entry and
 *   its sibling at 0x0D57 on a cell the tape never sets; the UNREACHED arm below runs the
 *   whole tape with a counting hook and asserts zero dispatches, so the crafting is
 *   forced rather than chosen. The entry state is therefore a REAL machine — captured at
 *   a live dispatch of that sibling — with this routine run on clones of it.
 *
 *   Both planes are then filled with a marker so every cell the painter WRITES is
 *   visible, and the two adjacent packed-decimal fields are loaded with different digits
 *   so a twin reading the wrong one diverges at a painted cell rather than in stack
 *   scratch. Every twin is required to be caught inside the planes.
 *
 *   1. UNREACHED  — the tape really does not dispatch this address.
 *   2. EQUAL      — RAM byte-identical on the crafted entry.
 *   3. PAINTS     — a run appears in both planes, coloured with the colour it fixes.
 *   4. REGISTERS  — nothing is excluded here: the whole register file and pc agree too.
 *   5. PRIORS     — the packed-decimal field swept over a spread of values.
 *   6. TEETH      — four broken twins, each caught AT A PLANE CELL.
 *
 * The painter itself is frozen on both sides, so what this file gates is the CHOICE of
 * the three arguments handed to it.
 *
 * HOLE: one captured machine, and it is the sibling's dispatch rather than this one's, so
 * the surrounding state is one this entry is never really called with. The run's position
 * and colour are constants that cannot be swept; the twins vary them instead.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0d61.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0d61 } from "../loc_0d61.js";
import { loc_0d61 as oracle } from "../../translated/loc_0d61.js";
import { loc_0d57 as sibling } from "../../translated/loc_0d57.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0d61;
const SIBLING = 0x0d57;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FIRST_CELL = 0xa501;
const FIELD_HIGH_END = 0xad38;
const FIELD_BYTES = 3;
const COLOUR = 0x10;
const PAINTER = 0x0d73;

const COLOUR_PLANE = 0xa000;
const CHARACTER_PLANE = 0xa400;
const PLANE_BYTES = 0x400;
const POISON = 0x5a;
/** Two packed-decimal fields that share no digit, so reading the wrong one shows. */
const MINE_DIGITS = [0x12, 0x34, 0x56];
const OTHER_DIGITS = [0x98, 0x76, 0x54];

let entry = null;

/** A real machine, taken at a live dispatch of the sibling entry. */
function entryState() {
  if (entry === null) {
    const ov = new Map([
      [SIBLING, (mm) => {
        if (entry === null) entry = mm.clone();
        return sibling(mm);
      }],
    ]);
    makeMachine(ov).runFrames(ENTRY_FRAMES);
    assert.notEqual(entry, null, `the sibling at 0x0d57 never dispatched in ${ENTRY_FRAMES}`);
  }
  return entry;
}

function poisoned() {
  const mm = entryState().clone();
  for (let a = COLOUR_PLANE; a < CHARACTER_PLANE + PLANE_BYTES; a++) mm.mem8[a] = POISON;
  for (let i = 0; i < FIELD_BYTES; i++) {
    mm.mem8[FIELD_HIGH_END - i] = MINE_DIGITS[i];
    mm.mem8[FIELD_HIGH_END - FIELD_BYTES - i] = OTHER_DIGITS[i];
  }
  return mm;
}

function poisonedDiff(candidate) {
  const a = poisoned();
  const b = poisoned();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Oracle vs candidate from the crafted entry, with the field loaded from `bytes`. */
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

const FIELD_CASES = [];
for (let hi = 0; hi < 256; hi += 17) FIELD_CASES.push([hi, (hi * 7) & 0xff, (hi * 13) & 0xff]);
FIELD_CASES.push([0, 0, 0], [0x99, 0x99, 0x99], [0xff, 0xff, 0xff], [0x0a, 0xbc, 0xde]);

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing. */
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
  regs.hl = FIELD_HIGH_END - FIELD_BYTES;
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

test("UNREACHED: the shared tape never dispatches this address", { skip }, () => {
  let hits = 0;
  let siblingHits = 0;
  const ov = new Map([
    [TARGET, (mm) => { hits++; return oracle(mm); }],
    [SIBLING, (mm) => { siblingHits++; return sibling(mm); }],
  ]);
  makeMachine(ov).runFrames(ENTRY_FRAMES);
  assert.ok(siblingHits > 0, "the counting hook is not wired: even the sibling shows no hits");
  assert.equal(hits, 0, "the tape DOES reach this entry now — capture it instead of crafting");
  console.log(`  UNREACHED: 0 dispatches in ${ENTRY_FRAMES} frames (sibling: ${siblingHits})`);
});

test("EQUAL on the crafted entry: loc_0d61 == oracle on RAM", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_0d61(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, `RAM diverged — ${show(d)}`);
  console.log("  EQUAL: RAM identical on a real machine taken at the sibling's dispatch");
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
  loc_0d61(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, [], "a register moved: the two arms no longer hand over identically");
  assert.equal(a.pc, b.pc, "both arms leave through the same painter, so pc agrees as well");
  console.log("  REGISTERS: whole register file and pc identical, not merely excluded");
});

test("PRIORS: the same run is painted for every field value tried", { skip }, () => {
  for (const bytes of FIELD_CASES) {
    const d = fieldDiff(loc_0d61, bytes);
    assert.equal(d, null, `field=${bytes.join(",")}: ${show(d)}`);
  }
  console.log(`  PRIORS: ${FIELD_CASES.length} field values identical`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT, at a plane cell`, { skip }, () => {
    const d = poisonedDiff(twin);
    assert.notEqual(d, null, `the comparison PASSED the ${label} twin — it has no teeth`);
    assert.ok(
      d.addr >= COLOUR_PLANE && d.addr < CHARACTER_PLANE + PLANE_BYTES,
      `the ${label} twin diverges first at ${hex4(d.addr)}, outside the two planes — the ` +
        "teeth would then rest on stack scratch rather than on anything painted",
    );
    console.log(`  TEETH/${label}: caught at a plane cell — ${show(d)}`);
  });
}

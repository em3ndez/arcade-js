// SPDX-License-Identifier: GPL-3.0-only
/**
 * eraseTextRunByIndex — memory-equivalent to the frozen oracle at ROM 0x0C39.
 *
 * GATE: strict unit-capture with ONE exclusion, a corpus replay of every dispatch of a driven
 *   session, and a crafted sweep of the run LENGTH, made by moving the terminating code along the
 *   run inside the program image. Holes stated:
 *
 *   1. EQUAL at the real dispatch — everything outside a two-byte dead scratch window below the
 *      entry stack pointer, where the frozen chain parks a resume address. Pinned by every arm.
 *   2. NOT VACUOUS — a candidate that does nothing is caught at the same dispatch, on a real cell.
 *   3. IT REALLY BLANKS — the frozen routine is shown to write the blanking byte into a run of
 *      cells and to leave the other plane alone, so the twins below have something to break.
 *   4. RUN LENGTH — the terminating code is moved along the run, giving lengths from empty up to
 *      the natural one, each poked identically on both sides. This is the only arm that reaches
 *      the empty run, which no real dispatch produces.
 *   5. RECORD NUMBER — every number the table can be indexed by is swept, so a rewrite that read
 *      the wrong table entry, or the right entry through the wrong scaling, is caught. Numbers
 *      whose record names a destination outside the character plane are skipped and COUNTED:
 *      running them would be measuring the memory map rather than the routine.
 *   6. CORPUS — every dispatch of a driven session, on a clone taken at the dispatch.
 *   7. TEETH — six twins, each caught on its own exact count.
 *
 * HOLE: the captured dispatch always presents the same record, which the corpus arm reports; the
 * record sweep is what covers the rest, and it is crafted rather than natural.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0c39.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { eraseTextRunByIndex } from "../eraseTextRunByIndex.js";
import { loc_0c39 as oracle } from "../../translated/loc_0c39.js";
import { advanceCharCursor } from "../advanceCharCursor.js";
import { fetchWideTableWord } from "../fetchWideTableWord.js";
import { u16 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0c39;

const RECORD_TABLE = 0x0c50;
const RUN_STARTS_AT = 3;
const END_OF_TEXT = 185;
const BLANK = 241;
const CHARACTER_PLANE = 0xa400;
const CHARACTER_PLANE_END = 0xa7ff;

const SCRATCH_BYTES = 2;

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 4;

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
let realRecords = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const records = new Set();
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    records.add(mm.regs.a);
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  realRecords = records;
  return { dispatches, caught };
}

function entryState() {
  if (captured === null) replay(eraseTextRunByIndex);
  return captured;
}

/** The record this entry is really handed, and where its run of glyphs starts. */
function realRecord() {
  const entry = entryState();
  const record = entry.mem16[RECORD_TABLE + 2 * entry.regs.a];
  return { record, runStart: u16(record + RUN_STARTS_AT) };
}

/** Run `body` with one byte of the program image forced, then put it back. */
function withPokedImage(m, addr, value, body) {
  const image = m.mem.rom;
  const was = image[addr];
  image[addr] = value;
  try {
    return body();
  } finally {
    image[addr] = was;
  }
}

/** The natural length of the record's run: how many glyphs before the terminating code. */
function naturalLength() {
  const { runStart } = realRecord();
  const image = entryState().mem.rom;
  let n = 0;
  while (image[runStart + n] !== END_OF_TEXT) n++;
  return n;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the scratch window", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  eraseTextRunByIndex(b);
  assert.deepEqual(
    outsideScratch(a, b, sp),
    [],
    `a divergence escaped the scratch window — ${show(outsideScratch(a, b, sp)[0])}`,
  );
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    ["a", "f", "h", "l", "sp"],
    "the excluded set changed shape: the caller reloads all of these before reading anything",
  );
  console.log(
    `  EQUAL: record number ${entry.regs.a}, run at ${hex4(realRecord().runStart)}, sp ${hex4(sp)}`,
  );
});

test("NOT VACUOUS: a candidate that does nothing is caught on a real cell", { skip }, () => {
  const d = compare(() => {}, entryState());
  assert.notEqual(d, null, "the masked diff passed a no-op, so memory is NOT the gate here");
  assert.ok(
    d.addr >= CHARACTER_PLANE && d.addr <= CHARACTER_PLANE_END,
    `the no-op is caught at ${hex4(d.addr)}, which is not in the plane this entry writes`,
  );
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("IT REALLY BLANKS: a run of cells takes the blanking byte and nothing else moves", { skip }, () => {
  const before = entryState().clone();
  const after = before.clone();
  oracle(after);
  const moved = allDiffs(before, after).filter((d) => d.addr < before.regs.sp - SCRATCH_BYTES ||
    d.addr >= before.regs.sp);
  assert.ok(moved.length > 0, "the frozen routine wrote nothing, so every twin below is untested");
  for (const d of moved) {
    assert.ok(
      d.addr >= CHARACTER_PLANE && d.addr <= CHARACTER_PLANE_END,
      `it wrote outside the character plane, at ${hex4(d.addr)}`,
    );
    assert.equal(d.b, BLANK, `it wrote ${d.b} rather than the blanking byte at ${hex4(d.addr)}`);
  }
  assert.equal(moved.length, naturalLength(), "the number of cells blanked is not the run length");
  console.log(
    `  BLANKS: ${moved.length} cells set to ${BLANK}, from ${hex4(moved[0].addr)}; nothing else moved`,
  );
});

test("RUN LENGTH: the terminating code moved along the run, empty run included", { skip }, () => {
  const { runStart } = realRecord();
  const natural = naturalLength();
  for (let length = 0; length <= natural; length++) {
    withPokedImage(entryState(), runStart + length, END_OF_TEXT, () => {
      const d = compare(eraseTextRunByIndex, entryState());
      assert.equal(d, null, `run length ${length}: ${show(d)}`);
      const m = entryState().clone();
      const was = m.clone();
      oracle(m);
      const moved = allDiffs(was, m).filter(
        (x) => x.addr >= CHARACTER_PLANE && x.addr <= CHARACTER_PLANE_END,
      );
      assert.equal(moved.length, length, `run length ${length} blanked ${moved.length} cells`);
    });
  }
  console.log(`  RUN LENGTH: lengths 0..${natural} identical, and each blanks exactly that many`);
});

test("RECORD NUMBER: every entry of the table whose record lies in work RAM", { skip }, () => {
  const entry = entryState();
  let swept = 0;
  let skipped = 0;
  for (let number = 0; number < 256; number++) {
    const record = entry.mem16[RECORD_TABLE + 2 * number];
    const destination = entry.mem16[record];
    if (destination < CHARACTER_PLANE || destination > CHARACTER_PLANE_END) {
      skipped++;
      continue;
    }
    const machine = entry.clone();
    machine.regs.a = number;
    const d = compare(eraseTextRunByIndex, machine);
    assert.equal(d, null, `record number ${number}: ${show(d)}`);
    swept++;
  }
  assert.ok(swept > 1, "only one record number was sweepable, so this arm discriminates nothing");
  console.log(`  RECORD NUMBER: ${swept} records swept, ${skipped} skipped as out of the plane`);
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(eraseTextRunByIndex);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  console.log(
    `  CORPUS: ${r.dispatches} dispatches identical; record numbers ${[...realRecords].join(",")}`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: writes the glyph it read instead of the blanking byte. */
function brokenWritesTheGlyph(m, recordNumber = m.regs.a) {
  const { mem8, mem16, regs } = m;
  regs.hl = RECORD_TABLE;
  regs.a = recordNumber;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  while (mem8[next] !== END_OF_TEXT) {
    mem8[regs.de] = mem8[next];
    next = u16(next + 1);
    advanceCharCursor(m);
  }
}

/** BUG: the run is taken to start at the colour byte, so it is one cell too long. */
function brokenIncludesTheColourByte(m, recordNumber = m.regs.a) {
  const { mem8, mem16, regs } = m;
  regs.hl = RECORD_TABLE;
  regs.a = recordNumber;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = mem16[record];
  let next = u16(record + RUN_STARTS_AT - 1);
  while (mem8[next] !== END_OF_TEXT) {
    mem8[regs.de] = BLANK;
    next = u16(next + 1);
    advanceCharCursor(m);
  }
}

/** BUG: the cursor never moves, so the whole run lands on one cell. */
function brokenCursorStuck(m, recordNumber = m.regs.a) {
  const { mem8, mem16, regs } = m;
  regs.hl = RECORD_TABLE;
  regs.a = recordNumber;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  while (mem8[next] !== END_OF_TEXT) {
    mem8[regs.de] = BLANK;
    next = u16(next + 1);
  }
}

/** BUG: the cursor steps the other way along the line. */
function brokenCursorBackwards(m, recordNumber = m.regs.a) {
  const { mem8, mem16, regs } = m;
  regs.hl = RECORD_TABLE;
  regs.a = recordNumber;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  while (mem8[next] !== END_OF_TEXT) {
    mem8[regs.de] = BLANK;
    next = u16(next + 1);
    regs.de = u16(regs.de + 32);
  }
}

/** BUG: the terminating code is written too, so the run is one cell too long. */
function brokenBlanksTheTerminator(m, recordNumber = m.regs.a) {
  const { mem8, mem16, regs } = m;
  regs.hl = RECORD_TABLE;
  regs.a = recordNumber;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  for (;;) {
    const done = mem8[next] === END_OF_TEXT;
    mem8[regs.de] = BLANK;
    next = u16(next + 1);
    advanceCharCursor(m);
    if (done) break;
  }
}

const TWINS = [
  ["no-op", () => {}, 5],
  ["writes-the-glyph", brokenWritesTheGlyph, 5],
  ["includes-the-colour-byte", brokenIncludesTheColourByte, 4],
  ["cursor-stuck", brokenCursorStuck, 4],
  ["cursor-backwards", brokenCursorBackwards, 4],
  ["blanks-the-terminator", brokenBlanksTheTerminator, 4],
];

/** Every state a twin is judged on: the real entry, and the run-length pokes over it. */
function twinCaught(candidate) {
  const { runStart } = realRecord();
  const natural = naturalLength();
  let caught = 0;
  if (compare(candidate, entryState())) caught++;
  for (let length = 0; length <= natural; length++) {
    withPokedImage(entryState(), runStart + length, END_OF_TEXT, () => {
      if (compare(candidate, entryState())) caught++;
    });
  }
  return caught;
}

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip }, () => {
    assert.equal(twinCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} judged states`);
  });
}

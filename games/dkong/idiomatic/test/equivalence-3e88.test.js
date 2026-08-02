// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3e88 (ROM 0x3E88) — vector to the current board's
 * collision-search arm through the inline `rst 0x28` table at 0x3E8D, handing the
 * caller's bounds word across the dispatch.
 *
 * loc_3e88's table is reached ONLY from the still-untranslated 0x286B caller, never on
 * the live NMI / sub-state / guard dispatch paths, so it is NEVER dispatched during
 * attract — there are no real captured dispatches. All coverage is therefore CRAFTED on
 * a real attract-base machine (so work RAM is self-consistent), poking BOARD (0x6227) to
 * pick the arm and staging the stack the way the caller does:
 *
 *   1. SWEEP (crafted, exhaustive) — poke BOARD 0..255 and route the computed arm to an
 *      IDENTICAL catch-all stub on both sides (m.overrides duck-typed to a catch-all, so
 *      the arm never runs). Compare the handoff the stub sees (A, HL = target, DE, SP) +
 *      the propagated return. This pins that loc_3e88 reads BOARD as the selector and
 *      hands 0x3E8D to the trampoline as the table base, for every board value.
 *
 *   2. REAL ARM (crafted) — run the board-1..4 arms FOR REAL through the frozen oracle
 *      targets (entry_3e99 / sub_28b0 / sub_28e0 / sub_2901), diffing RAM(−stack) + pc +
 *      SP + return. Board 1 is also run with a hand-activated overlap object so the
 *      search actually COUNTS (0x6060 becomes a live cell whose value tracks the L byte
 *      of the handed-off bounds) — proving the bounds word genuinely reaches the arm.
 *
 *   3. NULL GUARD (crafted) — boards 0 and 5 index the two 0x0000 reset-vector guards;
 *      the generic dispatcher surfaces target 0x0000 as a NotImplemented throw. Assert
 *      BOTH sides throw the identical message.
 *
 *   4. TEETH — three deliberately-broken twins, each MUST be caught:
 *      (a) dropped-bounds (omits the HL push) — the arm pops the wrong word; caught on
 *          the real board-1 arm (0x6060 and SP diverge).
 *      (b) wrong-selector (reads LIVES 0x6228 instead of BOARD) — caught by the sweep.
 *      (c) wrong-table-base (hands 0x3E8F instead of 0x3E8D) — caught by the sweep.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3e88.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3e88 as oracle } from "../../translated/loc_3e88.js";
import { dispatchBoardOverlapSearch } from "../dispatchBoardOverlapSearch.js"; // promoted from loc_3e88
import { dispatchInlineJumpTable } from "../dispatchInlineJumpTable.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, BOARD, OVERLAP_COUNT } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TABLE_BASE = 0x3e8d;              // loc_3e88's inline rst-0x28 table base (ROM data)
const SITE = "0x3E8D (loc_3e88 dispatch)"; // dispatch-site label (only surfaces in a throw)
const RET = 0x286e;                     // a plausible caller return (the arm's ret lands here)
const LIVES = 0x6228;                   // used only to build the wrong-selector twin
// OVERLAP_COUNT (0x6060) imported from ram.js — the collision counter entry_3e99/entry_3ec3 write.
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

// First differing RAM byte between two machines, EXCLUDING the dead stack scratch
// (the memory-equivalence contract is RAM − STACK_SCRATCH). { addr, a, b } | null.
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

// A real, self-consistent machine: boot + a stretch of attract. loc_3e88's arm is never
// reached here; every case is crafted by poking. clone() neutralises the frame machinery
// (nextNmi/nextBoundary = Infinity) so no stray NMI can masquerade as a side effect.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// Stage a crafted dispatch on a clone: a stack carrying a plausible caller return (so the
// arm's final ret has a sane target), the caller's bounds word in HL, and the board type.
function craft(base, { board, hl = 0x8899 }) {
  const m = base.clone();
  m.regs.sp = 0x6bfe;
  m.push16(RET);
  m.regs.hl = hl & 0xffff;
  m.mem.write8(BOARD, board & 0xff);
  return m;
}

// craft(), plus activate object 0 of the 0x6700 search group so entry_3ec3 actually
// counts an overlap: place it so axis-2 always overlaps and axis-1 overlaps only when
// the L byte of the handed-off bounds is >= 0x14 — making 0x6060 a live witness that the
// bounds word reached the arm. Grounded empirically against the frozen oracle.
function craftActive(base, opts) {
  const m = craft(base, opts);
  m.mem.write8(0x6700 + 0x00, 0x01);                                   // active flag (bit0)
  m.mem.write8(0x6700 + 0x05, (m.regs.c + 20) & 0xff);                 // |C - (ix+5)| = 20
  m.mem.write8(0x6700 + 0x0a, 0x02);                                   // axis-1 span
  m.mem.write8(0x6700 + 0x03, m.mem.read8((m.regs.iy + 3) & 0xffff));  // axis-2 diff = 0
  m.mem.write8(0x6700 + 0x09, 0x02);                                   // axis-2 span
  for (let i = 1; i < 10; i++) m.mem.write8((0x6700 + i * 0x20) & 0xffff, 0x00); // rest inactive
  for (let i = 0; i < 5; i++) m.mem.write8((0x6400 + i * 0x20) & 0xffff, 0x00);
  return m;
}

// Run a routine on a fresh clone; capture a throw instead of letting it escape.
function runOutcome(entry, fn) {
  const c = entry.clone();
  try {
    const ret = fn(c);
    return { c, ret, threw: null };
  } catch (e) {
    return { c: null, ret: undefined, threw: `${e.constructor.name}: ${e.message}` };
  }
}

// Full contract comparison oracle-vs-candidate on one crafted entry: throw-parity, then
// RAM(−stack) + pc + SP + return + the arm's result registers A and IX (the collision
// code / record pointer the untranslated 0x286B caller reads back — the same live-out its
// exact sibling dispatchBoardCollision declares). Returns a list of diffs ([] == equal).
function contractDiffs(entry, fn) {
  const o = runOutcome(entry, oracle);
  const c = runOutcome(entry, fn);
  const diffs = [];
  if (o.threw || c.threw) {
    if (o.threw !== c.threw) diffs.push(`throw oracle=${o.threw} cand=${c.threw}`);
    return diffs;
  }
  const ram = firstRamDiff(o.c, c.c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.c.pc !== c.c.pc) diffs.push(`pc oracle=${hx(o.c.pc)} cand=${hx(c.c.pc)}`);
  if (o.c.regs.sp !== c.c.regs.sp) diffs.push(`SP oracle=${hx(o.c.regs.sp)} cand=${hx(c.c.regs.sp)}`);
  if (o.c.regs.a !== c.c.regs.a) diffs.push(`A oracle=${hx(o.c.regs.a)} cand=${hx(c.c.regs.a)}`);
  if (o.c.regs.ix !== c.c.regs.ix) diffs.push(`IX oracle=${hx(o.c.regs.ix)} cand=${hx(c.c.regs.ix)}`);
  if (o.ret !== c.ret) diffs.push(`return oracle=${o.ret} cand=${c.ret}`);
  return diffs;
}

// A catch-all override object (duck-typed like the Machine's overrides Map) routing ANY
// computed arm to `stub`, so the arm never runs and we can read the handoff loc_3e88
// formed. Records A, HL(=target), DE, SP and returns a sentinel so the propagated return
// is also checked. dispatchGameState consults m.overrides before any real target.
function stubOverrides(rec) {
  const SENTINEL = 0x5a;
  return {
    has: () => true,
    get: () => (mm) => {
      rec.push({ a: mm.regs.a, hl: mm.regs.hl, de: mm.regs.de, sp: mm.regs.sp });
      return SENTINEL;
    },
  };
}

// Sweep BOARD 0..255 with the stub in place; return the first board whose oracle handoff
// differs from `fn`'s (or null if identical across all 256).
function sweepFirstMismatch(base, fn) {
  for (let board = 0; board < 256; board++) {
    const entry = craft(base, { board });
    const mA = entry.clone(), mB = entry.clone();
    const recA = [], recB = [];
    mA.overrides = stubOverrides(recA);
    mB.overrides = stubOverrides(recB);
    const rA = oracle(mA);
    const rB = fn(mB);
    if (recA.length !== 1 || recB.length !== 1)
      return { board, why: `dispatch fired ${recA.length}/${recB.length} (want 1/1)` };
    const A = recA[0], B = recB[0];
    if (A.a !== B.a) return { board, why: `A ${hx(A.a)}/${hx(B.a)}` };
    if (A.hl !== B.hl) return { board, why: `target ${hx(A.hl)}/${hx(B.hl)}` };
    if (A.de !== B.de) return { board, why: `DE ${hx(A.de)}/${hx(B.de)}` };
    if (A.sp !== B.sp) return { board, why: `SP ${hx(A.sp)}/${hx(B.sp)}` };
    if (rA !== rB) return { board, why: `return ${rA}/${rB}` };
  }
  return null;
}

// -- 1. SWEEP (crafted, exhaustive) -------------------------------------------

test("SWEEP: loc_3e88 == oracle over all 256 board selectors (dispatch handoff)", () => {
  const base = attractBase();
  const mismatch = sweepFirstMismatch(base, dispatchBoardOverlapSearch);
  assert.equal(
    mismatch,
    null,
    mismatch && `mismatch at board=${hx(mismatch.board)}: ${mismatch.why}`,
  );
  console.log("  SWEEP: 256 board selectors — target/A/DE/SP/return identical to the oracle");
});

// -- 2. REAL ARM (crafted) ----------------------------------------------------

test("REAL ARM: the board-1..4 arms run for real and reproduce the oracle", () => {
  const base = attractBase();

  // Boards 1..4 on a plain attract base — full chain through the frozen oracle target.
  for (const board of [1, 2, 3, 4]) {
    const entry = craft(base, { board, hl: 0x8899 });
    const diffs = contractDiffs(entry, dispatchBoardOverlapSearch);
    assert.equal(diffs.length, 0, `board ${board}: ${diffs.join("; ")}`);
  }

  // Board 1 with an active overlap object: the arm counts, and the count tracks the L
  // byte of the handed-off bounds. Both bounds that count (L=0xff) and that don't (L=0x00)
  // must reproduce the oracle exactly.
  for (const hl of [0x00ff, 0x0000]) {
    const entry = craftActive(base, { board: 1, hl });
    const diffs = contractDiffs(entry, dispatchBoardOverlapSearch);
    assert.equal(diffs.length, 0, `active board 1 hl=${hx(hl)}: ${diffs.join("; ")}`);
    // Confirm the arm really counted (or not) as expected — the hand-off is live, not dead.
    const after = runOutcome(entry, oracle).c;
    assert.equal(
      after.mem.read8(OVERLAP_COUNT),
      (hl & 0xff) >= 0x14 ? 1 : 0,
      `active board 1 hl=${hx(hl)}: overlap count did not track the bounds L byte`,
    );
  }
  console.log("  REAL ARM: boards 1-4 (incl. active-object board 1, counting=1 and 0) identical to the oracle");
});

// -- 3. NULL GUARD (crafted) --------------------------------------------------

test("NULL GUARD: boards 0 and 5 hit the 0x0000 guards and BOTH throw identically", () => {
  const base = attractBase();
  for (const board of [0, 5]) {
    const entry = craft(base, { board });
    const o = runOutcome(entry, oracle);
    const c = runOutcome(entry, dispatchBoardOverlapSearch);
    assert.ok(o.threw, `board ${board}: oracle should throw on the 0x0000 guard`);
    assert.equal(c.threw, o.threw, `board ${board}: candidate throw differs from oracle`);
  }
  console.log("  NULL GUARD: boards 0/5 both throw NotImplemented(0x0000) with identical text");
});

// -- 4. TEETH -----------------------------------------------------------------

// (a) dropped-bounds: omit the HL push — the arm pops the wrong word off the stack.
function twinDropBounds(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(BOARD);
  m.push16(TABLE_BASE); // BUG: forgot to push the caller's bounds word first
  return dispatchInlineJumpTable(m, SITE);
}

// (b) wrong-selector: read LIVES (0x6228) instead of BOARD (0x6227).
function twinWrongSelector(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(LIVES); // BUG: wrong selector cell
  m.push16(regs.hl);
  m.push16(TABLE_BASE);
  return dispatchInlineJumpTable(m, SITE);
}

// (c) wrong-table-base: hand 0x3E8F instead of 0x3E8D.
function twinWrongTableBase(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(BOARD);
  m.push16(regs.hl);
  m.push16((TABLE_BASE + 2) & 0xffff); // BUG: table base off by one word
  return dispatchInlineJumpTable(m, SITE);
}

test("TEETH: the dropped-bounds, wrong-selector and wrong-table-base twins are all CAUGHT", () => {
  const base = attractBase();

  // (a) dropped-bounds on the active board-1 arm: bounds L=0x00 => oracle counts 0, but the
  // twin pops the caller-return (L=0x6e) => counts 1, and its stack ends misaligned. Caught.
  const dropEntry = craftActive(base, { board: 1, hl: 0x0000 });
  const dropDiffs = contractDiffs(dropEntry, twinDropBounds);
  assert.ok(dropDiffs.length > 0, "dropped-bounds twin escaped — the gate is worthless");

  // (b) wrong-selector: caught by the sweep (BOARD and LIVES disagree at most boards).
  const selMismatch = sweepFirstMismatch(base, twinWrongSelector);
  assert.notEqual(selMismatch, null, "wrong-selector twin escaped the sweep — the gate is worthless");

  // (c) wrong-table-base: caught by the sweep (reads targets from the wrong ROM words).
  const baseMismatch = sweepFirstMismatch(base, twinWrongTableBase);
  assert.notEqual(baseMismatch, null, "wrong-table-base twin escaped the sweep — the gate is worthless");

  console.log(
    `  TEETH: dropped-bounds caught (${dropDiffs[0]}); ` +
      `wrong-selector caught at board=${hx(selMismatch.board)}; ` +
      `wrong-table-base caught at board=${hx(baseMismatch.board)}`,
  );
});

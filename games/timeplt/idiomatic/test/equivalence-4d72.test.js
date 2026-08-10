// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawEmblemStripThenGuardImage — memory-equivalent to the frozen oracle at ROM 0x4D72.
 * GATE: unit-capture on the real coin-start dispatches plus crafted path entries; RAM compared with
 *   the dead stack scratch below the seated pointer masked out (the oracle brackets its two dissolved
 *   calls with return-address pushes the rewrite does not), the two-byte SP re-seat and the return
 *   value checked, and teeth. Registers are not compared: the dissolved callees do not reproduce the
 *   register dance and the ring handler that dispatches this address consumes none. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-4d72.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { drawEmblemStripThenGuardImage as candidate } from "../drawEmblemStripThenGuardImage.js";
import { loc_4d72 as oracle } from "../../translated/loc_4d72.js";
import { loc_4daf } from "../loc_4daf.js";
import { paintGlyphOverBlankInColourThenStepCursor } from "../paintGlyphOverBlankInColourThenStepCursor.js";
import { u8 } from "../../../../core/int.js";

const TARGET = 0x4d72;
const ENABLE = 0xad30;
const CURSOR_START = 0xa783;
const ROW_FLOOR = 0xa623;
const MAX_EMBLEMS = 6;
const EMBLEM_BASE = 9;
const EMBLEM_COLOUR = 24;
const BLANK_GLYPH = 241;
const BLANK_COLOUR = 16;
const CHECK_START = 0x0711;
const CHECK_LEN = 256;
const CHECK_BIAS = 25;

// Every write this routine makes lands at or below here; the stack seats far above it, so the
// scratch mask can never hide a game-data divergence. Asserted against the measured floor.
const DATA_TOP = 0xadff;
const CORPUS_FRAMES = 2000;
const COINSTART_DISPATCHES = 3;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ────────────────────────────────────────────────────────────────
/**
 * Oracle vs a candidate on independent clones. The oracle pushes return addresses below the seated
 * pointer for its two internal calls, and the rewrite direct-calls their idiomatic twins and writes
 * none, so the diff excludes [low, seat) with low measured by watching the oracle's own pushes.
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
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

/** Cells at or below the data top the oracle moves from a state — a path's footprint. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

// ── the captured entry and the crafted path entries ──────────────────────────────────────
let entry = null;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

/** The captured dispatch draws a couple of emblems; the other paths are poked from it. */
function craft(count, enable) {
  const m = entryState().clone();
  m.regs.a = count;
  m.mem8[ENABLE] = enable;
  return m;
}
function scenarios() {
  return [
    ["captured", entryState().clone()],
    ["early", craft(3, 0)],
    ["zero", craft(0, 1)],
    ["mid", craft(3, 1)],
    ["full", craft(6, 1)],
    ["clamp", craft(9, 1)],
  ];
}

// ── the twins ────────────────────────────────────────────────────────────────────────────
/** The rewrite with one decision changed; every knob matches drawEmblemStripThenGuardImage by default. */
function variant({ enable = true, clamp = true, base = EMBLEM_BASE, colour = EMBLEM_COLOUR,
  blankGlyph = BLANK_GLYPH, blankColour = BLANK_COLOUR, blank = true, extra = 0 } = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    const count = regs.a;
    if (enable && mem8[ENABLE] === 0) return;
    regs.de = CURSOR_START;
    let emblems = u8((clamp && count > MAX_EMBLEMS ? MAX_EMBLEMS : count) + extra);
    if (emblems !== 0) {
      regs.b = base;
      regs.c = colour;
      for (; emblems !== 0; emblems--) loc_4daf(m);
    }
    regs.b = blankGlyph;
    regs.c = blankColour;
    if (blank) while (regs.de >= ROW_FLOOR) paintGlyphOverBlankInColourThenStepCursor(m);
    let check = 0;
    for (let i = 0; i < CHECK_LEN; i++) check ^= mem8[CHECK_START + i];
    if (u8(check + CHECK_BIAS) !== 0) throw new Error("altered");
  };
}

const TWINS = [
  ["no-op", () => {}, 4],
  ["no-enable-check", variant({ enable: false }), 1],
  ["no-clamp", variant({ clamp: false }), 1],
  ["wrong-emblem-base", variant({ base: EMBLEM_BASE + 1 }), 4],
  ["wrong-blank-glyph", variant({ blankGlyph: BLANK_GLYPH + 1 }), 3],
  ["extra-emblem", variant({ extra: 1 }), 5],
];

// ── the gate ─────────────────────────────────────────────────────────────────────────────
test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, entryState());
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  // ★ The mask is safe only if it never covers a data cell: prove its floor sits above them all.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("PATHS: every path is memory-equivalent, and the paths really differ", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[label] = footprint(m);
  }
  // ★ Vacuity guard: an enabled path draws where the disabled one does nothing.
  assert.equal(prints.early, 0, "the disabled path moved cells");
  assert.ok(prints.mid > 0 && prints.full !== prints.mid, "the emblem paths move the same cells");
  console.log(`  PATHS: 6 paths equivalent; footprints ${JSON.stringify(prints)}`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops its return address and the rewrite does not`);
    assert.equal(r.retOracle, r.retCand, `${label}: the return value diverged`);
  }
  console.log("  SP: +2 on every path; return values identical");
});

test("CORPUS: every coin-start dispatch replays identically; attract never reaches it", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0;
    let caught = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (compare(candidate, mm).escaped) caught++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, caught };
  };
  const coinStart = run({});
  const attract = run({ tape: [] });
  assert.equal(coinStart.dispatched, COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(coinStart.caught, 0, `the rewrite diverged on ${coinStart.caught} dispatches`);
  // ★ Attract reaching zero is a fact, not an untested tap: the SAME probe counted three coin-started.
  assert.equal(attract.dispatched, 0, "attract now reaches this handler; add a corpus for it");
  console.log(`  CORPUS: ${coinStart.dispatched} coin-start dispatches identical, attract ${attract.dispatched}`);
});

test("ROM INTEGRITY: the guarded span resolves to zero on the real image", { skip }, () => {
  const m = entryState().clone();
  let check = 0;
  for (let i = 0; i < CHECK_LEN; i++) check ^= m.mem8[CHECK_START + i];
  assert.equal(u8(check + CHECK_BIAS), 0, "the real ROM fails the guard, so the rewrite would throw");
  assert.doesNotThrow(() => candidate(entryState().clone()), "the rewrite threw on a valid image");
  console.log(`  ROM INTEGRITY: xor ${check} + ${CHECK_BIAS} wraps to 0; the throw is unreachable here`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of paths`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(twin, m).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} paths`);
  });
}

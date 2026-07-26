// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for classifyWallCollision (ROM 0x03e8, The Pit) — the
 * per-frame maze-wall collision classifier that writes the 4-way blocked-direction
 * bitmask (DIG_DIRS, 0x801b).
 *
 * WHAT THIS ROUTINE NEEDS FROM THE GATE, and how it is met:
 *
 *   1. REAL dispatches for the housekeeping arms. The main loop runs 0x03e8 only
 *      while the game-mode byte is 4 — which the attract demo does enter — so real
 *      captured entries are available. The very first one (frame 1 of the demo)
 *      is rich: it repaints the panel (loc_4894), reloads the 30-frame timer, and
 *      recolours a column (loc_48c4) before the probe-absent early return. Later
 *      entries exercise the timer countdown + early return. EQUAL is proven on all.
 *
 *   2. CRAFTED entries for the classification chain. Attract's demo never presents a
 *      live probe object (0x8079 stays 0), so the whole band-scan is unreached in the
 *      wild. A real entry is nudged into the classify path (skip the painter, hold the
 *      timer off its 30-frame tick, mark the probe live) and then swept: the probe
 *      X/Y across every wall-line value and the band hint across every band, so every
 *      band, wall line, and half-plane split is driven on both sides.
 *
 *   3. Its callees (loc_4894, loc_48c4) are already idiomatic and are imported and
 *      called directly by the routine; both still tail into the frozen colour filler
 *      through the return stack, so the routine brackets each with the filler's return
 *      address. The oracle reaches the same two routines through the registry, so both
 *      sides run identical callee code — the gate tests 0x03e8's own logic and routing.
 *
 * CONTRACT. The honest live-out is MEMORY-ONLY (the mask, band hint, timer, and the
 * cells the painters write); the residual register file is dead (the caller overwrites
 * it immediately), so the idiomatic routine drops it and the gate compares RAM (the
 * whole dump, stack included) + exit pc + SP — NOT the register file. Teeth twins (a
 * swapped wall facing, a wrong band-hint stamp, a skipped recolour, a corrupted mask)
 * are all caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-03e8.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_03e8 as oracle } from "../../translated/loc_03e8.js";
import { classifyWallCollision as idiomatic } from "../classifyWallCollision.js";
import { loc_4894 as idiomaticPainter } from "../loc_4894.js";
import { loc_48c4 as idiomaticRecolour } from "../loc_48c4.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x03e8;
// Work-RAM cells this routine reads / writes.
const FRAME_COUNTER = 0x8010; // wraps to 0 -> repaint the panel
const WALL_TIMER = 0x800b;    // 30-frame countdown
const BAND_HINT = 0x800c;     // cached maze band index
const PROBE_GATE = 0x8079;    // nonzero -> classify this frame
const TICK_BUSY = 0x807c;     // nonzero on a tick frame -> skip classification
const SPAWN_PHASE = 0x807b;   // 0 on a tick frame -> recolour a column (loc_48c4)
const OBJ_X = 0x8068;
const OBJ_Y = 0x806b;
const DIG_DIRS = 0x801b;      // the 4-way blocked-direction mask this routine produces
const FILL_LEN = 0x8055;      // loc_48c4's first write (column length 9); where a skipped-recolour twin shows up
const CAPTURE_FRAMES = 720;   // the demo runs 0x03e8 within this window
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture real machine states at 0x03e8's genuine demo dispatches. The hook clones
 * each pristine entry (up to `limit`), then runs the oracle so the host run continues.
 */
function captureRealEntries(limit) {
  const entries = [];
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entries.length < limit) entries.push(mm.clone());
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entries;
}

const ENTRIES = ROM_PRESENT ? captureRealEntries(40) : [];

/**
 * Run the oracle and a candidate on two independent clones of one entry and diff the
 * honest contract: whole-RAM (stack included) + exit pc + SP. Registers are the dead
 * live-out here and are deliberately excluded.
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    sp: a.regs.sp === b.regs.sp ? null : { a: a.regs.sp, b: b.regs.sp },
  };
}

function assertEqual(entry, candidate, label) {
  const r = runPair(entry, candidate);
  assert.equal(r.ram, null, r.ram && `${label}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && `${label}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  assert.equal(r.sp, null, r.sp && `${label}: SP diverged (oracle=${hx(r.sp?.a)} idiomatic=${hx(r.sp?.b)})`);
}

// Build a crafted entry that forces the classification path without any subroutine
// call: FRAME_COUNTER != 0 (no panel repaint), the timer held off its 30-frame tick
// (dec leaves it nonzero, so no reload / recolour), and the probe marked live.
function classifyBase(bVal, cVal, hint) {
  const e = ENTRIES[0].clone();
  e.mem.write8(FRAME_COUNTER, 1);
  e.mem.write8(WALL_TIMER, 5);
  e.mem.write8(PROBE_GATE, 1);
  e.mem.write8(TICK_BUSY, 0);
  e.mem.write8(BAND_HINT, hint);
  e.mem.write8(OBJ_X, (bVal - 3 + 256) % 256); // probe X so OBJ_X + 3 == bVal
  e.mem.write8(OBJ_Y, (cVal - 5 + 256) % 256); // probe Y so OBJ_Y + 5 == cVal
  return e;
}

// -- 1. EQUAL: the real captured demo dispatches ------------------------------

test("EQUAL (captured): idiomatic == oracle on every real demo dispatch", () => {
  assert.ok(ENTRIES.length > 0, "captured at least one real 0x03e8 demo dispatch");
  for (let i = 0; i < ENTRIES.length; i++) assertEqual(ENTRIES[i], idiomatic, `entry#${i}`);
  console.log(`  EQUAL/captured: ${ENTRIES.length} real demo entries identical (RAM + pc + SP)`);
});

test("EQUAL (captured): the first entry really exercises the painter + recolour arms", () => {
  // Sanity that the rich arms are genuinely covered above (not vacuously all-early-return).
  const e = ENTRIES[0];
  assert.equal(e.mem.read8(FRAME_COUNTER), 0, "first demo entry repaints the panel (loc_4894)");
  assert.equal(e.mem.read8(WALL_TIMER), 1, "first demo entry hits the 30-frame tick");
  assert.equal(e.mem.read8(TICK_BUSY), 0, "first demo entry is not busy -> reaches the recolour");
  assert.equal(e.mem.read8(SPAWN_PHASE), 0, "first demo entry recolours a column (loc_48c4)");
  console.log("  EQUAL/captured: entry#0 covers the panel-repaint + timer-reload + recolour arms");
});

// -- 2. EQUAL: crafted preamble arms attract's demo does not reach -------------

test("EQUAL (crafted): the busy-tick arm returns without classifying", () => {
  // Timer hits its 30-frame tick AND the busy flag is set -> reload timer, then return
  // with no classification (DIG_DIRS untouched).
  const e = ENTRIES[0].clone();
  e.mem.write8(FRAME_COUNTER, 1); // skip the painter to isolate this arm
  e.mem.write8(WALL_TIMER, 1);    // dec -> 0 -> tick
  e.mem.write8(TICK_BUSY, 0x5a);  // busy -> early return before classify
  assertEqual(e, idiomatic, "busy-tick");
  console.log("  EQUAL/crafted: busy-tick reload-then-return arm identical");
});

test("EQUAL (crafted): the tick recolour arm (loc_48c4) with the painter skipped", () => {
  const e = ENTRIES[0].clone();
  e.mem.write8(FRAME_COUNTER, 1); // skip the painter
  e.mem.write8(WALL_TIMER, 1);    // dec -> 0 -> tick
  e.mem.write8(TICK_BUSY, 0);     // not busy
  e.mem.write8(SPAWN_PHASE, 0);   // -> recolour a column
  e.mem.write8(PROBE_GATE, 0);    // then early-return (no live probe)
  assertEqual(e, idiomatic, "tick-recolour");
  console.log("  EQUAL/crafted: tick recolour (loc_48c4) arm identical");
});

test("EQUAL (crafted): the painter arm alone (frame counter at zero)", () => {
  const e = ENTRIES[0].clone();
  e.mem.write8(FRAME_COUNTER, 0); // -> repaint the panel (loc_4894)
  e.mem.write8(WALL_TIMER, 5);    // dec -> 4, no tick, straight to the probe gate
  e.mem.write8(PROBE_GATE, 0);    // early return
  assertEqual(e, idiomatic, "painter-only");
  console.log("  EQUAL/crafted: panel-repaint (loc_4894) arm identical");
});

// -- 3. EQUAL: sweep the classification chain over every band + wall line ------

// Every X/Y wall-line value the band scans compare against (in probe b/c space),
// each with +-1 to drive both sides of each half-plane split, plus a coarse grid.
const THRESHOLDS = [
  24, 40, 47, 48, 50, 55, 56, 63, 64, 71, 72, 80, 83, 84, 87, 88, 92, 95, 96, 103,
  104, 108, 127, 128, 143, 144, 159, 160, 168, 176, 191, 192, 199, 200, 215, 216,
  223, 224, 231, 232,
];
const INTERESTING = (() => {
  const s = new Set([0, 128, 255]);
  for (const t of THRESHOLDS) { s.add((t - 1) & 0xff); s.add(t); s.add((t + 1) & 0xff); }
  for (let v = 0; v <= 240; v += 16) s.add(v);
  return [...s].sort((a, b) => a - b);
})();

// One hint per band bucket, plus every bucket-boundary value, so band selection and
// fall-through are both exercised.
const HINTS = [0, 6, 7, 9, 10, 13, 14, 22, 23, 29, 30, 40, 200];

test("EQUAL (sweep): classifier identical across all bands + wall lines", () => {
  let n = 0;
  for (const hint of HINTS) {
    for (const b of INTERESTING) {
      for (const c of INTERESTING) {
        assertEqual(classifyBase(b, c, hint), idiomatic, `hint=${hint} b=${b} c=${c}`);
        n++;
      }
    }
  }
  console.log(`  EQUAL/sweep: ${n} crafted (band-hint, X, Y) classify states identical`);
});

test("EQUAL (sweep): exhaustive X*Y at the cascade extremes", () => {
  // hint 0 falls through the whole band cascade; hint 200 lands straight in the last
  // band. Sweeping every probe X/Y at both ends covers the full fall-through path.
  let n = 0;
  for (const hint of [0, 200]) {
    for (let x = 0; x < 256; x++) {
      for (let y = 0; y < 256; y++) {
        assertEqual(classifyBase((x + 3) % 256, (y + 5) % 256, hint), idiomatic, `hint=${hint} x=${x} y=${y}`);
        n++;
      }
    }
  }
  console.log(`  EQUAL/sweep: ${n} exhaustive probe positions at the cascade extremes identical`);
});

// -- 4. TEETH: deliberately-broken twins the gate MUST catch -------------------

// A local reference implementation mirroring the routine's classify path, with an
// injectable bug. bug=null must equal the oracle; each bug must be caught.
function refClassify(b, c, bug) {
  const flip = (lo, hi) => (bug === "swapTop" ? [hi, lo] : [lo, hi]);
  const bandTop = () => {
    if (b === 48) { const [x, y] = flip(4, 2); return c <= 55 ? x : y; }
    if (c === 56) return b <= 87 ? 2 : 4;
    if (b === 88) return c <= 63 ? 4 : 2;
    if (c === 64) return b <= 103 ? 2 : 4;
    if (b === 104) return c <= 83 ? 4 : 2;
    if (c === 84) return b <= 143 ? 2 : 4;
    if (b === 144) return c <= 127 ? 4 : 2;
    if (c === 128) return b <= 191 ? 2 : 4;
    if (b === 192) return c <= 159 ? 4 : 2;
    if (c === 160) return b <= 199 ? 2 : 4;
    if (b === 200) return c <= 191 ? 4 : 2;
    if (c === 192) return b <= 223 ? 2 : 4;
    if (b === 224) return c <= 215 ? 4 : 1;
    return null;
  };
  const band7 = () => {
    if (c === 216) return b > 176 ? 1 : 4;
    if (b === 176) return c <= 231 ? 4 : 1;
    if (c === 232) return b > 168 ? 1 : 8;
    return null;
  };
  return { bandTop, band7 };
}

/** Broken twin: mirrors the routine's classify path but injects one bug. */
function makeBrokenRoutine(bug) {
  return function broken(m) {
    const { mem } = m;
    if (mem.read8(FRAME_COUNTER) === 0) { m.push16(0x03ef); idiomaticPainter(m); }
    const timer = (mem.read8(WALL_TIMER) - 1) % 256;
    mem.write8(WALL_TIMER, timer);
    if (timer === 0) {
      mem.write8(WALL_TIMER, 30);
      if (mem.read8(TICK_BUSY) !== 0) { m.ret(); return; }
      if (mem.read8(SPAWN_PHASE) === 0 && bug !== "skip48c4") { m.push16(0x0409); idiomaticRecolour(m); }
    }
    if (mem.read8(PROBE_GATE) === 0) { m.ret(); return; }
    const b = (mem.read8(OBJ_X) + 3) % 256;
    const c = (mem.read8(OBJ_Y) + 5) % 256;
    const hint = mem.read8(BAND_HINT);
    const { bandTop, band7 } = refClassify(b, c, bug);
    let mask = null;
    if (hint < 7) mask = bandTop();
    if (mask === null && hint < 10) { mem.write8(BAND_HINT, bug === "badHint" ? 8 : 7); mask = band7(); }
    if (mask === null) { mem.write8(DIG_DIRS, 99); m.ret(); return; } // (unreached by our teeth inputs)
    mem.write8(DIG_DIRS, mask);
    m.ret();
  };
}

// The broken twins call the SAME idiomatic callees the real routine does (imported at
// the top), so their only divergence from the oracle is the injected bug.

test("TEETH: a swapped wall facing is CAUGHT at the mask byte", () => {
  // b == 48 in the top band, c <= 55: oracle raises bit 4, the swapped twin raises 2.
  const e = classifyBase(48, 0, 0);
  const r = runPair(e, makeBrokenRoutine("swapTop"));
  assert.notEqual(r.ram, null, "the gate FAILED to catch a swapped wall facing — it is worthless");
  assert.equal(r.ram.addr, DIG_DIRS, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the mask ${hx(DIG_DIRS)})`);
  console.log(`  TEETH: swapped facing caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a wrong band-hint stamp is CAUGHT at the hint byte", () => {
  // hint 0 falls through the top band into band 7 (b == 176) which restamps the hint.
  const e = classifyBase(176, 0, 0);
  const r = runPair(e, makeBrokenRoutine("badHint"));
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong band-hint stamp — it is worthless");
  assert.equal(r.ram.addr, BAND_HINT, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the hint ${hx(BAND_HINT)})`);
  console.log(`  TEETH: wrong band-hint caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a skipped column recolour (loc_48c4) is CAUGHT", () => {
  // The first real entry recolours a column; a twin that skips it first diverges at
  // loc_48c4's opening write — the column length it sets to 9 (the painter left 8).
  const r = runPair(ENTRIES[0], makeBrokenRoutine("skip48c4"));
  assert.notEqual(r.ram, null, "the gate FAILED to catch a skipped recolour — it is worthless");
  assert.equal(r.ram.addr, FILL_LEN, `teeth caught ${hx(r.ram.addr ?? 0)} (expected ${hx(FILL_LEN)})`);
  console.log(`  TEETH: skipped recolour caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a corrupted mask store is CAUGHT", () => {
  const brokenOut = (m) => { idiomatic(m); m.mem.write8(DIG_DIRS, m.mem.read8(DIG_DIRS) ^ 0xff); };
  const r = runPair(classifyBase(48, 0, 0), brokenOut);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a corrupted mask — it is worthless");
  assert.equal(r.ram.addr, DIG_DIRS, `teeth caught ${hx(r.ram.addr ?? 0)} (expected ${hx(DIG_DIRS)})`);
  console.log(`  TEETH: corrupted mask caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 5. IDENTITY: oracle vs oracle must be EQUAL (gate wiring sanity) ----------

test("IDENTITY: oracle vs oracle reports EQUAL on a captured entry", () => {
  assertEqual(ENTRIES[0], oracle, "identity");
  console.log("  IDENTITY: oracle vs oracle -> EQUAL");
});

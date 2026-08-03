// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1c05 (ROM 0x1C05) — the airborne-frame resolver: run the descent
 * probe, then take one of four tails (settle the landing / re-run the fall-height test /
 * carry on as an ordinary airborne frame / arm the fall-height test and run the object-overlap
 * search).
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated plainly:
 *
 *   1. REALISM (captured, ATTRACT ONLY). 0x1C05 is richly reachable without input: hooking it
 *      through a plain 6000-frame attract run captures 360 real dispatches, and all four tails
 *      fire there. The replay is SAMPLED — every 20th capture, plus the first at each distinct
 *      entry shape (board / land-check / airborne-frame count), plus the first of each observed
 *      tail chain — and the test asserts in-test that the sample covers every shape and every
 *      chain it saw, so the sampling cannot silently drop an arm. The counts it replayed are
 *      printed by the run. Credited gameplay, the other three boards in PLAY, and two-player
 *      are NOT covered by this part; boards 2/3/4 are reached only by the crafted arm below.
 *
 *   2. EQUAL (crafted). The descent probe at ROM 0x2B1C is the frozen oracle on BOTH sides, so
 *      a crafted arm replaces it with an identical stub on each side (applied to every fresh
 *      clone — Machine.clone() rebuilds `routines` from assets, so a stub left on the entry
 *      machine would not survive and the sweep would be vacuous). That pins the verdict
 *      predicate EXACTLY rather than sampling it: all 256 verdict values are swept, twice —
 *      once with an object counter that ticks to zero (the landing) and once with one that does
 *      not (a combination attract never produces). The stub is proved LIVE by asserting the
 *      landing it selects is observable. A second crafted arm drives the trigger frame on
 *      boards 2, 3 and 4, whose overlap-search arms attract never dispatches from here.
 *
 *   3. TEETH — five broken twins, each of which the suite MUST catch:
 *      (a) verdict predicate off by one (0 selects the landing tail, not 1).
 *      (b) trigger frame off by one (21 instead of 20).
 *      (c) dropped land-check arm.
 *      (d) dropped ITEM_COLLECTED latch.
 *      (e) inverted severity test.
 *
 * CONTRACT. RAM MINUS STACK_SCRATCH [0x6BE0,0x6C00), plus pc, SP and the propagated return
 * value. The oracle's two call brackets (the descent probe's and the overlap search's) land in
 * that dead stack region — measured: on 18 of the 360 real dispatches the ONLY difference
 * between oracle and candidate is inside it, which the test asserts, so the exclusion is
 * load-bearing rather than decorative. The candidate performs ONE m.ret() after running,
 * modelling the single terminal `ret` at the end of the oracle's tail chain; every arm nets
 * exactly one caller-return, so pc and SP line up and are compared. The result register is NOT
 * part of the contract and is deliberately not asserted — it differs on every dispatch, which
 * is the measurement behind the routine's memory-only live-out.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1c05.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1c05 as oracle } from "../../translated/loc_1c05.js";
import { loc_1c05 } from "../loc_1c05.js";
import { loc_1c33 } from "../loc_1c33.js";
import { loc_1c3a } from "../loc_1c3a.js";
import { markFatalFallByHeight } from "../markFatalFallByHeight.js";
import { searchPlayerObjectOverlap } from "../searchPlayerObjectOverlap.js";
import { writeMarioSpriteRecord } from "../writeMarioSpriteRecord.js";
import { Machine } from "../../machine.js";
import { u8 } from "../../../../core/int.js";
import {
  STACK_SCRATCH,
  BOARD,
  EFFECT_SELECT,
  EFFECT_STATE,
  ITEM_COLLECTED,
  MARIO_AIRBORNE,
  MARIO_AIR_FRAMES,
  MARIO_AIR_LANDCHECK,
} from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1c05;
const DESCENT_PROBE = 0x2b1c;
const ATTRACT_FRAMES = 6000;
const LAND_CHECK_TRIGGER_FRAME = 20;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

// -- diff plumbing ------------------------------------------------------------

/** First RAM byte that differs, skipping the dead STACK_SCRATCH region. */
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

/** First RAM byte that differs INCLUDING the stack — proves the exclusion is load-bearing. */
function firstAnyRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/** Run the ORACLE on a fresh clone; it performs its own terminal `ret`. */
function runOracle(entry, prep) {
  const c = entry.clone();
  if (prep) prep(c);
  const value = oracle(c);
  return { c, value };
}

/**
 * Run a candidate on a fresh clone, then model the single terminal `ret` that ends the
 * oracle's tail chain with one m.ret() (the idiomatic routine replaces the Z80 stack with the
 * JS call stack). Every arm nets exactly one caller-return, so this is one ret on all of them.
 */
function runCandidate(entry, fn, prep) {
  const c = entry.clone();
  if (prep) prep(c);
  const value = fn(c);
  c.ret();
  return { c, value };
}

/** Full contract diff: RAM − STACK_SCRATCH, pc, SP, and the propagated return value. */
function contractDiffs(entry, fn, prep) {
  const o = runOracle(entry, prep);
  const k = runCandidate(entry, fn, prep);
  const diffs = [];
  const ram = firstRamDiff(o.c, k.c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.c.pc !== k.c.pc) diffs.push(`pc oracle=${hx(o.c.pc)} cand=${hx(k.c.pc)}`);
  if (o.c.regs.sp !== k.c.regs.sp) diffs.push(`SP oracle=${hx(o.c.regs.sp)} cand=${hx(k.c.regs.sp)}`);
  if (o.value !== k.value) diffs.push(`return oracle=${String(o.value)} cand=${String(k.value)}`);
  return diffs;
}

// -- capture, classify, sample ------------------------------------------------

/** Hook 0x1C05 through a plain attract run and clone the machine at every dispatch. */
function captureAttractDispatches(frames = ATTRACT_FRAMES) {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides });
  host.runFrames(frames);
  return caps;
}

// The five tail targets the routine can reach, in the order the ROM tests them.
const TAIL_NAMES = [
  [0x1c3a, "landing"],
  [0x1c76, "fallHeight"],
  [0x1c33, "ordinary"],
  [0x2853, "overlap"],
  [0x1da6, "spriteTail"],
];

/** Which chain of tails the ORACLE takes from this entry, e.g. "overlap+ordinary+spriteTail". */
function tailChain(entry) {
  const c = entry.clone();
  const seen = [];
  for (const [addr, name] of TAIL_NAMES) {
    const base = c.routines.get(addr);
    c.routines.set(addr, (mm, ...args) => {
      if (!seen.includes(name)) seen.push(name);
      return base(mm, ...args);
    });
  }
  oracle(c);
  return seen.join("+");
}

/** Entry shape: what a reader can see about the dispatch before it runs. */
const entryShape = (m) =>
  `board=${m.mem.read8(BOARD)} landcheck=${m.mem.read8(MARIO_AIR_LANDCHECK)} air=${m.mem.read8(MARIO_AIR_FRAMES)}`;

/**
 * The sampling policy: every 20th capture, PLUS the first at each distinct entry shape, PLUS
 * the first of each observed tail chain (without which a rare arm — the overlap search's
 * nonzero-severity path, 2 of 360 — shares its entry shape with a common one and would be
 * dropped by the sample).
 */
function sample(caps, chains) {
  const picked = new Set();
  const shapeSeen = new Set(), chainSeen = new Set();
  for (let i = 0; i < caps.length; i++) {
    const shape = entryShape(caps[i]);
    let take = i % 20 === 0;
    if (!shapeSeen.has(shape)) { shapeSeen.add(shape); take = true; }
    if (!chainSeen.has(chains[i])) { chainSeen.add(chains[i]); take = true; }
    if (take) picked.add(i);
  }
  return [...picked].sort((a, b) => a - b);
}

// -- 1. REALISM (captured, attract only) --------------------------------------

test("REALISM: real captured 0x1C05 attract dispatches — loc_1c05 matches the oracle chain", () => {
  const caps = captureAttractDispatches();
  assert.ok(caps.length >= 1, "expected at least one real 0x1C05 dispatch during attract");

  const chains = caps.map(tailChain);
  const idx = sample(caps, chains);

  const allShapes = new Set(caps.map(entryShape));
  const allChains = new Set(chains);
  const sampledShapes = new Set(idx.map((i) => entryShape(caps[i])));
  const sampledChains = new Set(idx.map((i) => chains[i]));
  for (const s of allShapes) assert.ok(sampledShapes.has(s), `sample dropped entry shape "${s}"`);
  for (const t of allChains) assert.ok(sampledChains.has(t), `sample dropped tail chain "${t}"`);

  // All four tails must actually be present in a plain attract run — if the demo ever stops
  // reaching one, this gate must say so instead of quietly narrowing.
  for (const want of ["landing", "fallHeight", "ordinary", "overlap"]) {
    assert.ok([...allChains].some((t) => t.startsWith(want)), `attract never took the "${want}" tail`);
  }

  let stackOnly = 0;
  for (const i of idx) {
    const diffs = contractDiffs(caps[i], loc_1c05);
    assert.equal(diffs.length, 0, `captured dispatch #${i} (${entryShape(caps[i])}): ${diffs.join("; ")}`);
    // Load-bearing STACK_SCRATCH exclusion: the oracle's brackets leave bytes there that the
    // JS-call-stack rewrite never writes.
    const o = runOracle(caps[i]), k = runCandidate(caps[i], loc_1c05);
    const any = firstAnyRamDiff(o.c, k.c);
    if (any && inStack(any.addr)) stackOnly++;
  }
  assert.ok(stackOnly > 0, "no replayed dispatch differed only inside STACK_SCRATCH — the exclusion would be vacuous");

  const perChain = [...allChains].map((t) => `${t}=${chains.filter((x) => x === t).length}`).join(", ");
  console.log(`  REALISM: ${idx.length} of ${caps.length} real 0x1C05 dispatches replayed (${ATTRACT_FRAMES} attract frames), ` +
    `${sampledShapes.size} of ${allShapes.size} entry shapes, ${sampledChains.size} of ${allChains.size} tail chains; ` +
    `chain counts over all captures: ${perChain}; ${stackOnly} replays differed ONLY in STACK_SCRATCH`);
});

// -- 2. EQUAL (crafted) --------------------------------------------------------

/**
 * Replace the still-frozen descent probe with an identical stub on BOTH sides, so the verdict
 * byte and object counter it hands back can be driven directly. The stub consumes the stacked
 * continuation exactly as the real probe's two exits do.
 */
const probeStub = (verdict, counter) => (m) => {
  m.routines.set(DESCENT_PROBE, (mm) => {
    mm.regs.a = verdict;
    mm.regs.b = counter;
    mm.ret();
  });
};

test("EQUAL (crafted): all 256 descent-probe verdicts, both counter arms, match the oracle", () => {
  const caps = captureAttractDispatches(3000);
  const trigger = caps.find(
    (c) => c.mem.read8(MARIO_AIR_FRAMES) === LAND_CHECK_TRIGGER_FRAME && c.mem.read8(MARIO_AIR_LANDCHECK) === 0,
  );
  assert.ok(trigger, "expected a real trigger-frame capture to craft from");

  // The stub is LIVE, not inert: verdict 1 with a counter that ticks to zero must reach the
  // landing settle, which clears MARIO_AIRBORNE; verdict 0 must not.
  const landed = runOracle(trigger, probeStub(1, 1)).c;
  const notLanded = runOracle(trigger, probeStub(0, 0)).c;
  assert.equal(trigger.mem.read8(MARIO_AIRBORNE), 1, "the crafted base must be airborne");
  assert.equal(landed.mem.read8(MARIO_AIRBORNE), 0, "verdict 1 + counter 1 must settle the landing");
  assert.equal(notLanded.mem.read8(MARIO_AIRBORNE), 1, "verdict 0 must not settle a landing");

  for (const counter of [1, 3]) {
    for (let verdict = 0; verdict < 256; verdict++) {
      const diffs = contractDiffs(trigger, loc_1c05, probeStub(verdict, counter));
      assert.equal(diffs.length, 0, `verdict ${verdict}, counter ${counter}: ${diffs.join("; ")}`);
    }
  }
  console.log("  EQUAL/crafted: 512 probe verdict×counter combinations identical (counter 3 — a still-airborne " +
    "nonzero verdict — is a combination attract never produces)");
});

test("EQUAL (crafted): the trigger frame on boards 2, 3 and 4 matches the oracle", () => {
  const caps = captureAttractDispatches(3000);
  const trigger = caps.find(
    (c) => c.mem.read8(MARIO_AIR_FRAMES) === LAND_CHECK_TRIGGER_FRAME && c.mem.read8(MARIO_AIR_LANDCHECK) === 0,
  );
  assert.ok(trigger, "expected a real trigger-frame capture to craft from");

  for (const board of [2, 3, 4]) {
    const prep = (m) => { probeStub(0, 0)(m); m.mem.write8(BOARD, board); };
    const diffs = contractDiffs(trigger, loc_1c05, prep);
    assert.equal(diffs.length, 0, `board ${board}: ${diffs.join("; ")}`);
  }
  console.log("  EQUAL/crafted: boards 2/3/4 drive their own overlap-search arms identically " +
    "(each returned severity 0 on this crafted state, so the latch block is covered by the real " +
    "attract dispatches above, not by this arm)");
});

// -- 3. TEETH ------------------------------------------------------------------

/** Broken twin (a): the verdict predicate off by one — 0 selects the landing tail. */
function brokenVerdictPredicate(m) {
  const { regs, mem8 } = m;
  m.push16(0x1c08);
  m.call(DESCENT_PROBE);
  const probeVerdict = regs.a;
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 0) return loc_1c3a(m); // BUG: 1 selects the landing tail, not 0
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);
  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - LAND_CHECK_TRIGGER_FRAME);
  if (framesToTrigger !== 0) { regs.a = framesToTrigger; return loc_1c33(m); }
  mem8[MARIO_AIR_LANDCHECK] = 1;
  m.push16(0x1c23);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;
  if (severity === 0) return writeMarioSpriteRecord(m);
  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  mem8[ITEM_COLLECTED] = 1;
  regs.a = 1;
  return loc_1c33(m);
}

/** Broken twin (b): the trigger frame off by one — 21 instead of 20. */
function brokenTriggerFrame(m) {
  const { regs, mem8 } = m;
  m.push16(0x1c08);
  m.call(DESCENT_PROBE);
  const probeVerdict = regs.a;
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);
  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - 21); // BUG: the trigger frame is 20
  if (framesToTrigger !== 0) { regs.a = framesToTrigger; return loc_1c33(m); }
  mem8[MARIO_AIR_LANDCHECK] = 1;
  m.push16(0x1c23);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;
  if (severity === 0) return writeMarioSpriteRecord(m);
  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  mem8[ITEM_COLLECTED] = 1;
  regs.a = 1;
  return loc_1c33(m);
}

/** Broken twin (c): never arms the fall-height check. */
function brokenNoLandCheckArm(m) {
  const { regs, mem8 } = m;
  m.push16(0x1c08);
  m.call(DESCENT_PROBE);
  const probeVerdict = regs.a;
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);
  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - LAND_CHECK_TRIGGER_FRAME);
  if (framesToTrigger !== 0) { regs.a = framesToTrigger; return loc_1c33(m); }
  // BUG: MARIO_AIR_LANDCHECK never armed
  m.push16(0x1c23);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;
  if (severity === 0) return writeMarioSpriteRecord(m);
  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  mem8[ITEM_COLLECTED] = 1;
  regs.a = 1;
  return loc_1c33(m);
}

/** Broken twin (d): drops the pickup flag the landing code consumes. */
function brokenNoItemLatch(m) {
  const { regs, mem8 } = m;
  m.push16(0x1c08);
  m.call(DESCENT_PROBE);
  const probeVerdict = regs.a;
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);
  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - LAND_CHECK_TRIGGER_FRAME);
  if (framesToTrigger !== 0) { regs.a = framesToTrigger; return loc_1c33(m); }
  mem8[MARIO_AIR_LANDCHECK] = 1;
  m.push16(0x1c23);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;
  if (severity === 0) return writeMarioSpriteRecord(m);
  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  // BUG: ITEM_COLLECTED never latched
  regs.a = 1;
  return loc_1c33(m);
}

/** Broken twin (e): inverted severity test — latches on a miss, tails out on a hit. */
function brokenInvertedSeverity(m) {
  const { regs, mem8 } = m;
  m.push16(0x1c08);
  m.call(DESCENT_PROBE);
  const probeVerdict = regs.a;
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);
  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - LAND_CHECK_TRIGGER_FRAME);
  if (framesToTrigger !== 0) { regs.a = framesToTrigger; return loc_1c33(m); }
  mem8[MARIO_AIR_LANDCHECK] = 1;
  m.push16(0x1c23);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;
  if (severity !== 0) return writeMarioSpriteRecord(m); // BUG: inverted
  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  mem8[ITEM_COLLECTED] = 1;
  regs.a = 1;
  return loc_1c33(m);
}

test("TEETH: five broken twins are all CAUGHT on real captured dispatches", () => {
  const caps = captureAttractDispatches();
  const chains = caps.map(tailChain);

  const at = (prefix) => {
    const i = chains.findIndex((t) => t.startsWith(prefix));
    assert.ok(i >= 0, `no captured dispatch took the "${prefix}" tail`);
    return caps[i];
  };
  const hitIdx = chains.findIndex((t) => t === "overlap+ordinary+spriteTail");
  assert.ok(hitIdx >= 0, "no captured dispatch reached the overlap-search LATCH block (0x1C23)");

  const landing = at("landing");
  const trigger = at("overlap");
  const hit = caps[hitIdx];

  // The expected address is the LOWEST cell the twin can disturb, because the state dump is
  // walked in address order; a twin whose only expectation is "something differs" carries null.
  const cases = [
    ["verdict predicate off by one", landing, brokenVerdictPredicate, null],
    ["trigger frame off by one", trigger, brokenTriggerFrame, [MARIO_AIR_LANDCHECK]],
    ["dropped land-check arm", trigger, brokenNoLandCheckArm, [MARIO_AIR_LANDCHECK]],
    ["dropped ITEM_COLLECTED latch", hit, brokenNoItemLatch, [ITEM_COLLECTED]],
    ["inverted severity test", hit, brokenInvertedSeverity, [ITEM_COLLECTED, EFFECT_STATE, EFFECT_SELECT]],
  ];

  const caught = [];
  for (const [name, entry, twin, wantAddrs] of cases) {
    const diffs = contractDiffs(entry, twin);
    assert.ok(diffs.length > 0, `the "${name}" twin escaped — the gate is worthless`);
    if (wantAddrs !== null) {
      assert.ok(
        wantAddrs.some((a) => diffs[0].startsWith(`RAM@${hx(a)}`)),
        `"${name}": expected the first diff at one of ${wantAddrs.map(hx).join("/")}, got ${diffs[0]}`,
      );
    }
    caught.push(`${name} (${diffs[0]})`);
  }
  console.log(`  TEETH: ${caught.length} caught — ${caught.join("; ")}`);
});

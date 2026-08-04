// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_24b4 (ROM 0x24B4) — the object-retirement gate: an object whose
 * OBJ_Y has reached 232 with its OBJ_X inside the 32..41 band is retired (slot freed, column
 * blanked, impact sound asserted, two mode latches armed) and handed to the shared
 * object-sprite tail WITHOUT returning to the caller; anything else returns untouched.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated plainly:
 *
 *   1. EQUAL (captured, ATTRACT ONLY). A plain 1200-frame attract run dispatches 0x24B4 1154
 *      times, the first at frame 613, across the five OBJ_ARRAY_67 record bases this run reaches
 *      (a longer run reaches more; that is a fact about the budget, not about the routine).
 *      EVERY ONE is replayed inline at the dispatch — no sampling, nothing held in memory. That
 *      is load-bearing rather than tidy: attract's ENTIRE natural coverage of the band's high
 *      edge is one dispatch (the single OBJ_X == 42 at the bottom) and of the retirement arm is
 *      one dispatch. A stride-of-20 sample would have tested neither, and two of the twins below
 *      are caught by exactly those single dispatches.
 *      Credited play and boards 2-4 are NOT covered — the object walk this belongs to runs only
 *      on 25m.
 *
 *      A retirement replay is not one routine's worth of work. The rewrite is installed in the
 *      replaying machine's registry, and the shared tail re-enters this address for the rest of
 *      the ten-record walk, so one replay drives every later slot through the implementation
 *      under test against the oracle doing the same.
 *
 *   2. EQUAL (crafted), five arms for the five things attract cannot produce, each ONE poke on
 *      a real capture with everything else left alone, and each proved non-vacuous by counting
 *      the dispatches on which the craft moves the ORACLE's own result:
 *        (a) bandBelow            — at the bottom with OBJ_X below the band (attract: never).
 *        (b) edgeJustAbove        — one row short of the threshold, inside the band.
 *        (c) edgeAtThreshold      — exactly at the threshold, inside the band.
 *        (d) retireBaseKind       — a retirement of a record whose kind field is 0 (attract's
 *                                   one natural retirement has kind 1), so the phase write is
 *                                   skipped.
 *        (e) retireAlreadyLatched — a retirement with the one-shot latch already holding 2, so
 *                                   the latch write is skipped AND its exact value must survive.
 *                                   (Whether the ROM can produce a 2 there is NOT claimed; the
 *                                   arm pins the comparison, not reachability.)
 *
 *   3. THE CONTRACT IS THE FULL DUMP — work/sprite/video RAM with STACK_SCRATCH INCLUDED — plus
 *      pc, SP and the returned protocol value. The stack region is deliberately NOT excluded:
 *      the rewrite keeps every stack move the oracle makes (the retirement arm's pop, and the
 *      hand-off into the still-frozen tail), so the guest stack legitimately agrees and
 *      comparing it is free teeth. The test asserts that including it is not vacuous by
 *      counting the crafted retirements that actually write inside it.
 *
 *      pc and SP hold on the RETURN arms too, and that is a fact about the harness worth
 *      stating: the candidate is invoked through the machine's OWN call-bracket seam
 *      (`routines.get(TARGET)`, i.e. the seamWrap installed at construction), which is what
 *      go-live uses, so the `ret` the rewrite models as a JS `return` is closed exactly as it
 *      will be in the shipped configuration. A dedicated assertion proves that seam actually
 *      fires rather than assuming it, and a second one proves that installing an override at
 *      this address does not perturb the ORACLE side.
 *
 *   4. LIVE (measured). The rewrite is wired live at 0x24B4 for a 1200-frame CYCLE-FREE attract
 *      run and every frame is diffed against the all-oracle baseline. That baseline is the right
 *      control because this rewrite calls no idiomatic callee — its one hand-off is into a
 *      still-frozen routine through the registry — so the only difference between the two runs
 *      is the routine under test. The arm counts its own dispatches and asserts the count, so it
 *      cannot pass by never running.
 *
 *   5. TEETH — nine broken twins, and the test asserts WHICH half catches each. Four of them
 *      escape every one of the 1154 natural captures and are caught only by a crafted arm; both
 *      halves are asserted for each, which is the whole reason those arms exist:
 *        Y threshold one row low   -> escapes natural, caught by (b)
 *        Y threshold one row high  -> escapes natural, caught by (c)
 *        band low edge dropped     -> escapes natural, caught by (a)
 *        phase write unconditional -> escapes natural, caught by (d)
 *        one-shot latch dropped    -> escapes natural, caught by (e)
 *      and four are caught naturally, each by a different half of the contract:
 *        band high edge off by one -> RAM, on the single OBJ_X == 42 dispatch
 *        column blank dropped      -> RAM
 *        wrong protocol value      -> the RETURN comparison and nothing else
 *        leaked return bracket     -> pc and nothing else (RAM, SP and the return all agree),
 *                                     which is what proves the stack half of the contract is
 *                                     wired rather than decorative
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-24b4.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_24b4 as oracle } from "../../translated/loc_24b4.js";
import { loc_24b4 } from "../loc_24b4.js";
import { OBJ_ACTIVE, OBJ_X, OBJ_Y, OBJ_ARRAY_67, SND_TRIGGER, STACK_SCRATCH } from "../names.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import manifest from "../../manifest.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x24b4;
const ATTRACT_FRAMES = 1200;

// The routine's own constants, restated here so a twin that changes one is compared against a
// number this file owns rather than against the file under test.
const BOTTOM_ROW = 232;
const BAND_LO = 32;
const BAND_HI = 42;
const OBJ_KIND = 0x15;
const PHASE_BITS = 0x62b9;
const MODE_LATCH = 0x6348;
const IMPACT_SOUND = SND_TRIGGER + 2;

// Attract is deterministic, so these are exact. Asserted, not merely printed — a sweep that
// silently stops dispatching would otherwise read as green.
const CAPTURED_DISPATCHES = 1154; // cycle-accurate runFrames, 1200 frames
const LIVE_DISPATCHES = 1183; // cycle-free runCycleFree, 1200 frames (a different frame clock)
// The natural arm census, which is what makes the "one dispatch each" claim above checkable.
const NATURAL_ARMS = { "ret above the bottom": 1130, "ret past the band": 23, "ret below the band": 0, retire: 1 };
const RECORD_BASES = 5; // OBJ_ARRAY_67 records 0..4, the ones attract's walk reaches

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// -- rehosting: a fresh, override-free machine carrying exactly one handler ------

/**
 * Copy a machine's state into a FRESH Machine that carries `fn` at 0x24B4 and nothing else.
 *
 * Not `clone()`: clone rebuilds from `this.assets`, so it would carry the capturing hook and
 * every replay would re-enter it. A fresh Machine also runs the constructor's override wiring,
 * which is what puts the real call-bracket seam around `fn` — see the header, point 3.
 */
function rehost(src, fn) {
  const c = new Machine(ROM, fn ? { overrides: new Map([[TARGET, fn]]) } : {});
  c.mem.workRam.set(src.mem.workRam);
  c.mem.spriteRam.set(src.mem.spriteRam);
  c.mem.videoRam.set(src.mem.videoRam);
  c.mem.discardedWrites = src.mem.discardedWrites;
  c.regs.copyFrom(src.regs);
  c.io.loadStateFrom(src.io);
  c.cycles = src.cycles;
  c.pc = src.pc;
  c.pcKnown = src.pcKnown;
  c.frame = src.frame;
  c.nmiCount = src.nmiCount;
  c.booted = src.booted;
  // Pin the scheduler off, exactly as clone() does: a replay must not fire an NMI or sample a
  // frame of its own.
  c.nextBoundary = Infinity;
  c.nextNmi = Infinity;
  c.maxFrames = Infinity;
  c.maxCycles = Infinity;
  return c;
}

/** Which arm the ORACLE's own gate conditions select for this entry state. Never the candidate's. */
function armOf(mm) {
  const record = mm.regs.ix;
  if (mm.mem8[(record + OBJ_Y) & 0xffff] < BOTTOM_ROW) return "ret above the bottom";
  const column = mm.mem8[(record + OBJ_X) & 0xffff];
  if (column >= BAND_HI) return "ret past the band";
  if (column < BAND_LO) return "ret below the band";
  return "retire";
}

// -- the sweep: replay INLINE at every real dispatch ---------------------------

/**
 * Boot attract with a hook at 0x24B4 that, at EVERY real dispatch, rehosts the machine twice,
 * runs the oracle on one and `candidate` on the other, compares, and throws both away before
 * letting the host continue on the oracle. O(1) memory, every dispatch replayed.
 *
 * `prep` is applied identically to both sides, which is how a crafted arm is built on a REAL
 * captured state (coherent stack, live walk registers, the caller's shadow bank) rather than
 * from scratch.
 */
function sweepAttract(candidate, { prep = null, frames = ATTRACT_FRAMES } = {}) {
  let dispatches = 0;
  const breaches = [];
  const arms = new Map();
  const bases = new Map();
  let firstFrame = null;
  // A crafted arm is worthless if it changes nothing; count the dispatches on which it moves the
  // ORACLE's own result, so non-vacuity is a measurement rather than an assumption.
  let prepChangedOracle = 0;
  // Non-vacuity of INCLUDING the stack scratch in the diff: how many replays actually wrote there.
  let stackScratchWritten = 0;
  // Proof that the candidate really goes through the machine's call-bracket seam: on a return arm
  // the rewrite touches no stack at all, so SP can only have advanced past the caller's return
  // address, and pc can only hold it, if the seam's `ret` fired.
  let seamClosedBracket = 0;
  let returnArms = 0;

  const tally = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);

  const host = new Machine(ROM, { overrides: new Map([[TARGET, (mm) => {
    dispatches++;
    if (firstFrame === null) firstFrame = mm.frames.length;
    tally(bases, mm.regs.ix);
    const spEntry = mm.regs.sp;
    const callerReturn = mm.mem.read16(spEntry);

    const a = rehost(mm, oracle); // nested dispatches during the walk stay oracle on this side
    const b = rehost(mm, candidate); // ...and stay the candidate on this one
    if (prep) { prep(a); prep(b); }
    const arm = armOf(a);
    tally(arms, arm);

    let oracleValue, oracleDump;
    const entryDump = a.dumpState();
    try {
      oracleValue = a.routines.get(TARGET)(a);
      oracleDump = a.dumpState();
    } catch (err) {
      // The oracle faulting on a crafted state is a defect in the ARM, not in the candidate.
      throw new Error(`the oracle threw on dispatch #${dispatches} (${arm}): ${err.message}`);
    }
    for (let i = 0; i < entryDump.length; i++) {
      if (entryDump[i] === oracleDump[i]) continue;
      const addr = a.stateOffsetToAddr(i);
      if (addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi) { stackScratchWritten++; break; }
    }

    let breach = null;
    try {
      const candidateValue = b.routines.get(TARGET)(b);
      const candidateDump = b.dumpState();
      for (let i = 0; i < oracleDump.length; i++) {
        if (oracleDump[i] === candidateDump[i]) continue;
        breach = { kind: "RAM", addr: a.stateOffsetToAddr(i), a: oracleDump[i], b: candidateDump[i] };
        break;
      }
      if (!breach && a.pc !== b.pc) breach = { kind: "pc", addr: null, a: hx(a.pc), b: hx(b.pc) };
      if (!breach && a.regs.sp !== b.regs.sp) breach = { kind: "SP", addr: null, a: hx(a.regs.sp), b: hx(b.regs.sp) };
      if (!breach && oracleValue !== candidateValue) {
        breach = { kind: "return", addr: null, a: String(oracleValue), b: String(candidateValue) };
      }
      if (arm.startsWith("ret") && candidateValue === true) {
        returnArms++;
        if (b.regs.sp === ((spEntry + 2) & 0xffff) && b.pc === callerReturn) seamClosedBracket++;
      }
    } catch (err) {
      // A twin handed a state it should never have accepted can walk off the end of a ROM table
      // and THROW rather than diverge. A fault is a result, so record it as the breach.
      breach = { kind: "threw", addr: null, a: "-", b: err.message };
    }

    if (prep) {
      // Same entry, same oracle, WITHOUT the craft: if the result is identical the craft did
      // nothing on this dispatch.
      const plain = rehost(mm, oracle);
      plain.routines.get(TARGET)(plain);
      const p = plain.dumpState();
      for (let i = 0; i < p.length; i++) if (p[i] !== oracleDump[i]) { prepChangedOracle++; break; }
    }

    if (breach) breaches.push({ dispatch: dispatches, arm, base: mm.regs.ix, ...breach });
    return oracle(mm); // the HOST always runs the oracle, so attract proceeds normally
  }]]) });
  host.runFrames(frames);

  return {
    dispatches, breaches, arms, bases, firstFrame,
    prepChangedOracle, stackScratchWritten, seamClosedBracket, returnArms,
  };
}

const describe = (b) =>
  `dispatch #${b.dispatch} (${b.arm}, base ${hx(b.base)}): ${b.kind}` +
  `${b.addr === null ? "" : "@" + hx(b.addr)} oracle=${b.a} cand=${b.b}`;

// -- the crafted arms ----------------------------------------------------------

const put = (mm, off, v) => { mm.mem8[(mm.regs.ix + off) & 0xffff] = v; };
const BELOW_BAND = BAND_LO - 1;
const INSIDE_BAND = 36;
const WELL_BELOW_BOTTOM = 240;
const ALREADY_LATCHED = 2; // a value neither 0 nor the 1 this routine writes

const CRAFTS = {
  bandBelow: (mm) => { put(mm, OBJ_Y, WELL_BELOW_BOTTOM); put(mm, OBJ_X, BELOW_BAND); },
  edgeJustAbove: (mm) => { put(mm, OBJ_Y, BOTTOM_ROW - 1); put(mm, OBJ_X, INSIDE_BAND); },
  edgeAtThreshold: (mm) => {
    put(mm, OBJ_Y, BOTTOM_ROW); put(mm, OBJ_X, INSIDE_BAND); put(mm, OBJ_KIND, 1);
    mm.mem8[MODE_LATCH] = 0;
  },
  retireBaseKind: (mm) => {
    put(mm, OBJ_Y, WELL_BELOW_BOTTOM); put(mm, OBJ_X, INSIDE_BAND); put(mm, OBJ_KIND, 0);
    mm.mem8[MODE_LATCH] = 0;
  },
  retireAlreadyLatched: (mm) => {
    put(mm, OBJ_Y, WELL_BELOW_BOTTOM); put(mm, OBJ_X, INSIDE_BAND); put(mm, OBJ_KIND, 1);
    mm.mem8[MODE_LATCH] = ALREADY_LATCHED;
  },
};
/** The arm each craft is supposed to drive — asserted, so a craft that stops working is loud. */
const CRAFT_ARM = {
  bandBelow: "ret below the band",
  edgeJustAbove: "ret above the bottom",
  edgeAtThreshold: "retire",
  retireBaseKind: "retire",
  retireAlreadyLatched: "retire",
};

// Node's test runner evaluates the module top to bottom, so these run once at load.
const NATURAL = ROM_PRESENT ? sweepAttract(loc_24b4) : null;
const CRAFTED = ROM_PRESENT
  ? Object.fromEntries(Object.entries(CRAFTS).map(([k, prep]) => [k, sweepAttract(loc_24b4, { prep })]))
  : null;

// -- 1. EQUAL, on every real attract dispatch ----------------------------------

test("EQUAL: loc_24b4 matches the oracle on every one of the real attract dispatches", () => {
  assert.ok(NATURAL.dispatches > 0, "no dispatch of 0x24B4 was captured — the harness never engaged");
  assert.equal(
    NATURAL.dispatches, CAPTURED_DISPATCHES,
    `attract dispatched 0x24B4 ${NATURAL.dispatches} times, not the ${CAPTURED_DISPATCHES} this gate claims`,
  );
  assert.equal(
    NATURAL.breaches.length, 0,
    NATURAL.breaches.length ? `${NATURAL.breaches.length} breach(es), first: ${describe(NATURAL.breaches[0])}` : "",
  );

  // The arm census the header's "one dispatch each" claim rests on.
  for (const [arm, want] of Object.entries(NATURAL_ARMS)) {
    assert.equal(NATURAL.arms.get(arm) ?? 0, want, `attract took the "${arm}" arm ${NATURAL.arms.get(arm) ?? 0} times, not ${want}`);
  }
  assert.equal(NATURAL.bases.size, RECORD_BASES, `attract dispatched on ${NATURAL.bases.size} record bases, not ${RECORD_BASES}`);
  for (const [base] of NATURAL.bases) {
    assert.ok(base >= OBJ_ARRAY_67, `a captured record base ${hx(base)} is below OBJ_ARRAY_67`);
  }

  const census = [...NATURAL.arms].map(([a, n]) => `${a} x${n}`).join(", ");
  console.log(
    `  EQUAL: all ${NATURAL.dispatches} real 0x24B4 dispatches in ${ATTRACT_FRAMES} attract frames replayed inline ` +
      `(first at frame ${NATURAL.firstFrame}); ${NATURAL.bases.size} record bases; arms: ${census}; ` +
      "full state dump INCLUDING STACK_SCRATCH, plus pc, SP and the returned protocol value",
  );
});

// -- 2. The harness itself -----------------------------------------------------

test("HARNESS: the candidate really goes through the machine's call-bracket seam", () => {
  assert.equal(NATURAL.returnArms, NATURAL_ARMS["ret above the bottom"] + NATURAL_ARMS["ret past the band"],
    "the return-arm count does not match the arm census");
  assert.equal(
    NATURAL.seamClosedBracket, NATURAL.returnArms,
    `the seam closed the caller's bracket on only ${NATURAL.seamClosedBracket} of ${NATURAL.returnArms} return arms — ` +
      "the rewrite touches no stack itself, so without the seam this gate would be comparing a leaked frame",
  );
  console.log(
    `  HARNESS: on all ${NATURAL.returnArms} return arms the candidate came back with SP past the caller's return ` +
      "address and pc holding it — the seam's ret fired, exactly as it will at go-live",
  );
});

test("HARNESS: installing an override at 0x24B4 does not perturb the ORACLE side", () => {
  // The oracle side is rehosted WITH an override installed (which installs the seam). If that
  // changed anything the oracle does, every comparison above would be against a moved reference.
  let checked = 0;
  let mismatches = 0;
  const host = new Machine(ROM, { overrides: new Map([[TARGET, (mm) => {
    checked++;
    const withSeam = rehost(mm, oracle);
    const bare = rehost(mm, null);
    withSeam.routines.get(TARGET)(withSeam);
    oracle(bare);
    const p = withSeam.dumpState();
    const q = bare.dumpState();
    let same = withSeam.pc === bare.pc && withSeam.regs.sp === bare.regs.sp;
    for (let i = 0; same && i < p.length; i++) if (p[i] !== q[i]) same = false;
    if (!same) mismatches++;
    return oracle(mm);
  }]]) });
  host.runFrames(ATTRACT_FRAMES);
  assert.equal(checked, CAPTURED_DISPATCHES, "the control run did not see the expected dispatch count");
  assert.equal(mismatches, 0, `${mismatches} of ${checked} oracle replays differ with the seam installed`);
  console.log(`  HARNESS: ${checked} oracle replays identical with and without an override installed at 0x24B4`);
});

test("CONTRACT: including STACK_SCRATCH in the diff is not vacuous", () => {
  // The exclusion sibling gates apply is deliberately NOT applied here (the rewrite keeps the
  // oracle's stack moves). That is only worth anything if replays write there at all.
  const written = CRAFTED.retireBaseKind.stackScratchWritten;
  assert.ok(
    written > 0,
    `no crafted retirement wrote inside STACK_SCRATCH ${hx(STACK_SCRATCH.lo)}-${hx(STACK_SCRATCH.hi)}, ` +
      "so including it in the diff proves nothing",
  );
  assert.equal(
    NATURAL.stackScratchWritten, NATURAL_ARMS.retire,
    "only the retirement arm should reach code that writes the stack scratch",
  );
  console.log(
    `  CONTRACT: ${written} of ${CRAFTED.retireBaseKind.dispatches} crafted retirements write inside ` +
      `STACK_SCRATCH ${hx(STACK_SCRATCH.lo)}-${hx(STACK_SCRATCH.hi)}, and it is compared rather than excluded`,
  );
});

// -- 3. EQUAL (crafted) --------------------------------------------------------

for (const name of Object.keys(CRAFTS)) {
  test(`EQUAL (crafted): the "${name}" arm — which attract never produces — matches the oracle`, () => {
    const s = CRAFTED[name];
    assert.ok(s.prepChangedOracle > 0, `the "${name}" craft changed nothing the oracle does — the arm would be vacuous`);
    assert.equal(s.arms.get(CRAFT_ARM[name]) ?? 0, s.dispatches,
      `the "${name}" craft was expected to drive the "${CRAFT_ARM[name]}" arm on every dispatch`);
    assert.equal(s.breaches.length, 0,
      s.breaches.length ? `${s.breaches.length} breach(es), first: ${describe(s.breaches[0])}` : "");
    console.log(
      `  EQUAL/crafted ${name}: ${s.dispatches} replays on the "${CRAFT_ARM[name]}" arm; ` +
        `the craft moves the oracle's own result on ${s.prepChangedOracle} of them`,
    );
  });
}

// -- 4. TEETH ------------------------------------------------------------------

/**
 * One parameterised twin body, so every twin differs from the real routine in EXACTLY the one
 * thing it names. It is written out longhand rather than wrapping loc_24b4 because most of these
 * defects are in the gate conditions, which a wrapper cannot reach.
 */
function twinBody(m, { bottom = BOTTOM_ROW, high = (x) => x >= BAND_HI, low = (x) => x < BAND_LO,
  kindGate = true, oneShot = true, blankColumn = true } = {}) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] < bottom) return true;
  const column = mem8[record + OBJ_X];
  if (high(column)) return true;
  if (low(column)) return true;
  if (!kindGate || mem8[record + OBJ_KIND] !== 0) mem8[PHASE_BITS] = 3;
  mem8[record + OBJ_ACTIVE] = 0;
  if (blankColumn) mem8[record + OBJ_X] = 0;
  mem8[IMPACT_SOUND] = 3;
  m.regs.hl = m.pop16();
  if (!oneShot || mem8[MODE_LATCH] === 0) mem8[MODE_LATCH] = 1;
  m.call(0x21ba);
  return false;
}

/** Twins whose defect ESCAPES every natural capture — both halves are asserted. */
const CRAFTED_ONLY_TWINS = [
  ["Y threshold one row low", (m) => twinBody(m, { bottom: BOTTOM_ROW - 1 }), "edgeJustAbove", "RAM"],
  ["Y threshold one row high", (m) => twinBody(m, { bottom: BOTTOM_ROW + 1 }), "edgeAtThreshold", "RAM"],
  ["band low edge dropped", (m) => twinBody(m, { low: () => false }), "bandBelow", "RAM"],
  ["phase write unconditional", (m) => twinBody(m, { kindGate: false }), "retireBaseKind", "RAM"],
  ["one-shot latch dropped", (m) => twinBody(m, { oneShot: false }), "retireAlreadyLatched", "RAM"],
];

for (const [name, twin, craft, kind] of CRAFTED_ONLY_TWINS) {
  test(`TEETH: the "${name}" twin ESCAPES every natural capture and is caught only by the "${craft}" arm`, () => {
    const natural = sweepAttract(twin);
    assert.equal(
      natural.breaches.length, 0,
      `the "${name}" twin was expected to escape all ${natural.dispatches} natural captures, but ` +
        `${natural.breaches.length} caught it — the crafted arm's premise is wrong`,
    );
    const crafted = sweepAttract(twin, { prep: CRAFTS[craft] });
    assert.ok(crafted.breaches.length > 0,
      `the "${craft}" arm failed to catch the "${name}" twin — that arm exists for exactly this`);
    assert.equal(crafted.breaches[0].kind, kind,
      `expected the "${name}" twin to be caught by ${kind}, got ${crafted.breaches[0].kind}`);
    console.log(
      `  TEETH/${name}: 0/${natural.dispatches} natural, ${crafted.breaches.length}/${crafted.dispatches} ` +
        `crafted (${describe(crafted.breaches[0])})`,
    );
  });
}

/** Twins the natural captures MUST catch, each by a named half of the contract. */
const NATURAL_TWINS = [
  ["band high edge off by one", (m) => twinBody(m, { high: (x) => x > BAND_HI }), "RAM", 1],
  ["column blank dropped", (m) => twinBody(m, { blankColumn: false }), "RAM", 1],
  ["wrong protocol value", (m) => { loc_24b4(m); return true; }, "return", 1],
  // An extra pop on the return arms: RAM, SP and the return value all still agree, so pc is the
  // only thing in the contract that can see it.
  ["leaked return bracket", (m) => { const r = loc_24b4(m); if (r === true) m.pop16(); return r; }, "pc", 1153],
];

for (const [name, twin, kind, expected] of NATURAL_TWINS) {
  test(`TEETH: the "${name}" twin is caught by the natural captures, via ${kind}`, () => {
    const s = sweepAttract(twin);
    assert.ok(s.breaches.length > 0,
      `the "${name}" twin escaped all ${s.dispatches} natural captures — the gate is worthless`);
    assert.equal(s.breaches.length, expected,
      `expected the "${name}" twin to be caught on ${expected} of ${s.dispatches} dispatches, got ${s.breaches.length}`);
    for (const b of s.breaches) {
      assert.equal(b.kind, kind, `expected the "${name}" twin to be caught by ${kind}, got ${b.kind}`);
    }
    console.log(`  TEETH/${name}: ${s.breaches.length}/${s.dispatches} natural (${describe(s.breaches[0])})`);
  });
}

// -- 5. LIVE: wired live for a whole attract run -------------------------------

/**
 * Drive a whole attract run CYCLE-FREE — the frame boundary is the main loop's vblank poll, not
 * a T-state count — and sample every frame. Both sides use the same vehicle, so a cycle-free
 * rewrite shifts no interrupt and there is no cycle cost to restore.
 */
function runFramesCycleFree(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  const frames = [];
  const result = runCycleFree(m, {
    pollPCs: manifest.convergence.pollPCs,
    maxFrames: ATTRACT_FRAMES,
    stepBudget: ATTRACT_FRAMES * 200000,
    onFrame: (mm) => frames.push(Buffer.from(mm.dumpState())),
  });
  return { m, frames, result };
}

test("LIVE: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  const baseline = runFramesCycleFree(null);
  let dispatches = 0;
  const live = runFramesCycleFree(new Map([[TARGET, (m) => { dispatches++; return loc_24b4(m); }]]));

  // Without this the run can be byte-identical because the routine never executed. Measured on a
  // sibling routine: 800 frames of attract went green against a deliberately broken rewrite whose
  // first dispatch is at frame 1163.
  assert.ok(dispatches > 0, "0x24B4 was never dispatched in the live run — the arm proves nothing");
  assert.equal(dispatches, LIVE_DISPATCHES,
    `the live run dispatched 0x24B4 ${dispatches} times, not the ${LIVE_DISPATCHES} this gate claims`);

  assert.equal(baseline.result.stop, "reached maxFrames", `baseline stopped early: ${baseline.result.stop}`);
  assert.equal(live.result.stop, "reached maxFrames", `live run stopped early: ${live.result.stop}`);
  assert.equal(live.frames.length, baseline.frames.length, "the two runs did not reach the same frame count");

  for (let f = 0; f < baseline.frames.length; f++) {
    const a = baseline.frames[f];
    const b = live.frames[f];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      assert.fail(`frame ${f}: ${hx(baseline.m.stateOffsetToAddr(i))} baseline=${a[i]} live=${b[i]}`);
    }
  }
  console.log(
    `  LIVE: ${baseline.frames.length} cycle-free attract frames byte-identical with 0x24B4 wired live ` +
      `(${dispatches} dispatches) — the registers and flags the rewrite drops are read back by nobody ` +
      "attract reaches",
  );
});

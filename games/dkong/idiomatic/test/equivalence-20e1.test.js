// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_20e1 (ROM 0x20E1) — the arm that stamps a +1.0 px/frame horizontal
 * velocity onto an object record before the shared launch tail at ROM 0x20C3.
 *
 * WHAT IS COMPARED, and it is more than the usual contract. The routine tail-calls the frozen
 * oracle at ROM 0x20C3, which runs the rest of the object loop and returns through ROM 0x1F92's
 * `ret`, so BOTH sides execute byte-for-byte the same code after the two stores. That makes three
 * stronger assertions affordable than a routine which dissolves its own tail can offer, and all
 * three are made here:
 *   - RAM − STACK_SCRATCH, the standard memory-equivalence contract;
 *   - the ORACLE's and the CANDIDATE's full write sequences (address AND value, in order,
 *     STACK_SCRATCH included) must be identical — so the excluded stack window is shown not to be
 *     hiding a difference rather than assumed not to be;
 *   - the whole exit register file, SP included. This routine writes no register of its own, so
 *     anything left behind is the frozen tail's and must match exactly. There is no dead-register
 *     exclusion to defend.
 * Plus the return value. pc and cycles are NOT compared: they are what cycle-free code gives up,
 * and test 2 measures the cycle difference explicitly instead.
 *
 *   0. REACHABILITY — 0x20E1 is dispatched naturally during attract. The test measures the count,
 *      the record bases, and the entry shapes, and asserts BOTH that attract reaches this routine
 *      and that it delivers only ONE shape of entry (velocity -0x00A0, at OBJ_X 16, every time) —
 *      the honest hole the crafted cases exist to fill, asserted so it cannot quietly become
 *      coverage, and the producing line for the entry numbers the routine header quotes.
 *   1. EQUAL (captured) — EVERY captured dispatch replayed on fresh clones. No sampling: the
 *      natural count is small and test 0 asserts the capture is complete.
 *   2. CYCLES — the candidate spends exactly 48 fewer cycles than the oracle at every capture (the
 *      two stores' 19+19 and the tail jump's 10). That constant is what test 3's live run charges
 *      back, so it is measured here rather than assumed.
 *   3. LIVE (whole attract) — the live-out measurement: the candidate wired at 0x20E1 for a real
 *      4000-frame attract run, its frame trace diffed against the all-oracle baseline on every
 *      cell outside STACK_SCRATCH.
 *      ★ The oracle's 48 skipped cycles are charged back inside the override. Without that the run
 *      diverges purely because cycle-free code shifts the NMI — carried as a teeth case so the
 *      restoration cannot be dropped silently.
 *      COVERAGE: attract only. Gameplay, the other three boards and every crafted shape in test 4
 *      are NOT exercised live.
 *   4. EQUAL (crafted) — the entry shapes attract never delivers, each a real captured state with
 *      one surgical poke applied identically to both sides: the velocity already rightward, zero,
 *      a large positive whole part, and a zero fraction. Record-relativity needs no craft — the
 *      captures already span 7 distinct record bases — but one crafted base nudge is included too.
 *   5. OBSERVED EFFECT — the one test here that is NOT an equivalence check, and says so: it runs
 *      the ORACLE in plain attract and asserts the record's OBJ_X then steps +1 per frame. It
 *      grounds the routine header's role line against the real ROM's downstream behaviour, and it
 *      passes or fails regardless of what the candidate does.
 *   6. TEETH — five broken twins, each of which this contract MUST catch, plus the two
 *      pinning cases below them.
 *
 * ON THE CAPTURE HOOK AND RE-ENTRY. The tail runs the rest of the object loop, which can dispatch
 * 0x20E1 again for a later slot. A clone carries the source machine's override map, so those nested
 * dispatches resolve to the capture hook — which is disarmed once the host run is over, and which
 * delegates to the oracle. That is the callee-is-oracle isolation the unit gate wants, applied to a
 * routine that can re-enter itself: one dispatch of the candidate per comparison, oracle underneath
 * on both sides.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-20e1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_20e1 as oracle } from "../../translated/loc_20e1.js";
import { loc_20e1 } from "../loc_20e1.js";
import { Machine } from "../../machine.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { STACK_SCRATCH, OBJ_X } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x20e1;

// The record fields, mirrored from the routine under test.
const VELOCITY_X_WHOLE = 0x10;
const VELOCITY_X_FRACTION = 0x11;

// The oracle's three cycle charges the cycle-free rewrite does not spend: the two stores (19 each)
// and the tail jump (10).
const SKIPPED_CYCLES = 48;

const ATTRACT_FRAMES = 4000;
const LIVE_FRAMES = 4000;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/** First RAM byte that differs between two machines, skipping the dead STACK_SCRATCH region. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** The whole register file as a comparable string, SP included. */
const regSnapshot = (m) => REG_FIELDS.map((k) => `${k}=${m.regs[k]}`).join(" ");

/** Record every (address, value) this machine writes while `fn` runs, in order. */
function recordWrites(m, fn) {
  const writes = [];
  const base = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value) => {
    writes.push(`${addr & 0xffff}:${value & 0xff}`);
    return base(addr, value);
  };
  let ret, threw = null;
  try {
    ret = fn(m);
  } catch (e) {
    threw = e;
  }
  m.mem.write8 = base;
  return { writes, ret, threw };
}

/**
 * Run the oracle on one clone and a candidate on another, byte-identical one, and report the whole
 * contract: RAM − STACK_SCRATCH, the identical-write-sequence check, the exit register file and the
 * return value.
 */
function comparePair(entry, fn) {
  const o = entry.clone();
  const c = entry.clone();

  const ro = recordWrites(o, oracle);
  const rc = recordWrites(c, fn);

  const firstWriteDiff = (() => {
    const n = Math.min(ro.writes.length, rc.writes.length);
    for (let i = 0; i < n; i++) if (ro.writes[i] !== rc.writes[i]) return { i, a: ro.writes[i], b: rc.writes[i] };
    if (ro.writes.length !== rc.writes.length) {
      return { i: n, a: ro.writes[n] ?? "(end)", b: rc.writes[n] ?? "(end)" };
    }
    return null;
  })();

  return {
    ram: rc.threw ? null : firstRamDiff(o, c),
    writeDiff: rc.threw ? null : firstWriteDiff,
    regsO: regSnapshot(o), regsC: rc.threw ? null : regSnapshot(c),
    retO: ro.ret, retC: rc.ret,
    threw: rc.threw,
    oracleMachine: o,
  };
}

const mismatched = (r) =>
  r.threw != null || r.ram !== null || r.writeDiff !== null || r.regsO !== r.regsC || r.retO !== r.retC;

const describeMismatch = (r) =>
  r.threw ? `candidate threw: ${r.threw.message}`
    : r.ram ? `RAM@${hx(r.ram.addr)} oracle=${r.ram.a} cand=${r.ram.b}`
      : r.writeDiff ? `write #${r.writeDiff.i} (addr:value) oracle=${r.writeDiff.a} cand=${r.writeDiff.b}`
        : r.regsO !== r.regsC ? `exit registers differ:\n  oracle=${r.regsO}\n  cand  =${r.regsC}`
          : `return oracle=${r.retO} cand=${r.retC}`;

// -- 0/1. real dispatches -----------------------------------------------------

/**
 * Drive attract and clone the machine at every real 0x20E1 dispatch. The hook is DISARMED once the
 * host run finishes so that replaying a capture — whose tail can re-enter 0x20E1 for a later slot —
 * does not append to the capture list; the disarmed hook is then a plain delegate to the oracle.
 */
let ARMED = true;
function captureDispatches(frames) {
  const caps = [];
  let total = 0;
  const ov = new Map([[TARGET, (mm) => {
    if (ARMED) {
      total++;
      caps.push(mm.clone());
    }
    return oracle(mm);
  }]]);
  new Machine(ROM, { overrides: ov }).runFrames(frames);
  ARMED = false;
  return { caps, total };
}

let CAPTURED = null;
const captured = () => (CAPTURED ??= captureDispatches(ATTRACT_FRAMES));

/** The entry shape: the record's whole 16-bit velocity, whose high byte is what ROM 0x20B5 branched on. */
const shapeOf = (m) =>
  (m.mem.read8((m.regs.ix + VELOCITY_X_WHOLE) & 0xffff) << 8) |
  m.mem.read8((m.regs.ix + VELOCITY_X_FRACTION) & 0xffff);

// Attract delivers exactly this one velocity on entry (-0x00A0, i.e. leftward by 160/256 px per
// frame), and nothing else.
const SHAPES_ATTRACT_DELIVERS = [0xffa0];

// …and every dispatch arrives with the record at this OBJ_X. Both are asserted so the routine
// header's "one entry shape" hole and its observed-entry numbers have a producing line here.
const ATTRACT_ENTRY_OBJ_X = 16;

test("REACHABILITY: 0x20e1 is dispatched naturally, and attract delivers only one entry shape", () => {
  const { caps, total } = captured();
  assert.ok(total > 0, "0x20e1 should be dispatched during attract (ROM 0x20B5's tail jump)");
  assert.equal(caps.length, total, "every dispatch must be captured — this gate replays all of them");

  const bases = new Set(caps.map((e) => e.regs.ix));
  const shapes = new Set(caps.map(shapeOf));
  for (const s of SHAPES_ATTRACT_DELIVERS) {
    assert.ok(shapes.has(s), `attract was expected to deliver whole-pixel velocity ${hx(s)}, and did not`);
  }
  // The honest hole, asserted so it cannot silently become coverage.
  assert.equal(shapes.size, SHAPES_ATTRACT_DELIVERS.length,
    `attract now delivers entry shapes ${[...shapes].map(hx).join(",")} — the header's ` +
    "one-shape claim and the crafted list need updating");
  assert.ok(bases.size > 1, "the captures must span more than one record base for record-relativity");

  for (const e of caps) {
    assert.equal(e.mem.read8((e.regs.ix + OBJ_X) & 0xffff), ATTRACT_ENTRY_OBJ_X,
      `a dispatch at ${hx(e.regs.ix)} arrived at a different OBJ_X — the routine header quotes ` +
      `${ATTRACT_ENTRY_OBJ_X} for every one of them`);
  }

  console.log(`  REACHABILITY: ${total} natural dispatches in ${ATTRACT_FRAMES} attract frames; ` +
    `${bases.size} record bases (${[...bases].map(hx).join(",")}); ` +
    `entry velocity ${[...shapes].map(hx).join(",")}; entry OBJ_X ${ATTRACT_ENTRY_OBJ_X} on all ${total}`);
});

test("EQUAL (captured): loc_20e1 == oracle on every real dispatch", () => {
  const { caps, total } = captured();
  assert.ok(caps.length >= 1, "expected at least one real 0x20e1 dispatch during attract");

  for (const entry of caps) {
    const r = comparePair(entry, loc_20e1);
    assert.ok(!mismatched(r), `captured dispatch at ix=${hx(entry.regs.ix)}: ${describeMismatch(r)}`);
  }

  // Non-vacuity: the ORACLE really did stamp +1.0 px/frame onto the record, from a DIFFERENT value.
  const sample = caps[0];
  const base = sample.regs.ix;
  assert.notEqual(sample.mem.read8((base + VELOCITY_X_WHOLE) & 0xffff), 1,
    "the captured entries must not already hold the value the routine writes");
  const after = comparePair(sample, loc_20e1).oracleMachine;
  assert.equal(after.mem.read8((base + VELOCITY_X_WHOLE) & 0xffff), 1, "oracle must leave whole pixels = 1");
  assert.equal(after.mem.read8((base + VELOCITY_X_FRACTION) & 0xffff), 0, "oracle must leave the fraction = 0");

  console.log(`  EQUAL/captured: ${caps.length} of ${total} real dispatches replayed (all of them) — ` +
    "identical on RAM − STACK_SCRATCH, the whole write sequence, the exit register file and the return");
});

// -- 2. the cycle difference the live run charges back ------------------------

test("CYCLES: the rewrite spends exactly 48 fewer cycles than the oracle, at every capture", () => {
  const { caps } = captured();
  for (const entry of caps) {
    const o = entry.clone(); const before0 = o.cycles; oracle(o);
    const c = entry.clone(); const before1 = c.cycles; loc_20e1(c);
    assert.equal((o.cycles - before0) - (c.cycles - before1), SKIPPED_CYCLES,
      `cycle delta at ix=${hx(entry.regs.ix)} is not the two stores plus the tail jump`);
  }
  console.log(`  CYCLES: ${caps.length} captures, delta ${SKIPPED_CYCLES} every time — the constant the LIVE run charges`);
});

// -- 3. LIVE (whole attract): the live-out measurement ------------------------

let BASELINE = null;
function baselineFrames() {
  if (!BASELINE) {
    const m = new Machine(ROM);
    m.runFrames(LIVE_FRAMES);
    BASELINE = m.frames;
  }
  return BASELINE;
}

/**
 * Run attract with `fn` wired at 0x20E1. `charge` restores the cycles the cycle-free rewrite does
 * not spend, at the machine's current PC so the charge cannot itself move the PC.
 */
function liveRun(fn, { charge = true } = {}) {
  let calls = 0;
  const ov = new Map([[TARGET, (mm) => {
    calls++;
    const r = fn(mm);
    if (charge) mm.step(mm.pc, SKIPPED_CYCLES);
    return r;
  }]]);
  const m = new Machine(ROM, { overrides: ov });
  m.runFrames(LIVE_FRAMES);
  return { frames: m.frames, calls };
}

/**
 * The state-offset -> RAM-address table for the trace diff. Built with Array.from, NOT
 * `dumpState().map(...)`: dumpState returns a Uint8Array, whose map truncates every address to a
 * byte and would mis-classify which bytes are in STACK_SCRATCH.
 */
function addressTable() {
  const probe = new Machine(ROM);
  return Array.from(probe.dumpState(), (_, i) => probe.stateOffsetToAddr(i));
}

/** First (frame, address) where two traces differ outside STACK_SCRATCH. */
function firstTraceDiff(a, b, addrOf) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const A = a[i], B = b[i];
    for (let j = 0; j < A.length; j++) {
      if (A[j] !== B[j] && !inStack(addrOf[j])) return { frame: i, addr: addrOf[j], a: A[j], b: B[j] };
    }
  }
  return null;
}

test("LIVE: wired at 0x20e1 for a whole attract run, the trace is identical to the oracle's", () => {
  const base = baselineFrames();
  const addrOf = addressTable();

  const live = liveRun(loc_20e1);
  assert.ok(live.calls > 0, "the wired routine must actually be dispatched");
  const diff = firstTraceDiff(base, live.frames, addrOf);
  assert.equal(diff, null,
    diff && `live attract diverged at frame ${diff.frame}, ${hx(diff.addr)}: oracle=${diff.a} cand=${diff.b}`);
  assert.equal(live.frames.length, base.length, "the wired run must reach the same frame budget");

  console.log(`  LIVE: ${live.calls} dispatches over ${LIVE_FRAMES} attract frames — ` +
    "byte-identical to the all-oracle baseline outside STACK_SCRATCH");
});

test("LIVE TEETH: dropping the oracle's cycle cost DOES move the trace (so the charge is load-bearing)", () => {
  const base = baselineFrames();
  const addrOf = addressTable();

  const uncharged = liveRun(loc_20e1, { charge: false });
  const diff = firstTraceDiff(base, uncharged.frames, addrOf);
  assert.notEqual(diff, null,
    "an uncharged cycle-free run was expected to shift the NMI and diverge; it did not, which means " +
    "the LIVE test's cycle restoration is not what is making it pass and the comparison may be inert");
  console.log(`  LIVE TEETH: uncharged, the run diverges at frame ${diff.frame}, ${hx(diff.addr)} ` +
    "— a timing artifact, which is exactly why the LIVE test charges the 48 cycles back");
});

// -- 4. EQUAL (crafted): the entry shapes attract never delivers --------------

// Each case is a REAL captured state with one surgical poke, applied identically on both sides.
const CRAFTED = [
  { name: "already rightward: whole 1, fraction 0", poke: { whole: 0x01, fraction: 0x00 } },
  { name: "whole-pixel byte 1, fraction nonzero", poke: { whole: 0x01, fraction: 0x80 } },
  { name: "large positive whole part", poke: { whole: 0x7f, fraction: 0xff } },
  { name: "leftward by a whole pixel", poke: { whole: 0xff, fraction: 0x00 } },
  { name: "fraction already zero, whole leftward", poke: { whole: 0xfe, fraction: 0x00 } },
  // Zero is the shape ROM 0x20B5 keeps for ITSELF (its branch is `nonzero -> here`), so this arm
  // cannot be reached with it in play. Included anyway: nothing in THIS routine tests the byte.
  { name: "velocity zero — a shape the caller never routes here", poke: { whole: 0x00, fraction: 0x00 } },
];

function craft(entry, poke, ix = entry.regs.ix) {
  const e = entry.clone();
  e.regs.ix = ix;
  e.mem.write8((ix + VELOCITY_X_WHOLE) & 0xffff, poke.whole);
  e.mem.write8((ix + VELOCITY_X_FRACTION) & 0xffff, poke.fraction);
  return e;
}

const craftedEntries = () => {
  const { caps } = captured();
  const list = CRAFTED.map((c) => ({ name: c.name, entry: craft(caps[0], c.poke) }));
  // One nudged record base as well, on top of the 7 the captures already span.
  const other = (caps[0].regs.ix + 0x20) & 0xffff;
  list.push({ name: `nudged record base ${hx(other)}`, entry: craft(caps[0], { whole: 0xff, fraction: 0xa0 }, other) });
  return list;
};

test("EQUAL (crafted): every entry shape attract never delivers matches the oracle", () => {
  for (const { name, entry } of craftedEntries()) {
    const r = comparePair(entry, loc_20e1);
    assert.ok(!mismatched(r), `${name}: ${describeMismatch(r)}`);
    // Non-vacuity: the oracle really wrote the pair, at THIS record base.
    const base = entry.regs.ix;
    assert.equal(r.oracleMachine.mem.read8((base + VELOCITY_X_WHOLE) & 0xffff), 1, `${name}: oracle whole pixels`);
    assert.equal(r.oracleMachine.mem.read8((base + VELOCITY_X_FRACTION) & 0xffff), 0, `${name}: oracle fraction`);
  }
  console.log(`  EQUAL/crafted: ${craftedEntries().length} shapes — already-rightward, a nonzero fraction, ` +
    "a large positive whole part, both leftward forms, zero, and a nudged record base");
});

test("RECORD-RELATIVE: the write follows the record pointer, not a fixed address", () => {
  const { caps } = captured();
  const bases = [...new Set(caps.map((e) => e.regs.ix))];
  assert.ok(bases.length > 1, "needs captures at more than one record base");
  for (const b of bases) {
    const entry = caps.find((e) => e.regs.ix === b);
    const r = comparePair(entry, loc_20e1);
    assert.ok(!mismatched(r), `base ${hx(b)}: ${describeMismatch(r)}`);
    assert.equal(r.oracleMachine.mem.read8((b + VELOCITY_X_WHOLE) & 0xffff), 1,
      `base ${hx(b)}: the oracle's write must land on THIS record`);
  }
  console.log(`  RECORD-RELATIVE: ${bases.length} distinct record bases (${bases.map(hx).join(",")}), each matched`);
});

test("OBSERVED EFFECT (oracle only, not an equivalence check): after the routine, the record's OBJ_X climbs by exactly one pixel per frame", () => {
  // The prediction the role line makes — a +1.0 px/frame horizontal velocity — checked downstream,
  // in a plain attract run, on the cell the velocity is supposed to drive. This runs the ORACLE, so
  // it is grounding for the header, not a gate on the candidate: breaking the candidate cannot make
  // it fail, and it is not counted as part of the equivalence contract.
  const events = [];
  const ov = new Map([[TARGET, (mm) => {
    events.push({ frame: mm.frames.length, ix: mm.regs.ix });
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: ov });
  host.runFrames(ATTRACT_FRAMES);
  assert.ok(events.length > 0, "expected natural dispatches to observe");

  const probe = new Machine(ROM);
  const offsetOf = new Map();
  const n = probe.dumpState().length;
  for (let i = 0; i < n; i++) offsetOf.set(probe.stateOffsetToAddr(i), i);

  const SPAN = 10;
  for (const e of events) {
    const off = offsetOf.get((e.ix + OBJ_X) & 0xffff);
    const xs = [];
    for (let f = e.frame; f < Math.min(e.frame + SPAN, host.frames.length); f++) xs.push(host.frames[f][off]);
    for (let i = 1; i < xs.length; i++) {
      assert.equal(xs[i], (xs[0] + i) & 0xff,
        `after the dispatch at frame ${e.frame} on ${hx(e.ix)}, OBJ_X went [${xs.join(",")}] — ` +
        "not one pixel per frame, so the +1.0 px/frame reading in the routine header is wrong");
    }
  }
  console.log(`  OBSERVED EFFECT: ${events.length} dispatches, each followed by ${SPAN} frames of ` +
    "OBJ_X stepping +1/frame — the role line's downstream prediction, confirmed");
});

// -- 5. TEETH -----------------------------------------------------------------

/** (a) the two bytes swapped: 0x0001 (1/256 px/frame) instead of 0x0100. */
function brokenSwappedBytes(m) {
  const { mem8 } = m;
  const at = (d) => (m.regs.ix + d) & 0xffff;
  mem8[at(VELOCITY_X_WHOLE)] = 0;
  mem8[at(VELOCITY_X_FRACTION)] = 1;
  return m.call(0x20c3);
}

/** (b) the fraction store dropped, leaving whatever the record arrived with. */
function brokenNoFractionStore(m) {
  const { mem8 } = m;
  const at = (d) => (m.regs.ix + d) & 0xffff;
  mem8[at(VELOCITY_X_WHOLE)] = 1;
  return m.call(0x20c3);
}

/** (c) the mirror value — the other arm's leftward velocity. */
function brokenMirrorValue(m) {
  const { mem8 } = m;
  const at = (d) => (m.regs.ix + d) & 0xffff;
  mem8[at(VELOCITY_X_WHOLE)] = 0xff;
  mem8[at(VELOCITY_X_FRACTION)] = 0;
  return m.call(0x20c3);
}

/** (d) the tail dropped: the two stores land but the launch tail never runs. */
function brokenNoTail(m) {
  const { mem8 } = m;
  const at = (d) => (m.regs.ix + d) & 0xffff;
  mem8[at(VELOCITY_X_WHOLE)] = 1;
  mem8[at(VELOCITY_X_FRACTION)] = 0;
}

/** (e) the write goes to a fixed address instead of following the record pointer. */
function brokenFixedAddress(m) {
  const { mem8 } = m;
  mem8[0x6710] = 1;
  mem8[0x6711] = 0;
  return m.call(0x20c3);
}

test("TEETH: five broken twins are all CAUGHT by the captured + crafted entries", () => {
  const { caps } = captured();
  const entries = [
    ...craftedEntries(),
    ...caps.map((e) => ({ name: `a real attract dispatch at ${hx(e.regs.ix)}`, entry: e })),
  ];
  const hunt = (fn) => {
    for (const { name, entry } of entries) {
      const r = comparePair(entry, fn);
      if (mismatched(r)) return { name, r };
    }
    return null;
  };

  const twins = {
    "swapped-bytes": brokenSwappedBytes,
    "fraction-store-dropped": brokenNoFractionStore,
    "mirror-value": brokenMirrorValue,
    "tail-dropped": brokenNoTail,
    "fixed-address": brokenFixedAddress,
  };
  for (const [label, fn] of Object.entries(twins)) {
    const hit = hunt(fn);
    assert.notEqual(hit, null, `the ${label} twin ESCAPED — the gate proves nothing`);
    console.log(`  TEETH/${label}: caught on ${hit.name} — ${describeMismatch(hit.r)}`);
  }

  // WHICH half of the contract catches the dropped fraction store, pinned both ways. On an entry
  // arriving with a nonzero fraction the store is value-carrying, so the RAM diff sees it. On an
  // entry whose fraction is ALREADY 0 the store changes no byte, RAM is identical, and only the
  // write-sequence comparison notices the missing write — which is what that comparison is for.
  const nonZeroFraction = craftedEntries().find((c) => c.name === "whole-pixel byte 1, fraction nonzero");
  const loud = comparePair(nonZeroFraction.entry, brokenNoFractionStore);
  assert.notEqual(loud.ram, null, "with a nonzero fraction on entry, the dropped store must show up in RAM");

  const zeroFraction = craftedEntries().find((c) => c.name === "already rightward: whole 1, fraction 0");
  const quiet = comparePair(zeroFraction.entry, brokenNoFractionStore);
  assert.equal(quiet.ram, null, "with the fraction already 0 the dropped store leaves RAM identical");
  assert.notEqual(quiet.writeDiff, null,
    "…and the write-sequence comparison must be what catches it there — otherwise a value-neutral " +
    "dropped store would pass this gate");
  console.log("  TEETH/value-neutral: a dropped store that changes no byte is caught by the " +
    "write-sequence comparison alone, which is why that comparison is in the contract");
});

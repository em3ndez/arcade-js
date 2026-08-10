// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_44c9 — memory-equivalent to the frozen oracle at ROM 0x44C9.
 *
 * An arm, not an entry: control arrives by a branch with an object record, a sprite entry and a
 * counter in hand. It masks the counter, may zero the record's counter cell, writes both attribute
 * slots of the sprite entry, and falls through into the two-frame flutter at ROM 0x44DC (already
 * decompiled). The rewrite calls loc_44dc directly; dissolving that fall-through is this unit.
 *
 * NOTHING REACHES IT ON EITHER TAPE, measured here: the REACH arm counts ZERO dispatches over 2500
 * frames of both sessions, with a positive control in the same run — the identical collector counts
 * the routine that seats this object's cursors and reports a four-figure number. So the zero is the
 * tapes, not the instrument. Every comparison runs on a CRAFTED entry — a real captured machine
 * with the branch's three arrived-with values poked in — and there is no whole-machine arm because
 * there is no dispatch to wire.
 *
 * THE LIVE-OUT IS DERIVED FROM THE ORACLE. Its only exit is the fall-through, and the routine it
 * falls into returns past this arm (the branch parked nothing), landing on the return address the
 * branch's caller laid down. Read off that frozen successor: its first two instructions load the
 * accumulator from the record and set flags from it, and it loads all four scratch bytes before
 * reading any — which is why the rewrite lets those six go. What it DOES read on arrival is the two
 * cursors, and those the rewrite leaves exactly as found.
 *
 * THE SUCCESSOR ARM continues both sides through the frozen successor and compares memory. Its
 * power is MEASURED by clobbering each register in turn: it reports the two cursors and NOTHING
 * ELSE. So it is the evidence for the cursors being live and held; it is BLIND to the six the
 * rewrite drops, whose deadness rests on the reading above.
 *
 * NO STACK IS MASKED: the oracle pushes nothing on this path, so the comparison is the WHOLE dump.
 * The NO SCRATCH arm instruments the oracle's own `push16` over the whole sweep and requires zero,
 * with a control that the same instrument reports nonzero when a push happens. SP and pc belong to
 * the dispatch seam: the oracle nets one return, the rewrite performs none, so the candidate is run
 * through `withOmittedRet` and SP and pc compared for EQUALITY.
 *
 * WHY THE CRAFTED ENTRIES ARE POISONED: every cell this arm writes already holds the value it is
 * about to be given on a real machine, so an unpoisoned comparison would pass a rewrite that wrote
 * nothing there. Measured: three twins below are caught on ZERO entries without the marker.
 *
 * HOLE: no natural dispatch anywhere; the cursor pairs and counters are poked onto real machines,
 * so the machines are real, the register triple is not.
 * HOLE: the SUCCESSOR arm runs ONE successor — the one the branch's caller returns into. A path
 * reaching this arm from elsewhere would return elsewhere; it is the only inbound branch transcribed.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-44c9.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { withOmittedRet } from "../../machine.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_44c9 } from "../loc_44c9.js";
import { loc_44dc } from "../loc_44dc.js";
import { loc_44c9 as oracle } from "../../translated/loc_44c9.js";
import { loc_43f0_46f0 as successor } from "../../translated/loc_43f0.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x44c9;
/** The entry the sessions DO reach, which seats this object's cursors further down its own chain. */
const CONTROL_ENTRY = 0x43b7;

const CORPUS_FRAMES = 2500;
const SESSIONS = [["coin-start", {}], ["demo", { tape: [] }]];

/** Measured over CORPUS_FRAMES: this arm's count, and the control entry's, from the SAME run. */
const DISPATCHES = { "coin-start": 0, demo: 0 };
const CONTROL_DISPATCHES = { "coin-start": 863, demo: 1379 };

/** Real captured machines taken from each session, spaced across it. */
const BASES_PER_SESSION = 3;
const BASE_SPACING = 200;

/** Cursor pairs the crafted entries use: the object this arm's own caller seats, then neighbours. */
const PAIRS = [[0xa8a0, 0xaa24], [0xa850, 0xaa1a], [0xa890, 0xaa22], [0xa8b0, 0xaa26]];
const COUNTERS = Array.from({ length: 256 }, (_u, i) => i);

const COUNTER_SLOT = 6;
const ATTRIBUTE_SLOTS = [0x30, 0x32];
const SHAPE_SLOTS = [1, 3];
const ATTRIBUTE = 0x51;
const SELECTOR_BIT = 0x80;
const RESTART_AT = 3;

/** No code this arm can lay down, so every cell it writes is visible against it. */
const POISON = 0x5a;

/** The cells the successor arm needs alive, and the sweep it runs over. */
const RECORD_STATE = 0xff;
const SUCCESSOR_GUARD = 0xa817;
const SUCCESSOR_COUNTERS = [0x00, 0x02, 0x03, 0x7f, 0x80, 0x82, 0x83, 0xff];
/** Measured: which registers the successor arm can SEE moved, and on how many of its entries. */
const SUCCESSOR_POWER = { ix: 8, iy: 160 };
const SUCCESSOR_ENTRIES = 384;

/**
 * A CEILING on the registers that may differ, not a pin: asserted as a subset, so a rewrite that
 * happens to agree on one of these still passes. What is asserted positively is HELD.
 */
const MAY_MOVE = ["a", "f", "d", "e", "h", "l"];
const HELD = ["b", "c", "ix", "iy", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d === null || d === undefined ? "identical" : `${d.key ?? hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}`;

const seam = (candidate) => withOmittedRet(candidate, TARGET);

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Oracle vs candidate on clones of one machine, over the WHOLE dump — nothing is masked here. */
function diffOf(candidate, machine) {
  const before = machine.dumpState();
  const a = machine.clone();
  const b = machine.clone();
  let faultA = null;
  let faultB = null;
  try { oracle(a); } catch (e) { faultA = e.constructor.name; }
  try { seam(candidate)(b); } catch (e) { faultB = e.constructor.name; }
  if (faultA !== null || faultB !== null) {
    return { faulted: true, faultA, faultB, raw: [], moved: [], informative: false,
      caught: faultA !== faultB, spDiff: null, pcDiff: null };
  }
  const raw = allDiffs(a, b);
  const da = a.dumpState();
  let informative = false;
  for (let i = 0; i < da.length; i++) if (da[i] !== before[i]) { informative = true; break; }
  const spDiff = a.regs.sp !== b.regs.sp ? { key: "sp", a: a.regs.sp, b: b.regs.sp } : null;
  const pcDiff = a.pc !== b.pc ? { key: "pc", a: a.pc, b: b.pc } : null;
  return {
    faulted: false, faultA, faultB, raw, informative,
    moved: REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    spDiff, pcDiff,
    caught: raw.length > 0 || spDiff !== null || pcDiff !== null,
  };
}

/** How far below its seat a function's own pushes take the stack pointer, on one machine. */
function pushDepth(fn, machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  try { fn(c); } catch { /* a faulting run still pushed whatever it pushed */ }
  return seat - deepest;
}

// ── the sessions, and the crafted entries taken out of them ─────────────────────────────

let reachCache = null;
function reach() {
  if (reachCache) return reachCache;
  reachCache = new Map();
  const bases = [];
  for (const [label, opts] of SESSIONS) {
    let here = 0;
    let control = 0;
    const keep = TRANSLATED.get(CONTROL_ENTRY);
    const m = makeMachine(new Map([
      [TARGET, (mm) => { here++; return oracle(mm); }],
      [CONTROL_ENTRY, (mm) => {
        // The SAME collector shape as the one above, in the SAME run, on an entry that is reached.
        if (control % BASE_SPACING === 0 && bases.length < BASES_PER_SESSION * SESSIONS.length) {
          bases.push([label, mm.clone()]);
        }
        control++;
        return keep(mm);
      }],
    ]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} session stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, `the ${label} session ran short`);
    reachCache.set(label, { here, control });
  }
  reachCache.set("bases", bases.slice(0, BASES_PER_SESSION * SESSIONS.length));
  return reachCache;
}

const bases = () => reach().get("bases");

/**
 * A real captured machine with the register triple the branch would have arrived with, and every
 * cell this arm writes filled with a marker first. Both halves are needed: on a real machine those
 * cells already hold what the arm is about to write, so without the marker a rewrite that skipped
 * them would pass.
 */
function craft(base, pair, counter) {
  const m = base.clone();
  m.regs.ix = pair[0];
  m.regs.iy = pair[1];
  m.regs.c = counter;
  m.mem8[pair[0] + COUNTER_SLOT] = POISON;
  m.mem8[pair[0] + COUNTER_SLOT + 1] = POISON;
  for (const slot of [...ATTRIBUTE_SLOTS, ...SHAPE_SLOTS]) m.mem8[pair[1] + slot] = POISON;
  return m;
}

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  crossCache = [];
  for (const [label, base] of bases()) {
    for (const pair of PAIRS) {
      for (const counter of COUNTERS) crossCache.push({ label, base, pair, counter });
    }
  }
  return crossCache;
}

const craftedCaught = (twin) =>
  cross().filter((c) => diffOf(twin, craft(c.base, c.pair, c.counter)).caught).length;

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the counter cell is put back one step later than it should be. */
function brokenLateRestart(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT + 1) m.mem8[(record + COUNTER_SLOT) & 0xffff] = 0;
  for (const slot of ATTRIBUTE_SLOTS) m.mem8[(sprite + slot) & 0xffff] = ATTRIBUTE;
  return loc_44dc(m, sprite);
}

/** BUG: the bit that selected this path is left in the counter, so the test is always met. */
function brokenKeepsSelectorBit(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if (counter >= RESTART_AT) m.mem8[(record + COUNTER_SLOT) & 0xffff] = 0;
  for (const slot of ATTRIBUTE_SLOTS) m.mem8[(sprite + slot) & 0xffff] = ATTRIBUTE;
  return loc_44dc(m, sprite);
}

/** BUG: the neighbouring cell of the record is cleared instead of the counter. */
function brokenWrongCounterSlot(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT) m.mem8[(record + COUNTER_SLOT + 1) & 0xffff] = 0;
  for (const slot of ATTRIBUTE_SLOTS) m.mem8[(sprite + slot) & 0xffff] = ATTRIBUTE;
  return loc_44dc(m, sprite);
}

/** BUG: only the first attribute slot is written, so the second sprite keeps whatever it had. */
function brokenOneAttribute(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT) m.mem8[(record + COUNTER_SLOT) & 0xffff] = 0;
  m.mem8[(sprite + ATTRIBUTE_SLOTS[0]) & 0xffff] = ATTRIBUTE;
  return loc_44dc(m, sprite);
}

/** BUG: a different attribute code goes into both slots. */
function brokenWrongAttribute(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT) m.mem8[(record + COUNTER_SLOT) & 0xffff] = 0;
  for (const slot of ATTRIBUTE_SLOTS) m.mem8[(sprite + slot) & 0xffff] = ATTRIBUTE + 1;
  return loc_44dc(m, sprite);
}

/** BUG: the fall-through is dropped, so no shape is chosen. */
function brokenSkipsTheFlutter(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT) m.mem8[(record + COUNTER_SLOT) & 0xffff] = 0;
  for (const slot of ATTRIBUTE_SLOTS) m.mem8[(sprite + slot) & 0xffff] = ATTRIBUTE;
}

/** BUG: the flutter is given the neighbouring sprite entry. */
function brokenFlutterOnTheNeighbour(m, counter = m.regs.c, record = m.regs.ix, sprite = m.regs.iy) {
  if ((counter & ~SELECTOR_BIT) >= RESTART_AT) m.mem8[(record + COUNTER_SLOT) & 0xffff] = 0;
  for (const slot of ATTRIBUTE_SLOTS) m.mem8[(sprite + slot) & 0xffff] = ATTRIBUTE;
  return loc_44dc(m, (sprite + 2) & 0xffff);
}

/** NOT A TWIN OF THIS ROUTINE: the positive control for the held-register instrument. */
function clobbersAHeldRegister(m) {
  loc_44c9(m);
  m.regs.b = (m.regs.b + 1) & 0xff;
}

/** The rewrite with one register nudged afterwards: the SUCCESSOR arm's power probe. */
function nudges(reg) {
  const wide = reg === "ix" || reg === "iy";
  return (m) => {
    loc_44c9(m);
    m.regs[reg] = (m.regs[reg] + (wide ? 16 : 1)) & (wide ? 0xffff : 0xff);
  };
}

/** Measured over the crafted cross. */
const TWINS = [
  ["no-op", brokenNoOp, 6144],
  ["late-restart", brokenLateRestart, 48],
  ["keeps-selector-bit", brokenKeepsSelectorBit, 72],
  ["wrong-counter-slot", brokenWrongCounterSlot, 6000],
  ["one-attribute", brokenOneAttribute, 6144],
  ["wrong-attribute", brokenWrongAttribute, 6144],
  ["skips-the-flutter", brokenSkipsTheFlutter, 6144],
  ["flutter-on-the-neighbour", brokenFlutterOnTheNeighbour, 6144],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: nothing reaches this arm on either tape, and the collector is shown able to count", { skip }, () => {
  for (const [label] of SESSIONS) {
    const r = reach().get(label);
    assert.equal(r.here, DISPATCHES[label], `the ${label} session's count for this arm moved`);
    // POSITIVE CONTROL, same breath, same run, same collector shape: an absence is evidence only
    // once the instrument has been shown able to report a presence.
    assert.equal(r.control, CONTROL_DISPATCHES[label],
      `the ${label} control count moved, so the zero above rests on an instrument nobody checked`);
    assert.ok(r.control > 0, `${label}: the control entry was not reached either, so the zero for ` +
      "this arm says nothing about the arm");
    console.log(`  REACH/${label}: this arm ${r.here} dispatches; the same collector counts ` +
      `${r.control} at the entry that seats this object's cursors`);
  }
  assert.equal(bases().length, BASES_PER_SESSION * SESSIONS.length, "the crafted bases moved");
  console.log(`  REACH: ${bases().length} real machines captured to craft entries from`);
});

test("EQUAL on a crafted entry: the whole dump, SP and pc identical", { skip }, () => {
  const c = cross()[0];
  const m = craft(c.base, c.pair, SELECTOR_BIT | RESTART_AT);
  const r = diffOf(loc_44c9, m);
  assert.equal(r.faultA, null, `the oracle faulted (${r.faultA})`);
  assert.equal(r.faultB, null, `the rewrite faulted (${r.faultB})`);
  assert.deepEqual(r.raw, [], `${show(r.raw[0])}`);
  assert.equal(r.spDiff, null, "the stack pointer must come back to the same seat");
  assert.equal(r.pcDiff, null, "the seam must land pc where the caller's slot pointed");
  assert.ok(r.informative, "the oracle wrote nothing at this entry, so the comparison has no power");
  console.log(`  EQUAL: pair ${hex4(c.pair[0])}/${hex4(c.pair[1])}, whole dump identical, ` +
    "stack scratch included");
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same comparison", { skip }, () => {
  const c = cross()[0];
  const r = diffOf(brokenNoOp, craft(c.base, c.pair, SELECTOR_BIT | RESTART_AT));
  assert.ok(r.caught, "the comparison passed a candidate that does nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(r.raw[0])}`);
});

test("NO SCRATCH: the oracle pushes nothing here, measured, with a control", { skip }, () => {
  let deepest = 0;
  for (const c of cross()) deepest = Math.max(deepest, pushDepth(oracle, craft(c.base, c.pair, c.counter)));
  // POSITIVE CONTROL, same breath: a zero from a depth instrument is worthless until the same
  // instrument has been seen reporting a push.
  const probe = (mm) => { mm.push16(0x1234); oracle(mm); mm.pop16(); };
  const control = pushDepth(probe, craft(cross()[0].base, cross()[0].pair, 0));
  assert.ok(control > 0, "the depth instrument reports zero even for a run that pushes, so the " +
    "zero below is a property of the instrument rather than of the oracle");
  assert.equal(deepest, 0, `the oracle now reaches ${deepest} bytes below its seat, so this file ` +
    "compares stack scratch it can no longer justify comparing");
  console.log(`  NO SCRATCH: oracle depth ${deepest} over ${cross().length} entries; the same ` +
    `instrument reports ${control} for a run that pushes`);
});

test("CROSS: every crafted entry is identical", { skip }, () => {
  let informative = 0;
  for (const c of cross()) {
    const r = diffOf(loc_44c9, craft(c.base, c.pair, c.counter));
    assert.equal(r.faulted, false, `${c.label} ${hex4(c.pair[0])} counter ${c.counter}: ` +
      `${r.faultA} on one side, ${r.faultB} on the other`);
    assert.deepEqual(r.raw, [], `${c.label} ${hex4(c.pair[0])} counter ${c.counter}: ${show(r.raw[0])}`);
    assert.equal(r.spDiff, null, "the seam left SP adrift");
    assert.equal(r.pcDiff, null, "the seam left pc adrift");
    if (r.informative) informative++;
  }
  assert.ok(informative > 0, "no crafted entry wrote anything, so `identical` here is a comparison " +
    "with no power rather than a result");
  console.log(`  CROSS: ${cross().length} crafted entries identical, ${informative} informative`);
});

test("BOTH ARMS: the counter's two branches are exercised and really differ", { skip }, () => {
  const c = cross()[0];
  const [record] = c.pair;
  const PRIOR = 0x5a;
  const outcome = (counter) => {
    const m = craft(c.base, c.pair, counter);
    m.mem8[record + COUNTER_SLOT] = PRIOR;
    oracle(m);
    return m.mem8[record + COUNTER_SLOT];
  };
  const below = outcome(SELECTOR_BIT | (RESTART_AT - 1));
  const at = outcome(SELECTOR_BIT | RESTART_AT);
  assert.equal(below, PRIOR, "below the mark the counter cell must be left as it was found");
  assert.equal(at, 0, "at the mark the counter cell must be put back to zero");
  assert.notEqual(below, at, "the two branches leave the same memory, so no twin that confuses " +
    "them could ever be caught and this file's threshold is untested");
  let cleared = 0;
  for (const counter of COUNTERS) if (outcome(counter) === 0) cleared++;
  console.log(`  BOTH ARMS: below the mark leaves ${PRIOR}, at the mark leaves 0; ${cleared} of ` +
    `${COUNTERS.length} counter values clear the cell`);
});

/** Both sides continued through the frozen successor; the resulting memory difference. */
function throughSuccessor(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  seam(candidate)(b);
  let faultA = null;
  let faultB = null;
  try { successor(a); } catch (e) { faultA = e.constructor.name; }
  try { successor(b); } catch (e) { faultB = e.constructor.name; }
  if (faultA !== null || faultB !== null) return faultA === faultB ? [] : [{ key: "fault", a: faultA, b: faultB }];
  return allDiffs(a, b);
}

/** The successor arm's own sweep: crafted entries, with the successor's guards opened on half. */
function successorSweep() {
  const out = [];
  for (const [, base] of bases()) {
    for (const pair of PAIRS) {
      for (const counter of SUCCESSOR_COUNTERS) {
        for (const alive of [false, true]) {
          const m = craft(base, pair, counter);
          if (alive) {
            m.mem8[pair[0]] = RECORD_STATE;
            m.mem8[SUCCESSOR_GUARD] = 0;
          }
          out.push(m);
        }
      }
    }
  }
  return out;
}

test("SUCCESSOR: both sides agree through the frozen successor, with its power measured", { skip }, () => {
  const sweep = successorSweep();
  assert.equal(sweep.length, SUCCESSOR_ENTRIES, "the successor sweep changed size");
  let wrote = 0;
  let clean = 0;
  for (const m of sweep) {
    const before = m.dumpState();
    const a = m.clone();
    oracle(a);
    try { successor(a); } catch { /* both sides are compared for the same fault below */ }
    const after = a.dumpState();
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) { wrote++; break; }
    if (throughSuccessor(loc_44c9, m).length) clean++;
  }
  assert.equal(wrote, sweep.length, "the successor wrote nothing on some entry, so the comparison " +
    "there has no power");
  assert.equal(clean, 0, `the successor parted company on ${clean} entries`);
  // POWER, MEASURED, same breath: nudge each register in turn and count what this arm can SEE. A
  // zero column is a register the arm is BLIND to, and saying so is the point — an absence is only
  // evidence where the instrument was shown able to report a presence.
  const seen = {};
  for (const reg of [...MAY_MOVE, ...HELD.filter((k) => k !== "sp")]) {
    seen[reg] = sweep.filter((m) => throughSuccessor(nudges(reg), m).length > 0).length;
  }
  console.log(`  SUCCESSOR: ${sweep.length} entries, all informative, ${clean} disagreements; ` +
    `power ${Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  for (const [reg, count] of Object.entries(SUCCESSOR_POWER)) {
    assert.equal(seen[reg], count, `the successor arm's sensitivity to ${reg} moved, so what this ` +
      "arm is evidence for has changed");
    assert.ok(count > 0, `the arm cannot see ${reg} moved, so it proves nothing about it`);
  }
  assert.deepEqual(
    Object.keys(seen).filter((k) => seen[k] > 0).sort(),
    Object.keys(SUCCESSOR_POWER).sort(),
    "the set of registers this arm can see changed; the header's account of what it covers is " +
      "now wrong in one direction or the other",
  );
});

test("EXCLUDED: the registers that move, bounded by a ceiling; the cursors are held", { skip }, () => {
  const moved = new Set();
  for (const c of cross()) {
    for (const k of diffOf(loc_44c9, craft(c.base, c.pair, c.counter)).moved) moved.add(k);
  }
  const list = REG_FIELDS.filter((k) => moved.has(k));
  console.log(`  EXCLUDED (measured): ${list.join(", ")} — ceiling ${MAY_MOVE.join(", ")}`);
  // A CEILING, never `deepEqual`: an equality here would DEMAND the divergence and go red on a
  // rewrite that became register-exact.
  assert.deepEqual(list.filter((k) => !MAY_MOVE.includes(k)), [], "a register outside the ceiling moved");
  for (const k of HELD) assert.ok(!moved.has(k), `a register asserted held moved (${k})`);
  const control = new Set(
    diffOf(clobbersAHeldRegister, craft(cross()[0].base, cross()[0].pair, 0)).moved,
  );
  assert.ok(control.has("b"), "the register instrument cannot see a held register being clobbered, " +
    "so the assertion above proves nothing");
  console.log(`  EXCLUDED control: the same instrument reports ${[...control].join(", ")} on a clobbered twin`);
});

for (const [label, twin, crafted] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = craftedCaught(twin);
    assert.ok(caught > 0, `the crafted cross missed the ${label} twin everywhere`);
    assert.equal(caught, crafted, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${cross().length} crafted entries`);
  });
}

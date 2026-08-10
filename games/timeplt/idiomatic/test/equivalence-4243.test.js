// SPDX-License-Identifier: GPL-3.0-only
/**
 * launchAttackerIntoFreeSlot — memory-equivalent to the frozen oracle at ROM 0x4243.
 * GATE: real coin-start dispatches replayed with the whole launcher chain running underneath, plus
 *   crafted entries forcing every internal exit and both dispatch targets, compared on the whole
 *   dump outside the dead stack scratch and then on registers against a measured ceiling. The frozen
 *   side rets where the rewrite returns, so SP drifts and the pushes below the seat are masked; the
 *   floor is watched off the frozen side's own pushes and asserted above the game data. Teeth: seven
 *   twins, six caught in memory and one register-only control.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4243.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { launchAttackerIntoFreeSlot } from "../launchAttackerIntoFreeSlot.js";
import { loc_4243 as oracle } from "../../translated/loc_4243.js";
import { setTheLaunchFacingInsideOneAimWindow } from "../setTheLaunchFacingInsideOneAimWindow.js";
import { loc_42b7 } from "../loc_42b7.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x4243;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FRAME = 0xa980;
const COOLDOWN = 0xa8f4;
const SLOT_COUNT = 0xa8c6;
const RECORD_BASE = 0xa8c0;
const MARGIN = 0xa8d6;
const ERA = 0xad04;
const WINDOW_HALF = 0xa8e6;
const PHASE = 0x0f;
const FACING = 0x02;
const PHASE_BIAS = 5;

const DATA_TOP = 0xadff;
const MOVED = ["a", "a_", "b", "c", "d", "e", "f", "h", "l", "sp"];
const CAP = 400;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "registers" : hex4(d.addr)}: oracle=${d.a} rewrite=${d.b}` : "identical";

// ── captures and crafted entries ────────────────────────────────────────────────────────────

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  captured = entries;
  return captured;
}

function seed() {
  return capture()[0].clone();
}
function passFrame(mm) {
  mm.mem8[(mm.regs.ix + PHASE) & 0xffff] = (mm.mem8[FRAME] & 7) + PHASE_BIAS;
}

/** A dispatch to one era: frame open, cooldown expired, first slot free, no distance margin. The
 * era-0 window is opened so control reaches the launcher, and two facing bytes are made distinct. */
function craftDispatch(era) {
  const e = seed();
  const { mem8, regs } = e;
  passFrame(e);
  mem8[COOLDOWN] = 0;
  mem8[SLOT_COUNT] = 4;
  mem8[RECORD_BASE] = 0;
  mem8[MARGIN] = 0;
  mem8[ERA] = era;
  mem8[WINDOW_HALF] = 0x40;
  mem8[regs.iy & 0xffff] = 0x84;
  mem8[(regs.ix + 0x01) & 0xffff] = 0x11;
  mem8[(regs.ix + FACING) & 0xffff] = 0x22;
  return e;
}

/** First slot busy, second free — the search must step exactly one record and one paired entry. */
function craftStep() {
  const e = seed();
  const { mem8, regs } = e;
  passFrame(e);
  mem8[COOLDOWN] = 0;
  mem8[SLOT_COUNT] = 4;
  mem8[RECORD_BASE] = 0xff;
  mem8[0xa8c8] = 0xff;
  mem8[0xa8d0] = 0;
  mem8[MARGIN] = 0;
  mem8[ERA] = 1;
  mem8[(regs.ix + 0x01) & 0xffff] = 0x11;
  mem8[(regs.ix + FACING) & 0xffff] = 0x22;
  return e;
}

function craftEarly(kind) {
  const e = seed();
  const { mem8, regs } = e;
  passFrame(e);
  if (kind === "frame") mem8[(regs.ix + PHASE) & 0xffff] = ((mem8[FRAME] & 7) + PHASE_BIAS + 1) & 0xff;
  else if (kind === "cooldown") mem8[COOLDOWN] = 9;
  else if (kind === "noslots") { mem8[COOLDOWN] = 0; mem8[SLOT_COUNT] = 0; }
  else if (kind === "allbusy") {
    mem8[COOLDOWN] = 0;
    mem8[SLOT_COUNT] = 3;
    for (let i = 0; i < 8; i++) mem8[0xa800 | ((0xc0 + i * 0x10) & 0xff)] = 0xff;
  }
  return e;
}

function corpus() {
  return [
    ...capture(),
    ...[0, 1, 2, 3, 4].map(craftDispatch),
    craftStep(),
    ...["frame", "cooldown", "noslots", "allbusy"].map(craftEarly),
  ];
}

// ── comparison ──────────────────────────────────────────────────────────────────────────────

/** The whole dump outside the masked stack window, then registers outside the measured ceiling. The
 * mask floor is watched off the frozen side's own pushes; the rewrite models no stack. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 40) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

function maskFloor(machine) {
  const a = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  return { seat, low };
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────────

function makeTwin(defect) {
  return (m) => {
    const { regs, mem8 } = m;
    if ((mem8[FRAME] & 7) + (defect.bias ?? PHASE_BIAS) !== mem8[(regs.ix + PHASE) & 0xffff]) return;
    if (mem8[COOLDOWN] !== 0) {
      if (!defect.skipCooldown) mem8[COOLDOWN] = mem8[COOLDOWN] - 1;
      return;
    }
    let count = mem8[SLOT_COUNT];
    if (count === 0) return;
    let record = RECORD_BASE;
    let entry = 0xaa28;
    let free = false;
    for (; count > 0; count--) {
      if (mem8[record] === 0) { free = true; break; }
      record = (record & 0xff00) | ((record + (defect.stride ?? 0x10)) & 0xff);
      entry = (entry + 2) & 0xffff;
    }
    if (!free) return;
    m.mem16[0xa991] = record;
    m.mem16[0xa993] = entry;
    const margin = mem8[MARGIN];
    const window = (margin + margin) & 0xff;
    const along = (0x78 - mem8[(regs.iy + 0x31) & 0xffff] + margin) & 0xff;
    if (along < window) {
      const across = (0x84 - mem8[regs.iy & 0xffff] + margin) & 0xff;
      if (across < window) return;
    }
    regs.c = mem8[(regs.ix + (defect.facingOff ?? FACING)) & 0xffff];
    const era0 = mem8[ERA] === 0;
    if (defect.swapEra ? !era0 : era0) return setTheLaunchFacingInsideOneAimWindow(m);
    return loc_42b7(m);
  };
}

/** BUG: scribbles IX, which both the routine and the launcher rely on; the register-only control. */
function brokenMovesIx(m) {
  launchAttackerIntoFreeSlot(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", () => {}, true],
  ["skip-cooldown-tick", makeTwin({ skipCooldown: true }), true],
  ["wrong-stride", makeTwin({ stride: 0x08 }), true],
  ["wrong-facing-byte", makeTwin({ facingOff: 0x01 }), true],
  ["swap-era-branch", makeTwin({ swapEra: true }), true],
  ["wrong-frame-bias", makeTwin({ bias: 6 }), true],
  ["moves-ix", brokenMovesIx, false],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("CORPUS: every captured and crafted machine replays identically", { skip }, () => {
  const all = corpus();
  assert.ok(capture().length > 0, "vacuous: the tape never dispatched this address");
  for (const e of all) {
    const d = unitDiff(launchAttackerIntoFreeSlot, e);
    assert.equal(d, null, show(d));
  }
  console.log(`  CORPUS: ${capture().length} captured + ${all.length - capture().length} crafted ` +
    "machines identical, launcher chain running underneath");
});

test("RETURN: the routine returns nothing, like the frozen tail", { skip }, () => {
  for (const e of [craftDispatch(0), craftDispatch(1), craftEarly("cooldown")]) {
    assert.equal(launchAttackerIntoFreeSlot(e.clone()), undefined, "the rewrite returned a value");
  }
  console.log("  RETURN: undefined on both dispatch targets and an early exit");
});

test("MASK FLOOR: the stack window stays above the game data", { skip }, () => {
  let low = 0x10000;
  let seat = 0;
  for (const e of corpus()) {
    const r = maskFloor(e);
    low = Math.min(low, r.low);
    seat = r.seat;
  }
  assert.ok(low > DATA_TOP, `the stack window ${hex4(low)} reached into game data at or below ${hex4(DATA_TOP)}`);
  console.log(`  MASK FLOOR: window floor ${hex4(low)} under seat ${hex4(seat)}, clear of ${hex4(DATA_TOP)}`);
});

test("EXCLUDED, deliberately: no register outside the ceiling moves, with a control that does", { skip }, () => {
  const movedOver = (cand) => {
    const moved = new Set();
    for (const e of corpus()) {
      const a = e.clone();
      const b = e.clone();
      oracle(a);
      try { cand(b); } catch { continue; }
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    }
    return moved;
  };
  const moved = movedOver(launchAttackerIntoFreeSlot);
  const control = movedOver(brokenMovesIx);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles IX");
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
  console.log(`  EXCLUDED (measured): moving ${[...moved].sort().join(", ")}; the IX control also ` +
    `moves ${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
});

for (const [label, twin, inMemory] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const all = corpus();
    let caught = 0;
    let mem = 0;
    for (const e of all) {
      const d = unitDiff(twin, e);
      if (d) { caught++; if (d.addr != null) mem++; }
    }
    console.log(`  TEETH/${label}: caught ${caught}/${all.length}, ${mem} in memory`);
    assert.ok(caught > 0, `every machine PASSED the ${label} twin`);
    if (inMemory) assert.ok(mem > 0, `the ${label} twin was never caught in memory`);
  });
}

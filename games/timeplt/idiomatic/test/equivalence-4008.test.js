// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4008 — memory-equivalent to the frozen oracle at ROM 0x4008.
 * GATE: crafted-entry, because neither tape dispatches this address. A real machine captured at the
 *   per-frame dispatcher seats the documented cursors and every occupancy of the three-slot bank is
 *   swept. RAM is compared outside the masked stack scratch (the oracle rets, the rewrite does not),
 *   the +2 SP drift is asserted, and registers are not compared: the only caller discards them
 *   between dispatches and the dissolved callees do not reproduce the register dance.
 *   Run: node --test games/timeplt/idiomatic/test/equivalence-4008.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_4008 as candidate } from "../loc_4008.js";
import { loc_4008 as oracle } from "../../translated/loc_4008.js";
import { loc_1199 as dispatcher } from "../../translated/loc_1199.js";
import { runOneShotAnimatedObjectSlot } from "../runOneShotAnimatedObjectSlot.js";
import { flyAlongBallisticArc } from "../flyAlongBallisticArc.js";

const TARGET = 0x4008;
const DISPATCHER = 0x1199;
const RECORD_BANK = 0xa8c0;
const SPRITE_BANK = 0xaa28;
const COUNT = 3;
const RECORD_STRIDE = 0x10;
const SPRITE_STRIDE = 2;
const EMPTY = 0x00;
const BALLISTIC = 0xff;
const LIVE = 0x30;
const MARKERS = [EMPTY, BALLISTIC, LIVE];

// Every game-data write lands at or below here; the stack seats far above it, so a mask floor above
// this can never hide a data divergence.
const DATA_TOP = 0xadff;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── base machine and crafted entries ────────────────────────────────────────────────────────

let base = null;
function baseState() {
  if (base === null) {
    const m = makeMachine(new Map([[DISPATCHER, (mm) => {
      if (base === null) base = mm.clone();
      return dispatcher(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return base;
}

function craft(markers) {
  const m = baseState().clone();
  m.regs.b = COUNT;
  m.regs.ix = RECORD_BANK;
  m.regs.iy = SPRITE_BANK;
  for (let i = 0; i < COUNT; i++) m.mem8[RECORD_BANK + i * RECORD_STRIDE] = markers[i];
  return m;
}

function patterns() {
  const out = [];
  for (const a of MARKERS) for (const b of MARKERS) for (const c of MARKERS) out.push([a, b, c]);
  return out;
}

// ── masked comparison ───────────────────────────────────────────────────────────────────────

// The oracle nests calls and leaves dead return addresses below the seated SP the rewrite never
// writes, so the diff excludes [low, seat) — low measured by watching the oracle's own pushes.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  let threw = null;
  try { cand(b); } catch (e) { threw = String(e).slice(0, 40); }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = threw ? { addr: null, threw } : null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp };
}

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

// ── twins ─────────────────────────────────────────────────────────────────────────────────

// The rewrite with one deliberate defect each; every knob matches loc_4008 by default.
function twin({ recStride = RECORD_STRIDE, sprStride = SPRITE_STRIDE, skipEmpty = true,
                ballistic = BALLISTIC, stopAt = 0 }) {
  return (m) => {
    const { regs, mem8 } = m;
    let service = true;
    for (;;) {
      if (service) runOneShotAnimatedObjectSlot(m);
      regs.ix = (regs.ix + recStride) & 0xffff;
      regs.iy = (regs.iy + sprStride) & 0xffff;
      regs.b = (regs.b - 1) & 0xff;
      if (regs.b <= stopAt) return;
      const marker = mem8[regs.ix];
      if (skipEmpty && marker === EMPTY) { service = false; continue; }
      if (marker !== ballistic) { service = true; continue; }
      flyAlongBallisticArc(m);
      service = false;
    }
  };
}

const TWINS = [
  ["no-op", () => {}, 27],
  ["record-stride-off", twin({ recStride: 0x08 }), 21],
  ["sprite-stride-off", twin({ sprStride: 1 }), 21],
  ["service-empty-slots", twin({ skipEmpty: false }), 15],
  ["swap-routing", twin({ ballistic: LIVE }), 24],
  ["one-slot-short", twin({ stopAt: 1 }), 18],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("UNREACHED: neither tape dispatches this address, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["attract", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [DISPATCHER]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [DISPATCHER, (mm) => { seen[DISPATCHER]++; return dispatcher(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // The zero is evidence only because the same run counted the dispatcher that would reach here.
    assert.ok(seen[DISPATCHER] > 0, `${label}: the control tap never fired, so the zero is blind`);
    assert.equal(seen[TARGET], 0, `${label} now dispatches this address; capture plain entries`);
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} ${seen[TARGET]}, control ${seen[DISPATCHER]}`);
  }
});

test("CRAFTED EQUIVALENCE: every occupancy of the bank is RAM-identical outside the mask",
  { skip }, () => {
    for (const p of patterns()) {
      const r = compare(candidate, craft(p));
      assert.equal(r.escaped, null,
        r.escaped && `markers ${p} escaped at ${r.escaped.addr == null ? "throw" : hex4(r.escaped.addr)}`);
      // ★ The mask is safe only if its floor sits above every data cell.
      assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
    }
    console.log(`  CRAFTED: ${patterns().length} occupancies identical outside the stack mask`);
  });

test("SP DRIFT: the oracle re-seats two bytes higher on every occupancy", { skip }, () => {
  for (const p of patterns()) {
    assert.equal(compare(candidate, craft(p)).spDiff, 2, `markers ${p}: SP drift moved`);
  }
  console.log("  SP DRIFT: +2 on every occupancy");
});

test("NOT VACUOUS: the swept marker classes move different amounts of data", { skip }, () => {
  const empty = footprint(craft([EMPTY, EMPTY, EMPTY]));
  const live = footprint(craft([LIVE, LIVE, LIVE]));
  const ballistic = footprint(craft([BALLISTIC, BALLISTIC, BALLISTIC]));
  assert.ok(empty > 0, "even the all-empty bank must service its first slot");
  assert.ok(empty !== live && live !== ballistic && empty !== ballistic,
    "the marker classes move the same amount, so the sweep is not reaching the routing decision");
  console.log(`  NOT VACUOUS: empty ${empty}, live ${live}, ballistic ${ballistic} cells`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of occupancies`, { skip }, () => {
    let caught = 0;
    for (const p of patterns()) if (compare(brokenTwin, craft(p)).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${patterns().length} occupancies`);
  });
}

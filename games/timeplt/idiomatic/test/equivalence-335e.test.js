// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_335e vs the frozen oracle: the dissolved callees drop the ROM rets, so RAM is compared with
 * the dead stack below the seat masked out, the +2 sp re-seat and the undefined return checked,
 * registers left out (no caller consumes one); plus branch paths, a corpus, and teeth. Run:
 * node --test games/timeplt/idiomatic/test/equivalence-335e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_335e as candidate } from "../loc_335e.js";
import { loc_335e as oracle } from "../../translated/loc_335e.js";
import { u8, u16 } from "../../../../core/int.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { armThePenRouteThenColdStartOnATamperedImage as armPen } from "../armThePenRouteThenColdStartOnATamperedImage.js";

const TARGET = 0x335e;
const PHASE = 0xa9ab;
const IMAGE_BLOCK = 0x178c;
const IMAGE_BYTES = 0x1e;
const BIAS = 0x2c;
const ACTIVE_PLAYER = 0xad32;
const PEN_ONE = 0xad1b;
const ERA_ONE = 0xad14;
const PEN_TWO = 0xad2b;
const ERA_TWO = 0xad24;
const TABLE = 0x0f8d;
const LIVE_GLYPH = 0xad0b;
const LIVE_COLOUR = 0xad0c;

const DATA_TOP = 0xadff;
const CORPUS_FRAMES = 2000;
const COINSTART_DISPATCHES = 3;
const ATTRACT_DISPATCHES = 1;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

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

function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.push(addr);
  }
  return cells;
}

// ── the captured entry, and crafted branch entries ────────────────────────────────────────

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

function craft(mutate) {
  const m = entryState().clone();
  mutate(m);
  return m;
}

function scenarios() {
  return [
    ["captured", craft(() => {})],
    ["player2", craft((m) => { m.mem8[ACTIVE_PLAYER] = 1; m.mem8[ERA_TWO] = 2; })],
    ["penHeld", craft((m) => { const e = m.mem8[ERA_ONE]; m.mem8[LIVE_COLOUR] = m.mem8[TABLE + 2 * e + 1]; })],
    ["eraHigh", craft((m) => { m.mem8[ERA_ONE] = 7; })],
  ];
}

// ── the twins ───────────────────────────────────────────────────────────────────────────────

function twin({ biasOff = false, forceP1 = false, liveGlyph = true, extraStep = true, table = TABLE, tail = true }) {
  return (m) => {
    const { regs, mem8 } = m;
    let t = mem8[PHASE];
    for (let i = 0; i < IMAGE_BYTES; i++) t = u8(t + mem8[u16(IMAGE_BLOCK + i)]);
    mem8[PHASE] = u8(t + BIAS + (biasOff ? 1 : 0));
    const p2 = !forceP1 && mem8[ACTIVE_PLAYER] !== 0;
    const pen = p2 ? PEN_TWO : PEN_ONE;
    const era = p2 ? mem8[ERA_TWO] : mem8[ERA_ONE];
    regs.a = u8(era * 2);
    regs.hl = table;
    const glyph = fetchTableByte(m);
    mem8[pen] = glyph;
    if (liveGlyph) mem8[LIVE_GLYPH] = glyph;
    const colour = mem8[u16(regs.hl + 1)];
    mem8[pen + 1] = colour;
    const held = colour === mem8[LIVE_COLOUR];
    mem8[LIVE_COLOUR] = colour;
    if (held && extraStep) advanceSequenceSubStep(m);
    armPen(m);
    if (tail) return advanceSequenceSubStep(m);
  };
}

const TWINS = [
  ["no-op", () => {}, 4],
  ["checksum-corrupt", twin({ biasOff: true }), 4],
  ["wrong-save-block", twin({ forceP1: true }), 1],
  ["skip-live-glyph", twin({ liveGlyph: false }), 4],
  ["skip-extra-step", twin({ extraStep: false }), 1],
  ["wrong-table", twin({ table: TABLE + 2 }), 4],
  ["skip-tail", twin({ tail: false }), 4],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, entryState());
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  // ★ The mask is safe only if it never covers a data cell: prove its floor sits above them all.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("PATHS: every branch is memory-equivalent, and the branches really differ", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[label] = footprint(m).join(",");
  }
  // ★ Vacuity guard: the branches must move DIFFERENT cells, or the pokes changed nothing.
  assert.notEqual(prints.captured, prints.player2, "the two save blocks move the same cells");
  assert.notEqual(prints.captured, prints.penHeld, "the extra-step branch moves the same cells");
  console.log(`  PATHS: 4 scenarios equivalent; player2 moves ${prints.player2.split(",").length} cells`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops a tail-jump ret and the rewrite does not`);
    assert.equal(r.retOracle, r.retCand, `${label}: the return value diverged`);
  }
  console.log("  SP: +2 on every path; return values identical");
});

test("CORPUS: both tapes reach it and every dispatch replays identically", { skip }, () => {
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
  const coin = run({});
  const attract = run({ tape: [] });
  assert.equal(coin.dispatched, COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(attract.dispatched, ATTRACT_DISPATCHES, "the attract dispatch count moved");
  assert.equal(coin.caught, 0, `the rewrite diverged on ${coin.caught} coin-start dispatches`);
  assert.equal(attract.caught, 0, `the rewrite diverged on ${attract.caught} attract dispatches`);
  console.log(`  CORPUS: coin-start ${coin.dispatched} identical, attract ${attract.dispatched} identical`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(brokenTwin, m).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} scenarios`);
  });
}

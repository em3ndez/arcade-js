// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4c75 — memory-equivalent to the frozen oracle at ROM 0x4C75.
 * GATE: real dispatches (reached by computed dispatch; its static caller is dead) plus crafted
 *   branch entries; RAM compared with the dead stack scratch below the seated SP masked out, the
 *   +2 SP re-seat and the undefined return asserted, teeth. The picture-enable latch write is
 *   outside the RAM dump, so a dropped-checksum twin is invisible here. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-4c75.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_4c75 as candidate } from "../loc_4c75.js";
import { loc_4c75 as oracle } from "../../translated/loc_4c75.js";
import { blankFourteenCharCells } from "../blankFourteenCharCells.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { postCommand } from "../postCommand.js";
import { u8 } from "../../../../core/int.js";
import {
  ACTIVE_PLAYER, PLAYER_ONE_LIVES, PLAYER_TWO_LIVES,
  LIVES_REMAINING, ROUND_NUMBER, PLAY_ACTIVE,
} from "../names.js";

const TARGET = 0x4c75;
const STATIC_CALLER = 0x1323; // dead: the routine is reached only by computed dispatch
const HOT_CONTROL = 0x37bd; // fires hundreds of times, so a zero at TARGET would be evidence
const COINSTART_DISPATCHES = 2;
const ATTRACT_DISPATCHES = 1;

const WRITE_CURSOR = 0xa9b2;
const COMMAND_RING = 0xac00;
const CONTEXT_BYTES = 16;
const ROUND_COMMAND = 6;
const LIVES_COMMAND = 5;
// Every cell this routine writes sits at or below here; the stack seats far above it (0xafxx), so
// masking the scratch window can never hide a data divergence. Asserted against the measured floor.
const DATA_TOP = 0xadff;
const BLANK_CELLS = Array.from({ length: 14 }, (_, i) => 0xa79f - i * 0x20);
const CHARACTER_PLANE_BIT = 0x0400;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/**
 * Oracle vs candidate on independent clones. The oracle's tail jump runs a callee that pops the
 * caller's slot and its nested calls push return addresses the rewrite never writes, so the diff
 * excludes [low, seat) — low measured by watching the oracle's own pushes. Anything outside escapes.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const retOracle = oracle(a);
  let retCand, threw = null;
  try { retCand = cand(b); } catch (e) { threw = e; }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  if (threw) escaped = { addr: null, oracle: "ran", candidate: String(threw).slice(0, 40) };
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

/** Cells at or below DATA_TOP the oracle moves from a state — a branch's footprint. */
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

// ── captured entries, and the crafted branch entries ──────────────────────────────────────

let captured = null;
function realEntries() {
  if (captured === null) {
    captured = [];
    const m = makeMachine(new Map([[TARGET, (mm) => { captured.push(mm.clone()); return oracle(mm); }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return captured;
}

function craft(mutate) {
  const m = realEntries()[0].clone();
  mutate(m);
  return m;
}

/** Give the two save blocks distinct contents so a wrong-block copy is visible in RAM. */
function distinctBlocks(m) {
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    m.mem8[PLAYER_ONE_LIVES + i] = 0x10 + i;
    m.mem8[PLAYER_TWO_LIVES + i] = 0x40 + i;
  }
}
/** Dirty the blank run so skipping the blanker is visible. */
function dirtyScreen(m) {
  for (const c of BLANK_CELLS) { m.mem8[c] = 0x99; m.mem8[c & ~CHARACTER_PLANE_BIT] = 0x99; }
}
/** High bit set = free, so postCommand writes; clear = occupied, so it drops. */
function ring(m, free) {
  for (let k = 0; k < 4; k++) m.mem8[COMMAND_RING + ((m.mem8[WRITE_CURSOR] + k) & 0x3f)] = free ? 0xff : 0x00;
}

function scenarios() {
  return [
    ["p1-active-free", craft((m) => { distinctBlocks(m); dirtyScreen(m); m.mem8[ACTIVE_PLAYER] = 0; m.mem8[PLAY_ACTIVE] = 0xff; ring(m, true); })],
    ["p2-active-free", craft((m) => { distinctBlocks(m); dirtyScreen(m); m.mem8[ACTIVE_PLAYER] = 1; m.mem8[PLAY_ACTIVE] = 0xff; ring(m, true); })],
    ["p1-inactive", craft((m) => { distinctBlocks(m); dirtyScreen(m); m.mem8[ACTIVE_PLAYER] = 0; m.mem8[PLAY_ACTIVE] = 0; })],
    ["p2-inactive", craft((m) => { distinctBlocks(m); dirtyScreen(m); m.mem8[ACTIVE_PLAYER] = 1; m.mem8[PLAY_ACTIVE] = 0; })],
    ["p1-active-occupied", craft((m) => { distinctBlocks(m); dirtyScreen(m); m.mem8[ACTIVE_PLAYER] = 0; m.mem8[PLAY_ACTIVE] = 0xff; ring(m, false); })],
  ];
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every parameter matches loc_4c75 by default. */
function twin({ blank = true, forceP1 = false, copy = true, round = ROUND_COMMAND, substep = true }) {
  return (m) => {
    const { mem8 } = m;
    if (blank) blankFourteenCharCells(m);
    const saved = (forceP1 ? 0 : mem8[ACTIVE_PLAYER]) === 0 ? PLAYER_ONE_LIVES : PLAYER_TWO_LIVES;
    if (copy) for (let i = 0; i < CONTEXT_BYTES; i++) mem8[LIVES_REMAINING + i] = mem8[saved + i];
    if (mem8[PLAY_ACTIVE] === 0) { if (substep) advanceSequenceSubStep(m); return; }
    postCommand(m, round, mem8[ROUND_NUMBER]);
    postCommand(m, LIVES_COMMAND, u8(mem8[LIVES_REMAINING] - 1));
    let checksum = 0;
    for (let i = 0; i < 256; i++) checksum ^= mem8[0x5b50 + i];
    m.mem.write8(0xc308, u8(checksum - 1), 10);
    if (substep) advanceSequenceSubStep(m);
  };
}

const TWINS = [
  ["no-op", () => {}, 5],
  ["skip-blank", twin({ blank: false }), 5],
  ["wrong-player", twin({ forceP1: true }), 2],
  ["skip-copy", twin({ copy: false }), 5],
  ["wrong-round-cmd", twin({ round: 7 }), 2],
  ["skip-substep", twin({ substep: false }), 5],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at real dispatches: RAM identical outside the masked stack scratch", { skip }, () => {
  const entries = realEntries();
  assert.ok(entries.length > 0, "vacuous: the tape never reached the routine");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${r.escaped.addr == null ? "throw" : hex4(r.escaped.addr)}`);
    // ★ The mask is safe only if its floor sits above every data cell this routine writes.
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  }
  console.log(`  EQUAL: ${entries.length} real dispatches identical; window floor ${hex4(compare(candidate, entries[0]).low)}`);
});

test("REACHABILITY: computed dispatch reaches it though its static caller is dead", { skip }, () => {
  const run = (opts) => {
    const seen = { [TARGET]: 0, [STATIC_CALLER]: 0, [HOT_CONTROL]: 0 };
    const wrap = (a) => (mm) => { seen[a]++; return TRANSLATED.get(a)(mm); };
    const m = makeMachine(new Map([TARGET, STATIC_CALLER, HOT_CONTROL].map((a) => [a, wrap(a)])), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    return seen;
  };
  const coin = run({});
  const attract = run({ tape: [] });
  // ★ The zero at the static caller is evidence only because the same taps counted a hot control.
  assert.ok(coin[HOT_CONTROL] > 0 && attract[HOT_CONTROL] > 0, "the control never fired: the taps are blind");
  assert.equal(coin[STATIC_CALLER], 0, "the static caller now dispatches, so the reachability note is stale");
  assert.equal(attract[STATIC_CALLER], 0, "the static caller now dispatches, so the reachability note is stale");
  assert.equal(coin[TARGET], COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(attract[TARGET], ATTRACT_DISPATCHES, "the attract dispatch count moved");
  console.log(`  REACHABILITY: TARGET coin ${coin[TARGET]} / attract ${attract[TARGET]}, static caller 0, control ${coin[HOT_CONTROL]}`);
});

test("PATHS: every crafted branch is equivalent, and the branches really differ", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && (r.escaped.addr == null ? "throw" : hex4(r.escaped.addr))}`);
    prints[label] = footprint(m).join(",");
  }
  // ★ Vacuity guard: the active path posts to the ring and the inactive path does not, so they must
  // move different cells, or the pokes changed nothing and the arm would pass a branch-blind rewrite.
  assert.notEqual(prints["p1-active-free"], prints["p1-inactive"], "the active and inactive paths move the same cells");
  console.log(`  PATHS: ${scenarios().length} scenarios equivalent; active moves ${prints["p1-active-free"].split(",").length} cells, inactive ${prints["p1-inactive"].split(",").length}`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return undefined", { skip }, () => {
  for (const [label, m] of [...scenarios(), ...realEntries().map((e, i) => [`real${i}`, e])]) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops a return address and the rewrite does not`);
    assert.equal(r.retOracle, undefined, `${label}: the oracle returned a value`);
    assert.equal(r.retCand, undefined, `${label}: the rewrite returned a value`);
  }
  console.log("  SP: +2 on every path; return values both undefined");
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

// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d21 — memory-equivalent to the frozen oracle at ROM 0x2D21.
 * GATE: real attract dispatches (coin-start holds the opening era and never lists this address).
 *   RAM compared with the dead stack scratch below the seat masked out — the oracle nests ROM
 *   calls and its tail pops the caller's return, the dissolved rewrite does neither — the +2 SP
 *   re-seat and the return checked, the two cursors (the live-out) asserted equal, the scratch
 *   registers the dissolved callees never reproduce excluded, and teeth split by channel. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-2d21.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { loc_2d21 as candidate } from "../loc_2d21.js";
import { loc_2d21 as oracle } from "../../translated/loc_2d21.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { driftAtFiveQuartersWorldScroll } from "../driftAtFiveQuartersWorldScroll.js";
import { placeAbuttingTile } from "../placeAbuttingTile.js";
import { placeDiagonallyAbuttingTile } from "../placeDiagonallyAbuttingTile.js";
import { advanceToNextSlot } from "../advanceToNextSlot.js";

const TARGET = 0x2d21;
const CORPUS_FRAMES = 1400;
const ATTRACT_DISPATCHES = 502;
const SP_RESEAT = 2;
// Every game-data write lands at or below here; the stack seats far above it, so masking the
// scratch window can never hide a data divergence. Asserted against the measured floor below.
const DATA_TOP = 0xadff;

// ix/iy (the two cursors) are the live-out and ARE compared; these are the scratch registers the
// ROM's call dance leaves and no tail-returning caller consumes.
const EXCLUDED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const retOracle = oracle(a);
  let retCand, threw = null;
  try { retCand = cand(b); } catch (e) { threw = String(e).slice(0, 60); }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  let regEscaped = null;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { regEscaped = { k, oracle: a.regs[k], candidate: b.regs[k] }; break; }
  }
  return { escaped, regEscaped, threw, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

const caught = (r) =>
  r.threw !== null || r.escaped !== null || r.regEscaped !== null ||
  r.spDiff !== SP_RESEAT || r.retOracle !== r.retCand;

/** Cells the oracle moves from a state, ignoring the stack scratch — a dispatch's footprint. */
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

// ── the corpus of real dispatches ─────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), { tape: [] });
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `the attract run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "the attract run ran short");
  corpus = entries;
  return corpus;
}

// ── the twins, each carrying its exact catch counts: total, then in RAM, then in a cursor ───

const drift = driftAtFiveQuartersWorldScroll;
const abut = placeAbuttingTile;
const diag = placeDiagonallyAbuttingTile;
const step = advanceToNextSlot;

const TWINS = [
  ["no-op", () => {}, 502, 502, 502],
  ["skip-drift", (m) => { abut(m); diag(m); step(m); }, 501, 501, 0],
  ["skip-abutting", (m) => { drift(m); diag(m); step(m); }, 502, 502, 502],
  ["skip-diagonal", (m) => { drift(m); abut(m); step(m); }, 502, 502, 502],
  ["skip-final-step", (m) => { drift(m); abut(m); diag(m); }, 502, 0, 502],
  ["swap-tiles", (m) => { drift(m); diag(m); abut(m); step(m); }, 502, 502, 0],
  ["extra-step", (m) => { candidate(m); step(m); }, 502, 0, 502],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL: the first attract dispatch is memory-equivalent outside the masked stack", { skip }, () => {
  const entries = captureCorpus();
  assert.ok(entries.length > 0, "vacuous: attract never reached this address");
  const r = compare(candidate, entries[0]);
  assert.equal(r.threw, null, `the rewrite threw: ${r.threw}`);
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  // ★ The mask is safe only if it never covers a data cell: prove its floor sits above them all.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("CORPUS: every attract dispatch replays; coin-start never reaches it", { skip }, () => {
  const entries = captureCorpus();
  assert.equal(entries.length, ATTRACT_DISPATCHES, "the attract dispatch count moved");
  let diverged = 0;
  for (const e of entries) if (caught(compare(candidate, e))) diverged++;
  assert.equal(diverged, 0, `the rewrite diverged on ${diverged} attract dispatches`);
  // ★ coin-start reaching zero is a fact, not an untested tap: the SAME probe counted 502 in attract.
  let coin = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => { coin++; return oracle(mm); }]]));
  m.runFrames(CORPUS_FRAMES);
  assert.equal(coin, 0, "coin-start now reaches this address; capture plain dispatches for it");
  console.log(`  CORPUS: ${entries.length} attract dispatches identical, coin-start ${coin}`);
});

test("SP, RETURN and CURSORS: +2 re-seat, equal return, and the two cursors match", { skip }, () => {
  const entries = captureCorpus();
  const prints = new Set();
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.spDiff, SP_RESEAT, "the oracle tail-pops the caller's return and the rewrite does not");
    assert.equal(r.retOracle, r.retCand, "the return value diverged");
    assert.equal(r.regEscaped, null, r.regEscaped && `a live-out register diverged: ${r.regEscaped.k}`);
    prints.add(footprint(e));
  }
  // ★ Vacuity guard: the dispatches must not all move the same footprint, or the corpus is one
  // state repeated and this sweep proves nothing.
  assert.ok(prints.size > 1, "every attract dispatch moves the same footprint; the corpus is degenerate");
  console.log(`  SP/RETURN/CURSORS: +${SP_RESEAT} and equal on ${entries.length}; ${prints.size} footprints`);
});

for (const [label, twin, total, ram, reg] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count, split by channel`, { skip }, () => {
    const entries = captureCorpus();
    let caughtN = 0, inRam = 0, inReg = 0;
    for (const e of entries) {
      const r = compare(twin, e);
      if (caught(r)) caughtN++;
      if (r.escaped) inRam++;
      if (r.regEscaped) inReg++;
    }
    assert.ok(total > 0, `the ${label} twin is not caught at all`);
    assert.equal(caughtN, total, `the ${label} twin's catch count moved`);
    assert.equal(inRam, ram, `the ${label} twin's RAM catch count moved`);
    assert.equal(inReg, reg, `the ${label} twin's cursor catch count moved`);
    console.log(`  TEETH/${label}: caught ${caughtN}/${entries.length} (ram ${inRam}, cursors ${inReg})`);
  });
}

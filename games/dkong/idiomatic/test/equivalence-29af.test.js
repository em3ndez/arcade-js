// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_29af (ROM 0x29AF) — the board-gated resolution of Mario's airborne
 * contact with the 0x6600 objects.
 *
 * The routine is board-gated (mask bit 2 -> board 3), asks the 0x6600 overlap search whether
 * Mario touches a record, and on a touch takes one of three arms decided by MARIO_AIR_PREV_Y
 * against the matched record's OBJ_Y less 4: land on top (writes MARIO_Y + EDGE_REPOSITION_FLAG,
 * skips the caller), kill (clears MARIO_ACTIVE, returns normally), or snap sideways (writes
 * MARIO_X + MARIO_SPRITE_RECORD's X, skips the caller).
 *
 * THE CONTRACT COMPARED HERE is RAM minus STACK_SCRATCH, the boolean return, and — where the
 * board gate OPENED — the register file the frozen continuation reads (A, B, C, DE, H, L, IX,
 * IY). pc/SP are NOT compared: the idiomatic routine replaces the Z80 stack with the JS call
 * stack, so the oracle's pushes and its one- or two-word return are dead scratch (every entry
 * puts SP inside STACK_SCRATCH so they land there). On a CLOSED gate the registers are not
 * compared either, and that is derived rather than convenient: the oracle's closed arm runs the
 * real rst-0x30 vector, which rotates A, counts B down to 0 and loads HL — all three dead,
 * because loc_29af's only caller overwrites A and B (`xor a; ld b,a`) before returning and no
 * continuation reads HL. F is never compared on any arm: both continuations (`xor a` in the
 * caller, `dec a` two levels up) begin by setting flags.
 *
 *   1. REACHABILITY (natural attract) — hook 0x29AF in a plain attract run and record what it
 *      catches. It catches NOTHING: 0 dispatches in 3000 frames, because the caller's own
 *      collision gate never returns normally on board 1. This test asserts that zero; it is a
 *      reachability record, NOT coverage, and the captured/crafted tests below carry the gate.
 *   2. EQUAL (captured, BOARD poked) — attract runs with BOARD poked to 2, 3 and 4 from frame
 *      400 do reach it: 81 / 6 / 175 real dispatches. Every one is classified by the arm the
 *      ORACLE takes, and the replayed sample is every 20th capture plus the first of each arm;
 *      the test asserts the sample covers every arm those runs produced. Those runs produce only
 *      the closed gate (boards 2 and 4) and the no-overlap arm (board 3) — the three ACTING arms
 *      do not occur in them and are carried entirely by test 3.
 *   3. EQUAL (crafted) — crafted entries on a real attract base drive every arm: closed gate,
 *      no overlap, land-on-top, kill, snap-sideways, a touch accepted only through a record's own
 *      extra spans, three entries that drive the decision's 8-bit wraps, and a touch at each of
 *      the six record indices so the record-recovery walk is exercised at every offset.
 *   4. EQUAL (exhaustive, the collapsed branch) — the ROM picks the sideways X through a test on
 *      MARIO_AIR_VX_HI whose two arms are the same function of MARIO_X; the idiomatic routine
 *      keeps one expression. This sweeps all 256 MARIO_X values on both sides of that test
 *      (1024 entries) and pins the collapse against the oracle instead of asserting it.
 *   5. TEETH — four broken twins the crafted/exhaustive cases MUST catch: the contact decision
 *      read from MARIO_Y instead of the pre-motion snapshot, the board gate dropped, the record
 *      index taken as the search residue rather than count-minus-residue, and the sideways snap
 *      off by one.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-29af.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_29af as oracle } from "../../translated/loc_29af.js";
import { loc_29af } from "../loc_29af.js";
import { boardBitGate } from "../boardBitGate.js"; // idiomatic callee — used to build the teeth
import { loc_2a22 } from "../loc_2a22.js"; //          idiomatic callee — used to build the teeth
import { Machine } from "../../machine.js";
import { u8 } from "../../../../core/int.js";
import {
  BOARD,
  EDGE_REPOSITION_FLAG,
  MARIO_ACTIVE,
  MARIO_AIR_PREV_Y,
  MARIO_AIR_VX_HI,
  MARIO_SPRITE_RECORD,
  MARIO_X,
  MARIO_Y,
  OBJ_ACTIVE,
  OBJ_ARRAY_66,
  OBJ_HIT_EXTENT_X,
  OBJ_HIT_EXTENT_Y,
  OBJ_X,
  OBJ_Y,
  SPRITE_X,
  STACK_SCRATCH,
} from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x29af;
const BOARD_MASK = 0x04; // the mask the routine hands the board gate
const RECORD_COUNT = 6;
const RECORD_STRIDE = 16;

// SP inside STACK_SCRATCH, low enough that every push the oracle and the search make lands
// there, and high enough that its two return pops read mapped bytes (0x6C00 itself is unmapped).
const SAFE_SP = 0x6bf0;
const RET_TO_CALLER = 0x2b26; // where loc_2b1c resumes on a plain return
const RET_TO_CALLERS_CALLER = 0x1c08; // where the airborne handler resumes on a caller-skip

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/** Does the board gate open for this board? The vector rotates the mask BOARD times and reads
 *  the carry, which selects bit (BOARD - 1) — the same derivation boardBitGate's own gate pins. */
const gateOpens = (board) => ((BOARD_MASK >> ((board - 1) & 7)) & 1) === 1;

// -- the contract --------------------------------------------------------------

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

// The registers the frozen continuation can still read. A and B are the genuine live-out on the
// two skipping returns; the rest are the search's inputs/outputs, compared because they are free
// evidence that the marshalling matches. D is deliberately absent — on a touch the oracle parks
// the contact line there as scratch, and nothing reads it: neither the caller loc_2b1c nor any
// of loc_1c3a / loc_1c4f / loc_1d95 / loc_1da6, which is the closed set of code the two skipping
// returns reach. E (the search stride) IS compared. See the header for why F, pc and SP are out.
const REG_NAMES = ["a", "b", "c", "e", "h", "l", "ix", "iy"];

/** Full contract diff on a shared entry: RAM − STACK_SCRATCH, the boolean return, and (only when
 *  the board gate opens) the register file. */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  const c = entry.clone();
  const ro = oracle(o);
  let rc;
  try {
    rc = fn(c);
  } catch (e) {
    return [`candidate threw: ${e.message}`];
  }
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (ro !== rc) diffs.push(`return oracle=${ro} cand=${rc}`);
  if (gateOpens(entry.mem.read8(BOARD))) {
    for (const n of REG_NAMES) {
      if (o.regs[n] !== c.regs[n]) diffs.push(`reg ${n} oracle=${hx(o.regs[n])} cand=${hx(c.regs[n])}`);
    }
  }
  return diffs;
}

/** Which arm the ORACLE takes on this entry — the classifier the sampling and the crafted
 *  expectations are keyed on. Derived by watching the oracle, never by re-deriving the decision. */
function classify(entry) {
  const o = entry.clone();
  const before = {
    active: o.mem.read8(MARIO_ACTIVE), y: o.mem.read8(MARIO_Y),
    x: o.mem.read8(MARIO_X), flag: o.mem.read8(EDGE_REPOSITION_FLAG),
  };
  const r = oracle(o);
  if (r === false) {
    // The two skipping arms: land-on-top raises the reposition flag, sideways does not.
    return o.mem.read8(EDGE_REPOSITION_FLAG) === 1 && o.mem.read8(MARIO_Y) !== before.y ? "on-top"
      : o.mem.read8(EDGE_REPOSITION_FLAG) === 1 && before.flag === 1 && o.regs.b === 1 ? "on-top"
        : "sideways";
  }
  if (before.active !== 0 && o.mem.read8(MARIO_ACTIVE) === 0) return "kill";
  return gateOpens(entry.mem.read8(BOARD)) ? "no-overlap" : "gate-closed";
}

// -- entries -------------------------------------------------------------------

/** A real, self-consistent machine: boot + attract, so work RAM around the poked cells is
 *  realistic. clone() neutralises the frame machinery so no NMI fires mid-routine. */
function attractBase(frames = 400) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

/** One 16-byte object record from its meaningful fields. */
function row({ active = true, x = 0, y = 0, spanX = 0, spanY = 0 }) {
  const r = new Array(RECORD_STRIDE).fill(0);
  r[OBJ_ACTIVE] = active ? 1 : 0;
  r[OBJ_X] = x;
  r[OBJ_Y] = y;
  r[OBJ_HIT_EXTENT_X] = spanX;
  r[OBJ_HIT_EXTENT_Y] = spanY;
  return r;
}

/**
 * Stamp a crafted 0x29AF entry onto a clone of `base`: the two return addresses the ROM's call
 * chain would have on the stack, the board, Mario's position / pre-motion snapshot / airborne
 * velocity / sprite X, and up to six records at 0x6600 (the page is zeroed first).
 */
function craft(base, { board = 3, records = [], marioX = 0x60, marioY = 100, prevY = 100, vxHi = 0, spriteX = 0 }) {
  const m = base.clone();
  m.regs.sp = SAFE_SP;
  m.mem.write16(SAFE_SP, RET_TO_CALLER);
  m.mem.write16(SAFE_SP + 2, RET_TO_CALLERS_CALLER);
  m.regs.ix = MARIO_ACTIVE; // what the frozen caller leaves in it
  m.mem.write8(BOARD, board);
  m.mem.write8(MARIO_ACTIVE, 1);
  m.mem.write8(MARIO_X, marioX);
  m.mem.write8(MARIO_Y, marioY);
  m.mem.write8(MARIO_AIR_PREV_Y, prevY);
  m.mem.write8(MARIO_AIR_VX_HI, vxHi);
  m.mem.write8(EDGE_REPOSITION_FLAG, 0);
  m.mem.write8(MARIO_SPRITE_RECORD + SPRITE_X, spriteX);
  for (let a = OBJ_ARRAY_66; a < OBJ_ARRAY_66 + RECORD_COUNT * RECORD_STRIDE; a++) m.mem.write8(a, 0);
  for (let i = 0; i < records.length; i++) {
    const rbase = OBJ_ARRAY_66 + i * RECORD_STRIDE;
    for (let off = 0; off < records[i].length; off++) m.mem.write8(rbase + off, records[i][off]);
  }
  return m;
}

/** A record placed exactly on Mario, so the search's base windows accept it on both axes. */
const touching = (marioX, marioY) => row({ x: marioX, y: marioY });

// -- 1. REACHABILITY -----------------------------------------------------------

test("REACHABILITY: the natural attract demo dispatches 0x29AF zero times (crafted+poked carry the gate)", () => {
  const caps = [];
  const ov = new Map([[TARGET, (mm) => { caps.push(mm.clone()); return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: ov });
  host.runFrames(3000);
  assert.equal(caps.length, 0,
    "0x29AF now runs in natural attract — a new finding; fold the captures into this gate");
  console.log("  REACHABILITY: 0 natural 0x29AF dispatches in 3000 attract frames");
});

// -- 2. EQUAL (captured, BOARD poked) ------------------------------------------

/** Capture every 0x29AF dispatch in an attract run with BOARD held at `board` from frame 400. */
function capturesOnBoard(board, frames) {
  const caps = [];
  const ov = new Map([[TARGET, (mm) => { caps.push(mm.clone()); return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: ov });
  host.pokes = [{ addr: BOARD, val: board, frame: 400, dur: null }];
  host.runFrames(frames);
  return caps;
}

test("EQUAL (captured): every sampled real dispatch on boards 2/3/4 matches the oracle", () => {
  const runs = [[2, 1200, 81], [3, 3000, 6], [4, 3000, 175]];
  let replayed = 0, total = 0;
  const armsSeen = new Set(), armsReplayed = new Set();

  for (const [board, frames, expected] of runs) {
    const caps = capturesOnBoard(board, frames);
    assert.equal(caps.length, expected,
      `board ${board}: expected ${expected} dispatches in ${frames} frames, saw ${caps.length}`);
    total += caps.length;

    // Sampling policy: every 20th capture PLUS the first of each distinct arm.
    const firstOfArm = new Map();
    const arms = caps.map((c) => classify(c));
    arms.forEach((a, i) => { armsSeen.add(a); if (!firstOfArm.has(a)) firstOfArm.set(a, i); });
    const sample = new Set([...firstOfArm.values()]);
    for (let i = 0; i < caps.length; i += 20) sample.add(i);

    for (const i of sample) {
      const diffs = contractDiffs(caps[i], loc_29af);
      assert.equal(diffs.length, 0, `board ${board} capture ${i} (${arms[i]}): ${diffs.join("; ")}`);
      armsReplayed.add(arms[i]);
      replayed++;
    }
  }

  // Non-vacuity: the sample must cover every arm the runs actually produced.
  assert.deepEqual([...armsSeen].sort(), [...armsReplayed].sort(),
    "the replayed sample missed an arm the captures produced");
  assert.ok(total > 0, "no real dispatches were captured at all");
  console.log(`  EQUAL/captured: replayed ${replayed} of ${total} real dispatches; arms seen = ${[...armsSeen].sort().join(", ")}`);
});

// -- 3. EQUAL (crafted, every arm) ---------------------------------------------

test("EQUAL (crafted): every arm matches the oracle", () => {
  const base = attractBase();
  const X = 0x60, Y = 100; // the object sits on Mario, so its contact line is Y - 4 = 96

  const cases = [
    { name: "gate closed (board 1)", opts: { board: 1, records: [touching(X, Y)] }, arm: "gate-closed" },
    { name: "gate closed (board 4)", opts: { board: 4, records: [touching(X, Y)] }, arm: "gate-closed" },
    { name: "gate open, no record active", opts: { board: 3, records: [] }, arm: "no-overlap" },
    {
      name: "gate open, records active but out of range on both axes",
      opts: { board: 3, records: [row({ x: 0x00, y: 0x00 }), row({ x: 0xf0, y: 0xf0 })] },
      arm: "no-overlap",
    },
    {
      name: "touch from clearly ABOVE -> land on top",
      opts: { board: 3, records: [touching(X, Y)], prevY: 50 },
      arm: "on-top",
    },
    {
      name: "touch from clearly BELOW -> kill",
      opts: { board: 3, records: [touching(X, Y)], prevY: 120 },
      arm: "kill",
    },
    {
      name: "touch from neither -> snap sideways",
      opts: { board: 3, records: [touching(X, Y)], prevY: 100 },
      arm: "sideways",
    },
    // The 8-bit wraps. The first and third are TEETH — dropping the wrap makes the routine pick a
    // different arm on that exact entry, verified by breaking it. The second is coverage rather
    // than a tooth: it drives the landing Y negative before its store, where truncation is the
    // memory model's and not this routine's to get wrong.
    {
      name: "wrap: the contact line itself wraps (object Y below 4)",
      // line = 2 - 4 wraps to 254; unwrapped it would be -2 and select the kill arm instead.
      opts: { board: 3, records: [touching(X, 2)], marioY: 2, prevY: 100 },
      arm: "on-top",
    },
    {
      name: "wrap: the landing Y itself wraps (contact line below 8)",
      // line = 6 - 4 = 2, and Mario is placed 8 above it: 2 - 8 wraps to 250 in the store.
      opts: { board: 3, records: [touching(X, 6)], marioY: 6, prevY: 252 },
      arm: "on-top",
    },
    {
      name: "wrap: the below-clearance test wraps (pre-motion Y under 14)",
      // 5 - 14 wraps to 247, which clears the line at 10 -> kill; unwrapped it would be -9 and
      // fall through to the sideways arm.
      opts: { board: 3, records: [touching(X, 14)], marioY: 14, prevY: 5 },
      arm: "kill",
    },
    {
      name: "touch accepted through the record's own extra spans",
      // 12 away vertically (past the span of 8) and 9 away horizontally (past the span of 4),
      // both brought back in range by the record's own extents.
      opts: { board: 3, prevY: 100, records: [row({ x: X + 9, y: Y + 12, spanX: 0x20, spanY: 0x20 })] },
      arm: "sideways",
    },
  ];

  for (const { name, opts, arm } of cases) {
    const entry = craft(base, opts);
    assert.equal(classify(entry), arm, `${name}: the oracle took a different arm than the case claims`);
    const diffs = contractDiffs(entry, loc_29af);
    assert.equal(diffs.length, 0, `${name}: ${diffs.join("; ")}`);
  }

  // The record-recovery walk, at every index: only record `k` can match, so the routine must
  // walk k strides to read the right OBJ_Y. Each index gets a DIFFERENT object Y, so landing on
  // the wrong record produces a different MARIO_Y and the RAM diff sees it.
  for (let k = 0; k < RECORD_COUNT; k++) {
    const records = [];
    for (let i = 0; i < RECORD_COUNT; i++) {
      records.push(i === k ? row({ x: X, y: Y + k }) : row({ active: false }));
    }
    const entry = craft(base, { board: 3, records, marioX: X, marioY: Y, prevY: 40 });
    assert.equal(classify(entry), "on-top", `record index ${k}: expected the on-top arm`);
    const diffs = contractDiffs(entry, loc_29af);
    assert.equal(diffs.length, 0, `record index ${k}: ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/crafted: ${cases.length} arms + ${RECORD_COUNT} record indices identical to the oracle`);
});

// -- 4. EQUAL (exhaustive over the collapsed branch) ---------------------------

test("EQUAL (exhaustive): the collapsed velocity branch matches the oracle for all 256 X values", () => {
  const base = attractBase();
  const Y = 100;
  let trials = 0;
  const results = new Set();

  for (const vxHi of [0x00, 0x01, 0x80, 0xff]) {
    for (let x = 0; x < 256; x++) {
      const entry = craft(base, {
        board: 3, marioX: x, marioY: Y, prevY: Y, vxHi, spriteX: 0x5a,
        records: [touching(x, Y)],
      });
      assert.equal(classify(entry), "sideways", `x=${x} vxHi=${vxHi}: expected the sideways arm`);
      const diffs = contractDiffs(entry, loc_29af);
      assert.equal(diffs.length, 0, `x=${x} vxHi=${hx(vxHi)}: ${diffs.join("; ")}`);
      const o = entry.clone();
      oracle(o);
      results.add(`${x}:${o.mem.read8(MARIO_X)}`);
      trials++;
    }
  }
  // Non-vacuity of the collapse claim: the oracle produced exactly ONE output per input X across
  // all four velocity values, i.e. the branch it tests cannot change the stored X.
  assert.equal(results.size, 256,
    "the two velocity arms produced different X for some input — the collapse in loc_29af is wrong");
  console.log(`  EQUAL/exhaustive: ${trials} entries identical; the velocity branch yields 1 output per X`);
});

// -- 5. TEETH ------------------------------------------------------------------

/** Twin (a): decides the contact from Mario's CURRENT Y instead of the pre-motion snapshot. */
function brokenUsesCurrentY(m) {
  const { regs, mem8 } = m;
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return true;
  regs.iy = MARIO_ACTIVE; regs.c = mem8[MARIO_Y]; regs.l = 8; regs.h = 4;
  loc_2a22(m);
  if (regs.a === 0) return true;
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;
  regs.ix = record;
  const line = u8(mem8[record + OBJ_Y] - 4);
  const prev = mem8[MARIO_Y]; // BUG: the current Y, not MARIO_AIR_PREV_Y
  if (u8(prev + 5) < line) {
    mem8[MARIO_Y] = line - 8; mem8[EDGE_REPOSITION_FLAG] = 1; regs.a = 1; regs.b = 1; return false;
  }
  if (u8(prev - 14) >= line) { mem8[MARIO_ACTIVE] = 0; regs.a = 0; return true; }
  const x = (mem8[MARIO_X] | 7) - 4;
  mem8[MARIO_X] = x; mem8[MARIO_SPRITE_RECORD + SPRITE_X] = x; regs.a = 1; regs.b = 0; return false;
}

/** Twin (b): drops the board gate, so the contact check runs on every board. */
function brokenNoGate(m) {
  const { regs, mem8 } = m;
  regs.a = BOARD_MASK; // BUG: the gate's answer is discarded
  boardBitGate(m);
  regs.iy = MARIO_ACTIVE; regs.c = mem8[MARIO_Y]; regs.l = 8; regs.h = 4;
  loc_2a22(m);
  if (regs.a === 0) return true;
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;
  regs.ix = record;
  const line = u8(mem8[record + OBJ_Y] - 4);
  const prev = mem8[MARIO_AIR_PREV_Y];
  if (u8(prev + 5) < line) {
    mem8[MARIO_Y] = line - 8; mem8[EDGE_REPOSITION_FLAG] = 1; regs.a = 1; regs.b = 1; return false;
  }
  if (u8(prev - 14) >= line) { mem8[MARIO_ACTIVE] = 0; regs.a = 0; return true; }
  const x = (mem8[MARIO_X] | 7) - 4;
  mem8[MARIO_X] = x; mem8[MARIO_SPRITE_RECORD + SPRITE_X] = x; regs.a = 1; regs.b = 0; return false;
}

/** Twin (c): takes the search residue as the record index instead of count-minus-residue. */
function brokenRecordIndex(m) {
  const { regs, mem8 } = m;
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return true;
  regs.iy = MARIO_ACTIVE; regs.c = mem8[MARIO_Y]; regs.l = 8; regs.h = 4;
  loc_2a22(m);
  if (regs.a === 0) return true;
  const record = OBJ_ARRAY_66 + regs.b * RECORD_STRIDE; // BUG: not RECORD_COUNT - regs.b
  regs.ix = record;
  const line = u8(mem8[record + OBJ_Y] - 4);
  const prev = mem8[MARIO_AIR_PREV_Y];
  if (u8(prev + 5) < line) {
    mem8[MARIO_Y] = line - 8; mem8[EDGE_REPOSITION_FLAG] = 1; regs.a = 1; regs.b = 1; return false;
  }
  if (u8(prev - 14) >= line) { mem8[MARIO_ACTIVE] = 0; regs.a = 0; return true; }
  const x = (mem8[MARIO_X] | 7) - 4;
  mem8[MARIO_X] = x; mem8[MARIO_SPRITE_RECORD + SPRITE_X] = x; regs.a = 1; regs.b = 0; return false;
}

/** Twin (d): the sideways snap off by one — the collapsed expression must be exact. */
function brokenSidewaysSnap(m) {
  const { regs, mem8 } = m;
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return true;
  regs.iy = MARIO_ACTIVE; regs.c = mem8[MARIO_Y]; regs.l = 8; regs.h = 4;
  loc_2a22(m);
  if (regs.a === 0) return true;
  const record = OBJ_ARRAY_66 + (RECORD_COUNT - regs.b) * RECORD_STRIDE;
  regs.ix = record;
  const line = u8(mem8[record + OBJ_Y] - 4);
  const prev = mem8[MARIO_AIR_PREV_Y];
  if (u8(prev + 5) < line) {
    mem8[MARIO_Y] = line - 8; mem8[EDGE_REPOSITION_FLAG] = 1; regs.a = 1; regs.b = 1; return false;
  }
  if (u8(prev - 14) >= line) { mem8[MARIO_ACTIVE] = 0; regs.a = 0; return true; }
  const x = (mem8[MARIO_X] | 7) - 3; // BUG: off by one
  mem8[MARIO_X] = x; mem8[MARIO_SPRITE_RECORD + SPRITE_X] = x; regs.a = 1; regs.b = 0; return false;
}

test("TEETH: four broken twins are all CAUGHT", () => {
  const base = attractBase();
  const X = 0x60, Y = 100;

  // (a) the pre-motion snapshot: an entry whose CURRENT Y and PREVIOUS Y select different arms.
  const wrongY = craft(base, { board: 3, records: [touching(X, Y)], marioY: Y, prevY: 50 });
  assert.equal(classify(wrongY), "on-top", "sanity: the correct routine lands Mario here");
  assert.ok(contractDiffs(wrongY, brokenUsesCurrentY).length > 0,
    "the current-Y twin escaped — MARIO_AIR_PREV_Y is unproven");

  // (b) the board gate: a touching record on a board the gate closes.
  const closed = craft(base, { board: 4, records: [touching(X, Y)], prevY: 50 });
  assert.equal(classify(closed), "gate-closed", "sanity: the gate must close on board 4");
  assert.ok(contractDiffs(closed, brokenNoGate).length > 0,
    "the no-gate twin escaped — the board gate is unproven");

  // (c) the record walk: the only touching record is at index 4, so an index taken as the search
  //     residue (2) reads a different record's Y.
  const records = [];
  for (let i = 0; i < RECORD_COUNT; i++) records.push(i === 4 ? row({ x: X, y: Y }) : row({ active: false }));
  records[2] = row({ active: false, y: Y + 40 }); // a decoy Y at the index the broken twin reads
  const walk = craft(base, { board: 3, records, marioX: X, marioY: Y, prevY: 50 });
  assert.equal(classify(walk), "on-top", "sanity: the correct routine lands Mario on record 4");
  assert.ok(contractDiffs(walk, brokenRecordIndex).length > 0,
    "the record-index twin escaped — the count-minus-residue recovery is unproven");

  // (d) the sideways snap.
  const sideways = craft(base, { board: 3, records: [touching(X, Y)], marioX: X, prevY: Y });
  assert.equal(classify(sideways), "sideways", "sanity: this entry must take the sideways arm");
  assert.ok(contractDiffs(sideways, brokenSidewaysSnap).length > 0,
    "the off-by-one snap twin escaped — the collapsed expression is unproven");

  console.log("  TEETH: all four broken twins caught");
});

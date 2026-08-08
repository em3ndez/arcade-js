// SPDX-License-Identifier: GPL-3.0-only
/**
 * unpackTheFirstThreeSwitchSettings — memory-equivalent to the frozen oracle at ROM 0x2E19.
 *
 * GATE: real capture plus exhaustive crafted sweeps, compared at TWO transfer depths.
 *
 * ★ THE ORACLE NEVER RETURNS, so the comparison needs a floor. 0x2E19 ends in a tail jump to
 *   0x49A8, which itself tails into 0x32EB and on into the foreground loop, so running the oracle
 *   to completion runs the game. Both sides are therefore STOPPED at a chosen address by a stub
 *   installed in the same registry both of them dispatch through, and the stub RECORDS the
 *   register file as it stops. Two depths are used and they measure different things:
 *     SHALLOW (0x49A8) — the transfer itself. RAM shows only this routine's own three writes, and
 *       the recorded registers are exactly what this routine hands the continuation. This is the
 *       only depth at which a rewrite that hands on the wrong VALUE can be caught, because at
 *       that instant the value has not been written anywhere yet.
 *     DEEP (0x32EB) — the transfer plus the whole of 0x49A8: two more unpacked cells, a watchdog
 *       kick, a latch write, a called subroutine and a 256-byte ROM checksum. What this depth
 *       adds is that PART of the handed-on value is consumed, so a wrong one can show up in RAM.
 *   ★ Only part, and the teeth counts below measure which part. The continuation masks away
 *     exactly the bits that a shift loses and a rotate keeps, so the shift twin is caught on 224
 *     of 256 packed values at the shallow depth and on NONE at the deep one. The shallow depth is
 *     not a cheaper version of the deep one; it is the only arm that sees that class of error.
 *
 * ★ WHAT THE EXCLUDED SET IS, AND WHY IT SHRINKS WITH DEPTH. Measured, both depths, over every
 *   sweep below: at the shallow boundary the flag byte is the only register that diverges — the
 *   oracle leaves the flags its last bit-mask set and the rewrite leaves the caller's. At the
 *   deep boundary NOTHING diverges, because 0x49A8 overwrites the flags before it ends. EXCLUDED
 *   is a CEILING checked as a subset, so the deep arm passing with an empty set does not fail it.
 *
 * ★ THE PUSH FOOTPRINT IS MEASURED at the shallow depth, not assumed: the frozen side reaches
 *   zero bytes below its seat, so the whole dump is compared there with nothing masked. The deep
 *   continuation does push, and those bytes are compared like any others — both sides reach them
 *   through the same still-frozen code, so nothing is excluded at that depth either.
 *
 * What it exercises, holes stated:
 *   1. DISPATCHED — the real boot reaches this address under both tapes; the entry is captured
 *      and the arms below start from it. This is the vacuity guard.
 *   2. WRITE-SET — which cells the ORACLE moves, measured as a full-dump diff over the whole
 *      packed sweep rather than read off its operands.
 *   3. CAPTURED — the real entry state, at both depths.
 *   4. PACKED — all 256 values of the packed byte, at both depths.
 *   5. WHOLE — all 256 values of the byte the caller arrives with, at the shallow depth.
 *   6. CROSS — a 64x64 grid over both bytes together, at the shallow depth.
 *   7. HANDED ON — the two registers the transfer carries, asserted equal across the whole
 *      packed sweep and asserted to be a ROTATE and not a shift.
 *   8. EXCLUDED — no register outside the ceiling moves, with a control twin that scribbles.
 *   9. TEETH — six twins with exact catch counts.
 *
 * HOLE: a diff cannot see a write that stores a cell's own value back, so the write-set arm is a
 * lower bound on what the oracle touches, not an exclusivity claim about who else writes there.
 * HOLE: the cross is a grid and not the full 65536 pairs; the two marginals are exhaustive.
 * HOLE: nothing here follows the chain past 0x32EB, so what the foreground loop does with the two
 * cells the deep arm leaves is outside this file.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2e19.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { unpackTheFirstThreeSwitchSettings } from "../unpackTheFirstThreeSwitchSettings.js";
import { loc_2e19 as oracle } from "../../translated/loc_2e19.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2e19;
const SHALLOW = 0x49a8; // the address this routine transfers into
const DEEP = 0x32eb; // the address that continuation in turn transfers into
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** The three cells this routine opens, and the bit each of the last two takes. */
const WHOLE_BYTE_CELL = 0xa9c1;
const BIT_CELLS = [
  { cell: 0xa9c2, bit: 2 },
  { cell: 0xa9c3, bit: 3 },
];
const ROTATION = 3;

/** The two cells the DEEP continuation opens, so the deep arm can be shown to reach them. */
const DEEP_CELLS = [0xa9c4, 0xa9c6];

const VALUES = 256;
const CROSS_STEP = 4; // a 64x64 grid over the two bytes together
const WHOLE_SAMPLES = [0, 1, 3, 5, 128, 255];

/**
 * The ceiling on divergence: the flag byte, which the oracle leaves set by its last bit-mask and
 * the rewrite leaves alone. Checked as a SUBSET, so an arm on which nothing diverges still passes
 * and a rewrite that became flag-exact would not be refused.
 */
const EXCLUDED = ["f"];

/** Measured by the WRITE-SET arm at the shallow depth: the oracle reaches nothing below its seat. */
const SHALLOW_SCRATCH_BYTES = 0;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "registers" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical";

// ── the rig: one machine, two stubs, a switch ───────────────────────────────────────────

let stopAt = null;
let recorded = null;

/**
 * A machine whose registry stops at `stopAt` and records the registers there. The stubs delegate
 * to the real routines whenever `stopAt` is null, which is what lets the host run boot normally
 * and reach the target at all.
 */
function rig(opts = {}, onEntry = null) {
  const overrides = new Map();
  overrides.set(TARGET, (mm) => {
    if (onEntry) onEntry(mm);
    return oracle(mm);
  });
  for (const floor of [SHALLOW, DEEP]) {
    const real = TRANSLATED.get(floor);
    overrides.set(floor, (mm) => {
      if (stopAt !== floor) return real(mm);
      recorded = Object.fromEntries(REG_FIELDS.map((k) => [k, mm.regs[k]]));
      return undefined;
    });
  }
  return makeMachine(overrides, opts);
}

const captured = new Map();

/** The real machine at this routine's one boot dispatch, under the named tape. */
function capture(tapeLabel) {
  if (captured.has(tapeLabel)) return captured.get(tapeLabel);
  let entry = null;
  let atFrame = -1;
  const m = rig(tapeLabel === "undriven" ? { tape: [] } : {}, (mm) => {
    if (entry === null) {
      entry = mm.clone();
      atFrame = mm.frames.length;
    }
  });
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the ${tapeLabel} capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, `the ${tapeLabel} capture run ran short`);
  captured.set(tapeLabel, { entry, atFrame });
  return captured.get(tapeLabel);
}

function entryState() {
  const { entry } = capture("coin-start");
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** A clone of the captured entry with the two bytes the routine consumes set by hand. */
function crafted(whole, packed) {
  const m = entryState().clone();
  m.regs.a = whole;
  m.regs.c = packed;
  return m;
}

/**
 * Oracle vs candidate on independent clones, stopped at `depth`: the whole state dump, the
 * registers recorded AT the transfer, and the registers left behind afterwards.
 */
function unitDiff(candidate, make, depth) {
  stopAt = depth;
  const a = make();
  const b = make();
  recorded = null;
  oracle(a);
  const atA = recorded;
  recorded = null;
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "stopped cleanly", b: String(e).slice(0, 50) };
  }
  const atB = recorded;
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  if (atA === null || atB === null) {
    return { addr: null, a: atA === null ? "no transfer" : "transferred", b: atB === null ? "no transfer" : "transferred" };
  }
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (atA[k] !== atB[k]) return { addr: null, a: `handed on ${k}=${atA[k]}`, b: `handed on ${k}=${atB[k]}` };
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `left ${k}=${a.regs[k]}`, b: `left ${k}=${b.regs[k]}` };
  }
  return null;
}

/** Every value of the packed byte, at one depth. Returns how many diverged. */
function sweepPacked(candidate, depth, whole = 3) {
  let caught = 0;
  for (let packed = 0; packed < VALUES; packed++) {
    if (unitDiff(candidate, () => crafted(whole, packed), depth)) caught++;
  }
  return caught;
}

/** Every value of the byte the caller arrives with, at the shallow depth. */
function sweepWhole(candidate, packed = 0xb4) {
  let caught = 0;
  for (let whole = 0; whole < VALUES; whole++) {
    if (unitDiff(candidate, () => crafted(whole, packed), SHALLOW)) caught++;
  }
  return caught;
}

/** A grid over the two bytes together. */
function sweepCross(candidate) {
  let caught = 0;
  for (let whole = 0; whole < VALUES; whole += CROSS_STEP) {
    for (let packed = 0; packed < VALUES; packed += CROSS_STEP) {
      if (unitDiff(candidate, () => crafted(whole, packed), SHALLOW)) caught++;
    }
  }
  return caught;
}

const CROSS_SIZE = (VALUES / CROSS_STEP) ** 2;

/** How far below its seat the oracle's own pushes take the stack pointer, at one depth. */
function pushDepth(machine, depth) {
  stopAt = depth;
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  oracle(c);
  return seat - deepest;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: shifts the packed byte instead of rotating it, so the bits above are lost. */
function brokenShiftsNotRotates(m) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = regs.a;
  for (const { cell, bit } of BIT_CELLS) mem8[cell] = (regs.c >> bit) & 1;
  const unspent = regs.c >> ROTATION;
  regs.a = unspent;
  regs.c = unspent;
  return m.call(SHALLOW);
}

/** BUG: takes the two bits one place too low. */
function brokenBitsOffByOne(m) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = regs.a;
  for (const { cell, bit } of BIT_CELLS) mem8[cell] = (regs.c >> (bit - 1)) & 1;
  const unspent = ((regs.c >> ROTATION) | (regs.c << (8 - ROTATION))) & 0xff;
  regs.a = unspent;
  regs.c = unspent;
  return m.call(SHALLOW);
}

/** BUG: the two single-bit cells are the wrong way round. */
function brokenCellsSwapped(m) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = regs.a;
  mem8[BIT_CELLS[0].cell] = (regs.c >> BIT_CELLS[1].bit) & 1;
  mem8[BIT_CELLS[1].cell] = (regs.c >> BIT_CELLS[0].bit) & 1;
  const unspent = ((regs.c >> ROTATION) | (regs.c << (8 - ROTATION))) & 0xff;
  regs.a = unspent;
  regs.c = unspent;
  return m.call(SHALLOW);
}

/** BUG: puts the packed byte in the whole-byte cell instead of the byte the caller brought. */
function brokenWrongSource(m) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = regs.c;
  for (const { cell, bit } of BIT_CELLS) mem8[cell] = (regs.c >> bit) & 1;
  const unspent = ((regs.c >> ROTATION) | (regs.c << (8 - ROTATION))) & 0xff;
  regs.a = unspent;
  regs.c = unspent;
  return m.call(SHALLOW);
}

/** BUG: stores the whole bit-field rather than the single bit, so neighbouring bits leak in. */
function brokenKeepsTheHighBits(m) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = regs.a;
  for (const { cell, bit } of BIT_CELLS) mem8[cell] = regs.c >> bit;
  const unspent = ((regs.c >> ROTATION) | (regs.c << (8 - ROTATION))) & 0xff;
  regs.a = unspent;
  regs.c = unspent;
  return m.call(SHALLOW);
}

/** BUG: hands the value on in one register only, the in-arm control for the register ceiling. */
function brokenHandsOnOnce(m) {
  const { mem8, regs } = m;
  mem8[WHOLE_BYTE_CELL] = regs.a;
  for (const { cell, bit } of BIT_CELLS) mem8[cell] = (regs.c >> bit) & 1;
  regs.a = ((regs.c >> ROTATION) | (regs.c << (8 - ROTATION))) & 0xff;
  return m.call(SHALLOW);
}

/**
 * Each twin with the EXACT number of sweep points that must catch it, so the counts in this
 * file's header cannot rot and a twin that quietly stops being caught cannot read as a pass.
 * The zero is the finding: a shift survives the deep arm entirely.
 */
const TWINS = [
  ["no-op", brokenNoOp, [256, 256, 256]],
  ["shifts-not-rotates", brokenShiftsNotRotates, [224, 0, 256]],
  ["bits-off-by-one", brokenBitsOffByOne, [192, 192, 256]],
  ["cells-swapped", brokenCellsSwapped, [128, 128, 256]],
  ["wrong-source", brokenWrongSource, [255, 255, 255]],
  ["keeps-the-high-bits", brokenKeepsTheHighBits, [248, 248, 256]],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("DISPATCHED: the real boot reaches this address under both tapes", { skip }, () => {
  for (const tapeLabel of ["coin-start", "undriven"]) {
    const { entry, atFrame } = capture(tapeLabel);
    assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
    console.log(`  DISPATCHED: ${tapeLabel} entered ${hex4(TARGET)} first at frame ${atFrame}`);
  }
  const e = entryState();
  console.log(`  DISPATCHED: entry carries whole=${e.regs.a}, packed=${e.regs.c}`);
});

test("WRITE-SET: which cells the oracle moves, measured over the packed sweep", { skip }, () => {
  stopAt = SHALLOW;
  const moved = new Set();
  for (let packed = 0; packed < VALUES; packed++) {
    const before = crafted(3, packed);
    const after = before.clone();
    oracle(after);
    const x = before.dumpState();
    const y = after.dumpState();
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) moved.add(after.stateOffsetToAddr(i));
  }
  const expected = [WHOLE_BYTE_CELL, ...BIT_CELLS.map((c) => c.cell)].sort((p, q) => p - q);
  assert.deepEqual([...moved].sort((p, q) => p - q), expected,
    "the oracle's measured write-set at the transfer is not the three cells this file describes");
  const seat = pushDepth(entryState(), SHALLOW);
  assert.equal(seat, SHALLOW_SCRATCH_BYTES,
    "the oracle now pushes before it transfers, so the whole-dump comparison below is reading " +
      "stack scratch it has no right to");
  console.log(`  WRITE-SET: ${[...moved].sort((p, q) => p - q).map(hex4).join(" ")}, ` +
    `${seat} bytes below the seat`);
});

test("CAPTURED: the real entry is identical at both depths", { skip }, () => {
  for (const depth of [SHALLOW, DEEP]) {
    const d = unitDiff(unpackTheFirstThreeSwitchSettings, () => entryState().clone(), depth);
    assert.equal(d, null, `stopped at ${hex4(depth)}: ${show(d)}`);
  }
  console.log("  CAPTURED: the boot entry replays identically at both depths");
});

test("PACKED: all 256 values of the packed byte, at both depths", { skip }, () => {
  for (const depth of [SHALLOW, DEEP]) {
    assert.equal(sweepPacked(unpackTheFirstThreeSwitchSettings, depth), 0, `a packed value diverged at ${hex4(depth)}`);
  }
  // The deep depth is only worth running if it really does consume the handed-on value.
  stopAt = DEEP;
  const seen = new Set();
  for (const packed of [0, 0x55, 0xaa, 0xff]) {
    const c = crafted(3, packed);
    oracle(c);
    seen.add(DEEP_CELLS.map((a) => c.mem8[a]).join(","));
  }
  assert.ok(seen.size > 1, "the deep continuation left the same bytes for every packed value, " +
    "so that depth is not consuming what this routine hands it and adds nothing");
  console.log(`  PACKED: ${VALUES} values identical at each depth; the deep continuation left ` +
    `${seen.size} distinct pairs in the cells it opens`);
});

test("WHOLE: all 256 values of the byte the caller arrives with", { skip }, () => {
  assert.equal(sweepWhole(unpackTheFirstThreeSwitchSettings), 0, "a whole-byte value diverged");
  for (const whole of WHOLE_SAMPLES) {
    stopAt = SHALLOW;
    const c = crafted(whole, 0xb4);
    oracle(c);
    assert.equal(c.mem8[WHOLE_BYTE_CELL], whole, "the whole byte must land unaltered");
  }
  console.log(`  WHOLE: ${VALUES} values identical, and the byte lands unaltered`);
});

test("CROSS: a grid over both bytes together", { skip }, () => {
  assert.equal(sweepCross(unpackTheFirstThreeSwitchSettings), 0, "a pair of bytes diverged");
  console.log(`  CROSS: ${CROSS_SIZE} pairs identical`);
});

test("HANDED ON: the transfer carries a ROTATE of the packed byte, twice over", { skip }, () => {
  stopAt = SHALLOW;
  let rotated = 0;
  for (let packed = 0; packed < VALUES; packed++) {
    const c = crafted(3, packed);
    recorded = null;
    oracle(c);
    const want = ((packed >> ROTATION) | (packed << (8 - ROTATION))) & 0xff;
    assert.equal(recorded.a, want, `packed=${packed}: the handed-on byte is not a rotate`);
    assert.equal(recorded.c, want, `packed=${packed}: the second copy does not match the first`);
    if (want !== packed >> ROTATION) rotated++;
  }
  // Without this the arm above is satisfied by a plain shift on every value that has no high
  // bits to lose, which is a third of the byte range.
  assert.ok(rotated > 0, "no packed value distinguished a rotate from a shift, so this arm " +
    "cannot tell the two apart and the twin below proves nothing");
  console.log(`  HANDED ON: ${VALUES} values, ${rotated} of them separate a rotate from a shift`);
});

/** Which registers a candidate parts company with the oracle on, over the packed sweep. */
function movedOver(candidate, depth) {
  stopAt = depth;
  const moved = new Set();
  for (let packed = 0; packed < VALUES; packed++) {
    const a = crafted(3, packed);
    const b = crafted(3, packed);
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: only the flag byte, and only at the shallow depth", { skip }, () => {
  const shallow = movedOver(unpackTheFirstThreeSwitchSettings, SHALLOW);
  const deep = movedOver(unpackTheFirstThreeSwitchSettings, DEEP);
  const control = movedOver(brokenHandsOnOnce, SHALLOW);
  // The clean readings are evidence only because the same measurement, in the same breath,
  // reports a register outside the ceiling for a twin that hands the value on only once.
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that hands the value " +
      "on once, so a clean reading here proves nothing");
  const moved = REG_FIELDS.filter((k) => shallow.has(k));
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.deepEqual(REG_FIELDS.filter((k) => deep.has(k)), [],
    "a register diverges at the deep depth, where the continuation was measured to overwrite " +
      "everything this routine leaves");
  console.log(`  EXCLUDED (measured): shallow ${moved.join(", ") || "nothing"}; deep ` +
    `${REG_FIELDS.filter((k) => deep.has(k)).join(", ") || "nothing"}; control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on an exact count`, { skip }, () => {
    const got = [sweepPacked(twin, SHALLOW), sweepPacked(twin, DEEP), sweepWhole(twin)];
    console.log(`  TEETH/${label}: caught on ${got[0]}/${VALUES} packed shallow, ` +
      `${got[1]}/${VALUES} packed deep, ${got[2]}/${VALUES} whole`);
    assert.ok(got[0] + got[1] + got[2] > 0, `every sweep PASSED the ${label} twin`);
    assert.deepEqual(got, expected, `the ${label} twin's catch counts moved`);
  });
}

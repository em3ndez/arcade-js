// SPDX-License-Identifier: GPL-3.0-only
/**
 * postNextParachutistBonus — memory-equivalent to the frozen oracle at ROM 0x4831.
 *
 * GATE: strict unit-capture at a real dispatch — reached by an UNDRIVEN attract run rather than by
 *   the shared tape, which is asserted below — plus an EXHAUSTIVE sweep over the step number, which
 *   with the countdown byte is the whole of what this entry reads. Holes stated:
 *
 *   1. REACHED, and only by attract — both asserted, so the choice of tape cannot quietly become
 *      "we never reached it".
 *   2. EQUAL at the real dispatch — everything outside a two-byte dead scratch window below the
 *      entry stack pointer. Pinned by every arm.
 *   3. THE COMMAND PAIR IS A LIVE-OUT and is compared as well as memory: the frozen entry leaves
 *      the pair standing in the registers, and a rewrite that queued the right pair while leaving
 *      the registers wrong would pass a memory-only comparison.
 *   4. EXHAUSTIVE — the step number 0..255 crossed with the ring's own state, which is what
 *      decides whether the pair is queued or dropped. Both branches are therefore covered.
 *   5. BOTH SIDES OF THE STEP LIMIT REACHED, asserted: the sweep is shown to contain numbers that
 *      take an argument from the table and numbers that take the fixed one, and the two argument
 *      sets are shown to be different.
 *   6. TEETH — eight twins, each caught on its own exact count over the sweep; three of them
 *      differ from the real entry on a handful of step numbers only.
 *
 * HOLE: what the queued pair MEANS is not decidable here — the command byte is consumed by a ring
 * reader this gate never runs. It fixes which pair goes out for which step number.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4831.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { postNextParachutistBonus } from "../postNextParachutistBonus.js";
import { loc_4831 as oracle } from "../../translated/loc_4831.js";
import { offsetAddress } from "../offsetAddress.js";
import { postCommand } from "../postCommand.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { COMMAND_RING } from "../names.js";

const TARGET = 0x4831;

const COUNTDOWN = 0;
const STEP = 7;
const STEP_TABLE = 0x484f;
const STEPS = 4;
const COMMAND = 4;
const PAST_THE_LAST_STEP = 15;

const RING_CELLS = 64;
const WRITE_CURSOR = 0xa9b2;
const SCRATCH_BYTES = 2;

/** The registers allowed to differ. The command pair D/E is a live-out, so it must NOT be here. */
const EXCLUDED = ["a", "f", "sp"];

/** The attract run this entry is reached by, and the frame it is first reached on. Measured. */
const ATTRACT_FRAMES = 3000;
const FIRST_DISPATCH = 2758;
const DISPATCHES = 1;

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function outsideScratch(a, b, sp) {
  return allDiffs(a, b).filter((d) => d.addr < sp - SCRATCH_BYTES || d.addr >= sp);
}

/** Oracle vs candidate on two clones: masked memory first, then the pair left in the registers. */
function compare(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = outsideScratch(a, b, sp)[0];
  if (ram) return ram;
  if (a.regs.d !== b.regs.d) return { addr: null, a: a.regs.d, b: b.regs.d };
  if (a.regs.e !== b.regs.e) return { addr: null, a: a.regs.e, b: b.regs.e };
  return null;
}

let captured = null;
let firstFrame = null;
let dispatchCount = 0;

function capture() {
  if (captured !== null) return captured;
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatchCount++;
      if (captured === null) {
        captured = mm.clone();
        firstFrame = mm.frames.length;
      }
      return oracle(mm);
    }]]),
    { tape: [] },
  );
  m.runFrames(ATTRACT_FRAMES);
  assert.equal(m.stoppedBy, null, `attract run stopped early: ${m.stoppedBy}`);
  return captured;
}

function entryState() {
  const e = capture();
  assert.notEqual(e, null, "vacuous: the attract run never reached the routine");
  return e;
}

/** A real captured machine with the step number and the ring's free/occupied state forced. */
function craft(step, free) {
  const m = entryState().clone();
  m.mem8[m.regs.ix + STEP] = step;
  m.mem8[COMMAND_RING + m.mem8[WRITE_CURSOR]] = free ? 0xff : 0x00;
  return m;
}

const SWEEP_SIZE = 256 * 2;

function sweepCaught(candidate) {
  let caught = 0;
  for (const free of [true, false]) {
    for (let step = 0; step < 256; step++) if (compare(candidate, craft(step, free))) caught++;
  }
  return caught;
}

/** The argument the frozen entry queues for one step number, read back out of the ring. */
function argumentFor(step) {
  const m = craft(step, true);
  const cursor = m.mem8[WRITE_CURSOR];
  oracle(m);
  return m.mem8[COMMAND_RING + ((cursor + 1) & 0xff)];
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHED, and only by the undriven attract run", { skip }, () => {
  const entry = entryState();
  assert.equal(dispatchCount, DISPATCHES, "the dispatch count on the attract run moved");
  assert.equal(firstFrame, FIRST_DISPATCH, "the frame it is first reached on moved");
  let onShared = 0;
  const shared = makeMachine(new Map([[TARGET, (mm) => (onShared++, oracle(mm))]]));
  shared.runFrames(ENTRY_FRAMES);
  assert.equal(onShared, 0, "the shared tape now reaches it, so this gate should use that instead");
  console.log(
    `  REACHED: ${dispatchCount} dispatch at frame ${firstFrame} in attract, ${onShared} on the ` +
      `shared tape; record ${hex4(entry.regs.ix)}, step ${entry.mem8[entry.regs.ix + STEP]}`,
  );
});

test("EQUAL at the real dispatch: identical outside the scratch window", { skip }, () => {
  const entry = entryState();
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  postNextParachutistBonus(b);
  assert.deepEqual(
    outsideScratch(a, b, sp),
    [],
    `a divergence escaped the scratch window — ${show(outsideScratch(a, b, sp)[0])}`,
  );
  assert.equal(a.regs.d, b.regs.d, "the command byte left behind diverged");
  assert.equal(a.regs.e, b.regs.e, "the argument byte left behind diverged");
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set: the command pair is a live-out and is not in it",
  );
  console.log(`  EQUAL: pair ${a.regs.d}/${a.regs.e}; identical outside [SP-${SCRATCH_BYTES}, SP)`);
});

test("IT COUNTS AND IT STEPS: both bytes of the record move", { skip }, () => {
  const before = entryState().clone();
  const after = before.clone();
  const record = before.regs.ix;
  oracle(after);
  assert.equal(
    after.mem8[record + COUNTDOWN],
    (before.mem8[record + COUNTDOWN] - 1) & 0xff,
    "the countdown byte no longer falls by one",
  );
  assert.equal(
    after.mem8[record + STEP],
    (before.mem8[record + STEP] + 1) & 0xff,
    "the step number no longer climbs by one",
  );
  console.log(
    `  RECORD: countdown ${before.mem8[record + COUNTDOWN]}->${after.mem8[record + COUNTDOWN]}, ` +
      `step ${before.mem8[record + STEP]}->${after.mem8[record + STEP]}`,
  );
});

test("EXHAUSTIVE: 256 step numbers, with the ring free and with it occupied", { skip }, () => {
  for (const free of [true, false]) {
    for (let step = 0; step < 256; step++) {
      const d = compare(postNextParachutistBonus, craft(step, free));
      assert.equal(d, null, `step=${step} free=${free}: ${show(d)}`);
    }
  }
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} step x ring combinations identical`);
});

test("BOTH SIDES OF THE STEP LIMIT: the table arm and the fixed arm differ", { skip }, () => {
  const fromTable = [];
  for (let step = 0; step < STEPS; step++) fromTable.push(argumentFor(step));
  const past = [argumentFor(STEPS), argumentFor(100), argumentFor(255)];
  assert.deepEqual(
    past,
    [PAST_THE_LAST_STEP, PAST_THE_LAST_STEP, PAST_THE_LAST_STEP],
    "past the last step the argument is no longer the fixed one",
  );
  assert.equal(
    new Set(fromTable).size,
    STEPS,
    "the four table steps no longer give four different arguments, so a rewrite reading the " +
      "wrong table entry could pass",
  );
  assert.ok(
    !fromTable.includes(PAST_THE_LAST_STEP),
    "a table step now gives the fixed argument, so the two arms are no longer distinguishable",
  );
  console.log(`  ARMS: table arguments ${fromTable.join(",")}, past the end ${PAST_THE_LAST_STEP}`);
});

test("THE COMMAND_RING IS THE OTHER BRANCH: an occupied cell drops the pair", { skip }, () => {
  const occupied = craft(0, false);
  const before = occupied.clone();
  oracle(occupied);
  const movedInTheRing = allDiffs(before, occupied).filter(
    (d) => d.addr >= COMMAND_RING && d.addr < COMMAND_RING + RING_CELLS,
  );
  assert.deepEqual(movedInTheRing, [], "an occupied ring cell no longer drops the pair");
  console.log("  COMMAND_RING: with the cursor's cell occupied, nothing is queued");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

function stage(m, o) {
  const { mem8, regs } = m;
  const record = regs.ix;
  mem8[record + COUNTDOWN] = mem8[record + COUNTDOWN] - (o.countdownStep ?? 1);
  const step = mem8[record + STEP];
  mem8[record + STEP] = step + (o.stepStep ?? 1);
  let argument = o.pastArgument ?? PAST_THE_LAST_STEP;
  if (step < (o.limit ?? STEPS)) {
    regs.hl = o.table ?? STEP_TABLE;
    regs.a = step;
    argument = mem8[offsetAddress(m)];
  }
  const command = o.command ?? COMMAND;
  regs.d = command;
  regs.e = argument;
  postCommand(m, command, argument);
}

const TWINS = [
  ["no-op", () => {}, 512],
  ["limit-one-low", (m) => stage(m, { limit: STEPS - 1 }), 2],
  ["limit-one-high", (m) => stage(m, { limit: STEPS + 1 }), 2],
  ["table-off-by-one", (m) => stage(m, { table: STEP_TABLE + 1 }), 8],
  ["wrong-command", (m) => stage(m, { command: COMMAND + 1 }), 512],
  ["wrong-fixed-argument", (m) => stage(m, { pastArgument: PAST_THE_LAST_STEP + 1 }), 504],
  ["steps-before-reading", (m) => {
    const record = m.regs.ix;
    m.mem8[record + STEP] = m.mem8[record + STEP] + 1;
    stage(m, { stepStep: 0 });
  }, 10],
  ["no-countdown", (m) => stage(m, { countdownStep: 0 }), 512],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the sweep`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${SWEEP_SIZE} sweep entries`);
  });
}

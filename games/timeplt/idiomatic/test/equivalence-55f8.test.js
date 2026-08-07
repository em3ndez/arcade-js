// SPDX-License-Identifier: GPL-3.0-only
/**
 * sendSoundCommand — memory-equivalent to the frozen oracle at ROM 0x55F8.
 *
 * ★ RAM IS STRUCTURALLY BLIND TO THIS ROUTINE AND THIS GATE SAYS SO. Every write it makes lands
 *   on a hardware register, and the state dump this project diffs covers colour, video, work and
 *   the two sprite banks — not the hardware. A do-nothing candidate is therefore identical on RAM
 *   at every dispatch, which is ASSERTED here rather than glossed. The gate is two other things:
 *   the device state afterwards (the byte in the sound latch and the eight latch outputs), and the
 *   ORDERED SEQUENCE OF HARDWARE WRITES, which is the only instrument that can see a pulse whose
 *   two edges cancel.
 *
 * GATE: strict unit-capture on the coin-and-start tape, every captured dispatch replayed, an
 *   exhaustive sweep of all 256 command bytes, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — RAM, device state and the write sequence all identical.
 *   2. VACUITY, MEASURED — a no-op PASSES the RAM diff, and the two arms that do catch it are
 *      named, so nobody can later read the RAM arm as coverage.
 *   3. EXCLUDED, deliberately: the stack pointer and pc, and nothing else. The accumulator is NOT
 *      in the moved set, because the rewrite reproduces the zero the last latch write leaves.
 *   4. CORPUS — every dispatch the tape produces, with the set of command bytes it presented.
 *   5. EXHAUSTIVE — all 256 command bytes.
 *   6. THE PULSE IS ONLY VISIBLE IN THE WRITE ORDER, and that is measured, not argued: the arm
 *      shows the after-state of a candidate that never pulses is IDENTICAL, and that the write
 *      sequence tells them apart.
 *   7. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *   8. TEETH — five twins, each with its catch count on the sweep and its verdict at the real
 *      dispatch declared exactly.
 *
 * HOLE: pulse WIDTH is not gated and cannot be here. The idle stretch between the two edges is
 *   time; the write sequence records order, not duration. The shim pays the oracle's whole charge
 *   so the width survives into the whole-machine arm's timing, but nothing asserts it.
 * HOLE: the recorded CYCLE STAMP on each write is deliberately not compared. The rewrite charges
 *   no time, so its three writes carry one stamp where the original's carry three.
 * HOLE: nothing here runs the audio processor, so whether the byte means what it is called is
 *   outside everything this file can see.
 * HOLE: the FIRST dispatch carries the command byte zero, which is also the value left in the
 *   accumulator, so a candidate that keeps the command instead of clearing it is INVISIBLE there.
 *   One byte of the 256 is blind to it for the same reason, and both are asserted as exact values.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-55f8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { sendSoundCommand } from "../sendSoundCommand.js";
import { loc_55f8 as oracle } from "../../translated/loc_55f8.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { LATCH_AUDIO_IRQ } from "../../../../boards/timeplt/io.js";

const TARGET = 0x55f8;

const SOUND_LATCH = 0xc000;
const AUDIO_ATTENTION = 0xc304;
const WRONG_PORT = 0xc306;
const WRITE_BUS_CYCLE = 10;

const MOVED = ["sp"];
const CORPUS_FRAMES = 1400;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 22;
const COMMANDS_SEEN = 19;

const COMMANDS = Array.from({ length: 256 }, (_unused, c) => c);

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides);

/** The device state this routine can move, as one comparable string. */
const deviceState = (m) => `${m.io.soundData}:${[...m.io.latch].join("")}`;

/** The ordered hardware writes, addresses and values only — the cycle stamp is a hole above. */
const writeOrder = (m) =>
  (m.mem.writeTrace ?? []).map((w) => `${hex4(w.addr)}=${w.value}`).join(" ");

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: ENTRY_FRAMES });
}

function entryState() {
  if (entry === null) gate(sendSoundCommand);
  return entry;
}

/** Oracle vs candidate on clones of one machine: RAM, device state, write order, accumulator. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  a.mem.writeTrace = [];
  b.mem.writeTrace = [];
  oracle(a);
  candidate(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    device: deviceState(a) === deviceState(b) ? null : `${deviceState(a)} vs ${deviceState(b)}`,
    writes: writeOrder(a) === writeOrder(b) ? null : `[${writeOrder(a)}] vs [${writeOrder(b)}]`,
    accumulator: a.regs.a === b.regs.a ? null : `${a.regs.a} vs ${b.regs.a}`,
  };
}

const caught = (candidate, machine) => {
  const d = unitDiff(candidate, machine);
  return d.device !== null || d.ram !== null || d.writes !== null || d.accumulator !== null;
};

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const commands = new Set();
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    commands.add(mm.regs.a);
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "corpus run ran short");
  corpus = { entries, commands };
  return corpus;
}

/** A real captured machine holding one chosen command byte — the crafted-entry idiom. */
function withCommand(command) {
  const m = entryState().clone();
  m.regs.a = command;
  return m;
}

const sweepCaught = (candidate) => COMMANDS.filter((c) => caught(candidate, withCommand(c))).length;

// ── the shim, measured rather than asserted ─────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

const put = (m, addr, value) => m.mem.write8(addr, value, WRITE_BUS_CYCLE);

/** BUG: does nothing at all — invisible on RAM, which is what the vacuity arm is about. */
function brokenNoOp() {}

/** BUG: leaves the byte in the latch and never knocks, so the other processor never looks. */
function brokenNoPulse(m) {
  put(m, SOUND_LATCH, m.regs.a);
  m.regs.a = 0;
}

/** BUG: raises the attention line and leaves it up, so the next byte cannot make an edge. */
function brokenLatchStaysHigh(m) {
  put(m, SOUND_LATCH, m.regs.a);
  put(m, AUDIO_ATTENTION, 1);
  m.regs.a = 0;
}

/** BUG: knocks on a different door — a neighbouring bit of the same latch chip. */
function brokenWrongLatchBit(m) {
  put(m, SOUND_LATCH, m.regs.a);
  put(m, WRONG_PORT, 1);
  put(m, WRONG_PORT, 0);
  m.regs.a = 0;
}

/** BUG: keeps the command in the accumulator instead of the zero the last write leaves. */
function brokenKeepsCommand(m) {
  const command = m.regs.a;
  put(m, SOUND_LATCH, command);
  put(m, AUDIO_ATTENTION, 1);
  put(m, AUDIO_ATTENTION, 0);
  m.regs.a = command;
}

/** Per twin: exact catch count over the 256-byte sweep, and whether the real dispatch sees it. */
const TWINS = [
  ["no-op", brokenNoOp, 256, true],
  ["no-pulse", brokenNoPulse, 256, true],
  ["latch-stays-high", brokenLatchStaysHigh, 256, true],
  ["wrong-latch-bit", brokenWrongLatchBit, 256, true],
  ["keeps-command", brokenKeepsCommand, 255, false],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM, device state and write order all identical", { skip }, () => {
  const r = gate(sendSoundCommand);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const d = unitDiff(sendSoundCommand, entryState());
  assert.equal(d.device, null, `the device state diverged — ${d.device}`);
  assert.equal(d.writes, null, `the write sequence diverged — ${d.writes}`);
  assert.equal(d.accumulator, null, `the accumulator diverged — ${d.accumulator}`);
  console.log(`  EQUAL: command ${hex4(entryState().regs.a)}; RAM, latches, writes, accumulator`);
});

test("VACUITY, MEASURED: a no-op PASSES on RAM; two other arms catch it", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.equal(
    d.ram,
    null,
    "a do-nothing candidate was caught on RAM, so this routine reaches the state dump after all " +
      "and the whole framing of this file has to be re-derived",
  );
  assert.notEqual(d.writes, null, "the write sequence passed a candidate that does nothing");
  console.log(`  VACUITY: RAM sees nothing; the write order sees ${d.writes}`);
});

test("EXCLUDED, deliberately: the stack pointer and pc, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  sendSoundCommand(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape: the accumulator must agree, because the rewrite reproduces " +
      "the zero the last latch write leaves behind",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, commands } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  assert.equal(commands.size, COMMANDS_SEEN, "the set of command bytes real play presents moved");
  for (const captured of entries) {
    const d = unitDiff(sendSoundCommand, captured);
    assert.equal(d.device, null, `a captured dispatch diverged on the device — ${d.device}`);
    assert.equal(d.writes, null, `a captured dispatch diverged on write order — ${d.writes}`);
    assert.equal(d.ram, null, "a captured dispatch diverged on RAM");
  }
  console.log(`  CORPUS: ${entries.length} dispatches, ${commands.size} distinct commands`);
});

test("EXHAUSTIVE: all 256 command bytes behave as the oracle", { skip }, () => {
  for (const c of COMMANDS) {
    const d = unitDiff(sendSoundCommand, withCommand(c));
    assert.equal(d.device, null, `command ${c}: ${d.device}`);
    assert.equal(d.writes, null, `command ${c}: ${d.writes}`);
  }
  console.log(`  EXHAUSTIVE: ${COMMANDS.length} command bytes identical on device and write order`);
});

test("THE PULSE IS ONLY VISIBLE IN THE WRITE ORDER, measured", { skip }, () => {
  const d = unitDiff(brokenNoPulse, withCommand(0xa5));
  assert.equal(
    d.device,
    null,
    "the after-state told the two apart, so the pulse IS visible in device state and this file " +
      "understates what the state comparison covers",
  );
  assert.equal(d.ram, null, "and RAM cannot see it either");
  assert.notEqual(d.writes, null, "the write sequence must be what separates them");

  const m = withCommand(0xa5);
  sendSoundCommand(m);
  assert.equal(m.io.soundData, 0xa5, "the command byte must be left standing in the sound latch");
  assert.equal(m.io.latch[LATCH_AUDIO_IRQ], 0, "the attention line must end low, ready to re-arm");
  console.log(`  PULSE: after-state identical without it; write order shows ${d.writes}`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(sendSoundCommand);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, sendSoundCommand]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, sweep, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of command bytes`, { skip }, () => {
    assert.equal(sweepCaught(twin), sweep, `the ${label} twin's sweep catch count moved`);
    console.log(`  TEETH/${label}: caught on ${sweep} of ${COMMANDS.length} command bytes`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    assert.equal(
      caught(twin, entryState()),
      seenAtDispatch,
      `the real dispatch's view of the ${label} twin moved`,
    );
    console.log(`  TEETH/${label}: real dispatch ${seenAtDispatch ? "catches it" : "is BLIND"}`);
  });
}

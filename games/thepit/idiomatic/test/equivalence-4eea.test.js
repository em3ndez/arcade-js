// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepHighScoreInitialsEntry (ROM 0x4eea) — the per-frame action dispatch
 * for a two-cell object, keyed on the low five action bits of the debounced input byte.
 *
 * It has three kinds of arm: an IDLE arm (no bit set -> ret), two STEP arms (delegate
 * to loc_4f26 / advanceInitialUp, which request the step sound and walk the object's cyclic
 * index), and a COMMIT arm (blank both cells, redraw one row up, count the move off the
 * step counter, clear the frame counter, request the move sound, then hold 20 frames via
 * waitFrames). The declared live-out is memory + the return (pc/SP); the value registers
 * the oracle leaves behind are dead and excluded, so the diff is RAM (outside the dead
 * stack scratch) + pc + SP.
 *
 * WHY A CRAFTED ENTRY. 0x4eea is never dispatched in a boot/attract run (a probe over
 * 4000 frames sees 0 — its caller's display loop is not reached), so the capture/replay
 * harness cannot hook it directly. Per the crafted-entry method the gate runs it from a
 * REAL captured sound-request state: the sibling stub 0x4c57 (command 2) IS reached during
 * attract, and its entry is a faithful machine — a valid stack with a return address and a
 * live sound ring. Crucially 0x4eea never calls 0x4c57, so cloning that entry introduces no
 * registry recursion. Each arm is then reached by poking the action byte (and, for commit,
 * the object cursors) identically on both sides — a real state with a surgical nudge.
 *
 * TWO WRINKLES:
 *   - The oracle path parks dead bytes on the stack the stack-free idiomatic JS does not
 *     reproduce: on a step arm loc_4f26/advanceInitialUp's own call (2) + the shared enqueue's two
 *     saved pairs (4); on the commit arm the 0x4c8f call (2) + the enqueue's saves (4). Six
 *     dead bytes sit just below the entry stack pointer. The Pit's stack is real diffed work
 *     RAM, so the diff excludes exactly that [SP-6, SP) window and compares everything else.
 *   - The commit arm's waitFrames busy-waits on a countdown the per-frame interrupt drives
 *     to zero in the live game; run in isolation nothing ticks it, so the loop would never
 *     end. The harness models that once-per-frame tick with ONE hook installed IDENTICALLY on
 *     both clones (each watchdog read — one per busy-wait pass — decrements the countdown),
 *     so it can only reveal a difference, never manufacture one.
 *
 * Checks:
 *   0. HARNESS — capture a real 0x4c57 entry and confirm the oracle run of 0x4eea on the
 *      idle arm is deterministic (oracle vs oracle -> identical whole state).
 *   1. EQUAL (idle) — no action bit set: both do nothing and return, identical.
 *   2. EQUAL (step arms) — each of bits 0..3, plus a priority case (bit0+bit1 -> down),
 *      swept over a few index values: stepHighScoreInitialsEntry == oracle over RAM (outside stack) + pc + SP.
 *   3. EQUAL (commit arm) — bit 4 with the object cursors poked: identical over RAM + pc +
 *      SP, and the cells blank / redraw, the counter decrements, the frame counter clears,
 *      and the move sound queues as expected.
 *   4. TEETH (wrong row) — a commit twin that moves the object up TWO rows is CAUGHT at the
 *      redraw cell.
 *   5. TEETH (dropped decrement) — a commit twin that skips the step-counter decrement is
 *      CAUGHT at the counter.
 *   6. TEETH (wrong sound) — a commit twin that queues the wrong move sound is CAUGHT at the
 *      sound ring slot.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4eea.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4eea as oracle } from "../../translated/loc_4eea.js";
import { stepHighScoreInitialsEntry as idiomatic } from "../stepHighScoreInitialsEntry.js";
import { loc_4c57 as siblingStub } from "../../translated/loc_4c57.js";
import { enqueueSoundCommand } from "../enqueueSoundCommand.js";
import { waitFrames } from "../waitFrames.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { IN0_DEBOUNCED, FRAME_COUNTER, SOUND_HEAD, SOUND_RING } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x4c57; // sibling sound stub — a real sound-request entry, reached in attract
const STACK_SCRATCH = 6; // dead bytes below entry SP: a delegate's call (2) + the enqueue's saved pairs (4)
const STEP_COUNTER = 0x804b; // per-move counter the commit arm decrements
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown waitFrames drains to 0
const COMMIT_SOUND = 16 | 0x80; // the pending move-sound byte the commit arm queues
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the sibling sound stub 0x4c57 in a real attract run and clone the machine at its
 * first dispatch — a genuine machine state (valid stack with a return address, a live
 * sound ring). The wrapper snapshots then runs the oracle so attract proceeds.
 */
function captureRealEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return siblingStub(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/**
 * Model the once-per-frame interrupt tick that drives the commit arm's hold to
 * completion: each watchdog read (the wait does exactly one per pass) ticks the
 * countdown down by one, floored at 0. Installed identically on both clones.
 */
function installFrameTick(m) {
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      const c = origRead8(COUNTDOWN);
      if (c !== 0) mem.write8(COUNTDOWN, c - 1);
    }
    return origRead8(addr);
  };
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch bytes
 * the oracle's delegate call + register saves park just below the entry stack pointer
 * (which the stack-free idiomatic JS does not reproduce). Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of a crafted entry and diff
 * the memory-equivalence contract: RAM (outside the stack scratch) + exit pc + SP. The
 * value registers the oracle leaves are the declared-dead live-out and excluded. `tick`
 * installs the frame-tick harness for arms that busy-wait (the commit arm). Returns
 * { diffs, ram }.
 */
function contractDiffs(entry, fn, { tick = false } = {}) {
  const sp = entry.regs.sp;
  const o = entry.clone();
  const c = entry.clone();
  if (tick) { installFrameTick(o); installFrameTick(c); }
  oracle(o);
  fn(c);

  const diffs = [];
  const ram = ramDiffOutsideStack(o, c, sp);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return { diffs, ram };
}

// Crafted-entry builders: a real captured state with a surgical nudge to the arm-selecting
// action byte (and, for commit, to the object cursors — chosen well clear of the stack).
function craftIdle(seed) {
  const e = seed.clone();
  e.mem.write8(IN0_DEBOUNCED, 0x00);
  return e;
}
function craftStep(seed, bits, index) {
  const e = seed.clone();
  e.mem.write8(IN0_DEBOUNCED, bits);
  e.regs.c = index;
  return e;
}
const COMMIT_HL = 0x915f; // top cell cursor (video RAM)
const COMMIT_IX = 0x8140; // bottom cell + object pointer (work RAM, clear of the 0x83fd stack)
const COMMIT_DE = 0x895f; // parallel-plane cursor (colour RAM)
const COMMIT_CODE = 0x24; // object tile code
const COMMIT_BLANK = 0x0a; // blank / index byte
function craftCommit(seed) {
  const e = seed.clone();
  e.mem.write8(IN0_DEBOUNCED, 0x10);
  e.regs.hl = COMMIT_HL;
  e.regs.ix = COMMIT_IX;
  e.regs.de = COMMIT_DE;
  e.regs.b = COMMIT_CODE;
  e.regs.c = COMMIT_BLANK;
  e.mem.write8(STEP_COUNTER, 0x05); // a live counter -> decrements to 4
  e.mem.write8(FRAME_COUNTER, 0xaa); // a nonzero frame counter -> cleared to 0
  return e;
}

// A faithful re-do of the commit arm with a single knob turned wrong, for the teeth.
function brokenCommit(m, { row = 32, decrement = true, soundCmd = 16 } = {}) {
  const { regs, mem } = m;
  const blank = regs.c;
  const code = regs.b;
  mem.write8(regs.hl, blank);
  mem.write8(regs.ix, blank);
  regs.hl = regs.hl - row;
  regs.de = regs.de - row;
  regs.ix = regs.ix + 1;
  regs.c = 10;
  mem.write8(regs.de, code);
  if (decrement) mem.write8(STEP_COUNTER, mem.read8(STEP_COUNTER) - 1);
  mem.write8(FRAME_COUNTER, 0);
  enqueueSoundCommand(m, soundCmd);
  return waitFrames(m, 20);
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x4c57 entry is captured and the oracle idle run of 0x4eea is deterministic", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "expected the sibling sound stub 0x4c57 to be dispatched during attract");

  const entry = craftIdle(seed);
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  assert.equal(a.pc, b.pc, "oracle pc not deterministic");
  console.log(`  HARNESS: captured a real 0x4c57 entry (SP=${hx(seed.regs.sp)}); oracle idle run deterministic`);
});

// -- 1. EQUAL (idle) ---------------------------------------------------------

test("EQUAL (idle): no action bit set -> stepHighScoreInitialsEntry == oracle (do nothing, return)", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const { diffs } = contractDiffs(craftIdle(seed), idiomatic);
  assert.equal(diffs.length, 0, diffs.join("; "));
  console.log("  EQUAL/idle: identical over RAM + pc + SP");
});

// -- 2. EQUAL (step arms) ----------------------------------------------------

test("EQUAL (step arms): bits 0..3 + priority, swept over indices -> stepHighScoreInitialsEntry == oracle", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const head = seed.mem.read8(SOUND_HEAD);

  // bit0/bit2 step down, bit1/bit3 step up; 0x03 pins priority (bit0 wins over bit1).
  const cases = [
    { bits: 0x01, note: "bit0 down" },
    { bits: 0x02, note: "bit1 up" },
    { bits: 0x04, note: "bit2 down" },
    { bits: 0x08, note: "bit3 up" },
    { bits: 0x03, note: "priority: bit0 beats bit1 (down)" },
  ];
  for (const { bits, note } of cases) {
    for (const index of [255, 20, 10, 35]) {
      const { diffs } = contractDiffs(craftStep(seed, bits, index), idiomatic);
      assert.equal(diffs.length, 0, `${note} index=${index}: ${diffs.join("; ")}`);

      // Positive check: the step sound (command 8) really was queued at the ring slot.
      const c = craftStep(seed, bits, index).clone();
      idiomatic(c);
      assert.equal(c.mem.read8(SOUND_RING + head), 8 | 0x80, `${note} index=${index}: step sound not queued`);
    }
  }
  console.log("  EQUAL/step: bits 0..3 + priority x indices all identical to the oracle; step sound queued");
});

// -- 3. EQUAL (commit arm) ---------------------------------------------------

test("EQUAL (commit arm): bit 4 -> stepHighScoreInitialsEntry == oracle over RAM + pc + SP, with the expected effects", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const head = seed.mem.read8(SOUND_HEAD);

  const { diffs } = contractDiffs(craftCommit(seed), idiomatic, { tick: true });
  assert.equal(diffs.length, 0, diffs.join("; "));

  // Positive checks on a fresh commit run: cells blanked, redraw one row up, counter
  // decremented, frame counter cleared, move sound queued.
  const c = craftCommit(seed).clone();
  installFrameTick(c);
  idiomatic(c);
  assert.equal(c.mem.read8(COMMIT_HL), COMMIT_BLANK, "top cell not blanked");
  assert.equal(c.mem.read8(COMMIT_IX), COMMIT_BLANK, "bottom cell not blanked");
  assert.equal(c.mem.read8(COMMIT_DE - 32), COMMIT_CODE, "object not redrawn one row up in the parallel plane");
  assert.equal(c.mem.read8(STEP_COUNTER), 4, "step counter not decremented 5 -> 4");
  assert.equal(c.mem.read8(FRAME_COUNTER), 0, "frame counter not cleared");
  assert.equal(c.mem.read8(SOUND_RING + head), COMMIT_SOUND, "move sound (16) not queued at the ring slot");
  console.log("  EQUAL/commit: identical over RAM + pc + SP; cells blank, redraw up one row, counter 5->4, sound 16 queued");
});

// A guard: the faithful re-do (no knob turned) must itself equal the oracle — so a
// teeth failure below is the knob, not a broken twin harness.
test("EQUAL (commit twin harness): the un-broken re-do equals the oracle", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const { diffs } = contractDiffs(craftCommit(seed), (m) => brokenCommit(m), { tick: true });
  assert.equal(diffs.length, 0, `the faithful commit re-do must match the oracle: ${diffs.join("; ")}`);
  console.log("  EQUAL/twin-harness: the un-broken commit re-do matches the oracle (teeth isolate the knob)");
});

// -- 4. TEETH (wrong row) ----------------------------------------------------

test("TEETH (wrong row): a commit twin that moves up TWO rows is CAUGHT at the redraw cell", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const { diffs, ram } = contractDiffs(craftCommit(seed), (m) => brokenCommit(m, { row: 64 }), { tick: true });
  assert.ok(diffs.length > 0, "the gate FAILED to catch the wrong-row twin — it proves nothing");
  assert.ok(
    ram && [COMMIT_DE - 32, COMMIT_DE - 64].includes(ram.addr),
    `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected the redraw cell ${hx(COMMIT_DE - 32)} or ${hx(COMMIT_DE - 64)})`,
  );
  console.log(`  TEETH/row: wrong-row twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 5. TEETH (dropped decrement) --------------------------------------------

test("TEETH (dropped decrement): a commit twin that skips the counter decrement is CAUGHT at 0x804b", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const { diffs, ram } = contractDiffs(craftCommit(seed), (m) => brokenCommit(m, { decrement: false }), { tick: true });
  assert.ok(diffs.length > 0, "the gate FAILED to catch the dropped-decrement twin — it proves nothing");
  assert.equal(ram && ram.addr, STEP_COUNTER, `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected ${hx(STEP_COUNTER)})`);
  assert.equal(ram.a, 4, "oracle decremented the counter to 4");
  assert.equal(ram.b, 5, "the broken twin left it at 5");
  console.log(`  TEETH/decrement: dropped-decrement twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 6. TEETH (wrong sound) --------------------------------------------------

test("TEETH (wrong sound): a commit twin that queues the wrong move sound is CAUGHT at the ring slot", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const head = seed.mem.read8(SOUND_HEAD);
  const { diffs, ram } = contractDiffs(craftCommit(seed), (m) => brokenCommit(m, { soundCmd: 15 }), { tick: true });
  assert.ok(diffs.length > 0, "the gate FAILED to catch the wrong-sound twin — it proves nothing");
  assert.equal(ram && ram.addr, SOUND_RING + head, `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected ${hx(SOUND_RING + head)})`);
  console.log(`  TEETH/sound: wrong-sound twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

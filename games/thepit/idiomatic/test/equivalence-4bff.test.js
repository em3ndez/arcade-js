// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for waitFrames (ROM 0x4bff, The Pit) — the frame-delay
 * routine: arm the per-frame countdown cell (0x8009) with the caller's frame count,
 * enable the per-frame interrupt, then busy-wait (kicking the watchdog each pass)
 * until the countdown reaches zero.
 *
 * THE WRINKLE this routine forces: the loop terminates only when 0x8009 reaches 0,
 * and NOTHING in the routine drives it there — in the live game the per-frame
 * interrupt decrements 0x8009 once a frame. Run in isolation on a clone (whose
 * frame machinery is neutralised, so no interrupt fires) the loop would never
 * terminate for a non-zero count. So the harness models that once-per-frame tick
 * with ONE hook installed IDENTICALLY on both clones: reading the watchdog (which
 * the loop does exactly once per pass) decrements the countdown by one. Being the
 * same hook on both sides, it can only ever reveal a difference between oracle and
 * idiomatic, never manufacture one — the same discipline the setZonkerFrame tail-stub uses.
 *
 * The one memory-observable output is the countdown left at 0 plus the return to
 * the caller (pc/SP). The frame-COUNT the routine burns is a timing effect that
 * memory-equivalence deliberately drops (and the whole-game pixel gate validates);
 * whatever count is armed, the loop exits at 0, so the final countdown byte is 0.
 *
 * CHECKS:
 *   1. EQUAL (count 0, no hook) — a zero count terminates naturally, so it is proven
 *      with no harness at all: one pass, countdown 0, clean return.
 *   2. EQUAL (hook, count sweep) — {0,1,2,60,255} on clones of the REAL boot dispatch
 *      state; idiomatic == oracle on RAM + pc + SP for every count.
 *   3. TEETH — a twin that stops the wait one short (countdown left non-zero) is
 *      caught at 0x8009; a twin that forgets to return to the caller is caught at pc/SP.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4bff.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4bff as oracle } from "../../translated/loc_4bff.js";
import { waitFrames as idiomatic } from "../waitFrames.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4bff; // loc_4bff / waitFrames
const COUNTDOWN = 0x8009; // the per-frame countdown cell the wait drains to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const CAPTURE_FRAMES = 120; // the first dispatch is at boot; the 0x3c-frame wait spans ~60
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the machine state at the FIRST real 0x4bff dispatch (boot arms a 0x3c-frame
 * delay). The hook clones the pristine entry, then runs the real oracle so boot
 * proceeds — in the live host the interrupt fires, so the wait terminates normally.
 */
function captureBootEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureBootEntry() : null;

/**
 * Model the once-per-frame interrupt tick that drives the wait to completion: each
 * watchdog read (the loop does exactly one per pass) ticks the countdown down by one,
 * floored at 0 so the loop is guaranteed to terminate. Installed identically on both
 * clones, so it can only expose a difference, never create one.
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
 * Run the oracle and a candidate on two independent clones of the real boot entry,
 * with the caller's frame count poked to `count`, and diff the memory-equivalence
 * contract: RAM + exit pc + SP. (A and the flags the loop leaves are dead live-out,
 * so they are intentionally not compared.) `tick` installs the frame-tick harness.
 */
function runPair(candidate, count, { tick }) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  a.regs.a = count; // the oracle is the frozen Z80 routine — it reads the count off the register
  if (tick) {
    installFrameTick(a);
    installFrameTick(b);
  }

  oracle(a);
  candidate(b, count); // the idiomatic routine (and its twins) take the count as a parameter

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pcDiff: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    spDiff: a.regs.sp === b.regs.sp ? null : { a: a.regs.sp, b: b.regs.sp },
    countdownLanded: a.mem.read8(COUNTDOWN),
  };
}

// -- 1. EQUAL: a zero count terminates with no harness ------------------------

test("EQUAL (count 0, no hook): zero count falls through — idiomatic == oracle", () => {
  assert.ok(ENTRY, "captured the real boot 0x4bff dispatch");
  assert.equal(ENTRY.regs.a, 0x3c, "the real boot dispatch arms a 0x3c-frame wait");

  const r = runPair(idiomatic, 0, { tick: false });
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pcDiff, null, r.pcDiff && `pc diverged (oracle=${hx(r.pcDiff.a)} idiomatic=${hx(r.pcDiff.b)})`);
  assert.equal(r.spDiff, null, r.spDiff && `SP diverged (oracle=${hx(r.spDiff.a)} idiomatic=${hx(r.spDiff.b)})`);
  assert.equal(r.countdownLanded, 0, "a zero count leaves the countdown at 0");
  console.log("  EQUAL/count-0: zero-count fall-through identical (RAM + pc + SP)");
});

// -- 2. EQUAL: frame-count sweep, frame-tick harness on both sides ------------

test("EQUAL (hook): idiomatic == oracle over the frame-count sweep {0,1,2,60,255}", () => {
  assert.ok(ENTRY, "captured the real boot 0x4bff dispatch");
  for (const count of [0, 1, 2, 60, 255]) {
    const r = runPair(idiomatic, count, { tick: true });
    assert.equal(r.ram, null, r.ram && `count=${count}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
    assert.equal(r.pcDiff, null, r.pcDiff && `count=${count}: pc diverged (oracle=${hx(r.pcDiff.a)} idiomatic=${hx(r.pcDiff.b)})`);
    assert.equal(r.spDiff, null, r.spDiff && `count=${count}: SP diverged (oracle=${hx(r.spDiff.a)} idiomatic=${hx(r.spDiff.b)})`);
    assert.equal(r.countdownLanded, 0, `count=${count}: the wait must drain the countdown to 0`);
  }
  console.log("  EQUAL/hook: all counts {0,1,2,60,255} identical to the oracle (RAM + pc + SP)");
});

// -- 3. TEETH: broken twins the gate MUST catch ------------------------------

/** Broken twin A: stops the wait one pass short, leaving the countdown non-zero. */
function brokenStopsShort(m, count) {
  const { mem } = m;
  mem.write8(COUNTDOWN, count);
  mem.write8(0xb000, 1);
  let remaining;
  do {
    mem.read8(WATCHDOG);
    remaining = mem.read8(COUNTDOWN);
  } while (remaining > 1); // BUG: exits at 1, not 0 — the countdown is left non-zero
  return m.ret();
}

/** Broken twin B: does the wait correctly but forgets to return to the caller. */
function brokenNoReturn(m, count) {
  const { mem } = m;
  mem.write8(COUNTDOWN, count);
  mem.write8(0xb000, 1);
  let remaining;
  do {
    mem.read8(WATCHDOG);
    remaining = mem.read8(COUNTDOWN);
  } while (remaining !== 0);
  // BUG: never pops the return address — pc and SP are left where they entered.
}

test("TEETH: a wait that stops one short (countdown left non-zero) is CAUGHT at 0x8009", () => {
  const r = runPair(brokenStopsShort, 60, { tick: true });
  assert.notEqual(r.ram, null, "the gate FAILED to catch a non-zero countdown at exit — it is worthless");
  assert.equal(r.ram.addr, COUNTDOWN, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(COUNTDOWN)})`);
  assert.equal(r.ram.a, 0, "oracle drained the countdown to 0");
  assert.notEqual(r.ram.b, 0, "the broken twin left it non-zero");
  console.log(`  TEETH: short wait caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: forgetting to return to the caller is CAUGHT at pc/SP", () => {
  const r = runPair(brokenNoReturn, 60, { tick: true });
  assert.equal(r.ram, null, "the twin's memory effect is correct — only the return is wrong");
  assert.notEqual(r.pcDiff, null, "the missing return must surface as a pc difference");
  assert.notEqual(r.spDiff, null, "and the stack pointer must not have popped the return address");
  console.log(`  TEETH: dropped return caught at pc (oracle=${hx(r.pcDiff.a)} broken=${hx(r.pcDiff.b)}) + SP`);
});

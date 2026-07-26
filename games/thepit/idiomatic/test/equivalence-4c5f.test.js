// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for requestSound4 (ROM 0x4c5f) — the sound-trigger stub
 * that names command 4 and hands it to the shared enqueue body (loc_4ca5).
 *
 * requestSound4 takes no register input from its caller (it hardcodes command 4) and
 * its only live output is memory: the filled sound-ring slot and the advanced write
 * pointer, both written by the shared enqueue body. It reaches that body through the
 * one genuine oracle boundary here — the body is still the frozen oracle — so the
 * idiomatic stub runs the very same callee the oracle stub does, which makes the two
 * agree EXACTLY across both RAM and registers, not merely memory-only.
 *
 * A wrinkle that shapes the whole gate: command 4 is NEVER requested during attract,
 * so 0x4c5f is never dispatched in a boot run — unitEquivalence (which hooks the
 * target and requires it to fire) cannot capture it. That is the doc-sanctioned
 * "unreached arm" case: capture a REAL machine state at a proxy leaf that IS reached
 * (0x3dae, the tilemap calc, entered early in attract and never called by 0x4c5f, so
 * its capture hook cannot re-enter this routine), then run the stub on that real
 * state. The ring write position (SOUND_HEAD) is swept across all eight slots on both
 * sides — a surgical, identical-both-sides nudge — so every ring slot is exercised.
 *
 * Four checks:
 *   1. EQUAL (real states, memory + registers) — over several captured entries and
 *      every ring slot, oracle stub and idiomatic stub leave identical RAM AND an
 *      identical register file. The exact register match is the payoff of keeping the
 *      shared enqueue body as an oracle-boundary call.
 *   2. POSITIVE (the enqueue really happened) — with SOUND_HEAD pinned to a known
 *      slot, the idiomatic stub writes command 4 (marked pending, 0x84) into exactly
 *      that ring slot and advances the pointer, wrapping after the eighth slot. Proves
 *      the gate is testing a real effect, not a shared no-op.
 *   3. TEETH — a twin that names the WRONG command (5 instead of 4) is CAUGHT at the
 *      ring slot it fills (0x85 vs the oracle's 0x84). An always-EQUAL gate is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c5f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c5f as oracle } from "../../translated/loc_4c5f.js";
import { loc_3dae as proxyOracle } from "../../translated/loc_3dae.js";
import { requestSound4 as idiomatic } from "../requestSound4.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const PROXY = 0x3dae; // a leaf reached early in attract; never called by 0x4c5f
const SOUND_HEAD = 0x801e; // ring write pointer (0..7)
const SOUND_RING = 0x8020; // 8-slot ring buffer base
const CMD = 4; // the command id this stub requests
const PENDING = CMD | 0x80; // 0x84 — the byte the shared body stores (high bit = pending)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture up to K real entry states at the PROXY leaf during a boot/attract run. The
 * wrapper clones on entry, then runs the proxy's own oracle so the host game proceeds
 * normally. Capturing at the proxy (not at 0x4c5f, which never fires) gives real,
 * in-distribution machine states to run the stub on.
 */
function captureEntries(K, maxFrames) {
  const caps = [];
  const snap = new Map([[PROXY, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return proxyOracle(mm);
  }]]);
  const host = makeMachine(snap);
  host.runFrames(maxFrames);
  return caps;
}

/** Diff two machines' whole state dumps; null when identical. */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 1. EQUAL on real captured states, ring slot swept (memory + registers) ---

test("EQUAL (real states, all ring slots): idiomatic matches the oracle in RAM and registers", () => {
  const caps = captureEntries(6, 400);
  assert.ok(caps.length >= 1, "expected at least one real proxy dispatch during boot/attract");
  let compared = 0;
  for (const cap of caps) {
    for (let head = 0; head < 8; head++) {
      // Surgical, identical-both-sides nudge: pin the ring write position.
      const seed = cap.clone();
      seed.mem.write8(SOUND_HEAD, head);

      const a = seed.clone();
      const b = seed.clone();
      oracle(a);
      idiomatic(b);

      const rd = ramDiff(a, b);
      assert.equal(rd, null, rd && `RAM diff at ${hx(rd.addr ?? 0)} (oracle=${rd.a} idiomatic=${rd.b}) head=${head}`);
      const gd = firstRegDiff(a.regs, b.regs);
      assert.equal(gd, null, gd && `register diff ${gd?.reg} (oracle=${gd?.a} idiomatic=${gd?.b}) head=${head}`);
      compared++;
    }
  }
  console.log(`  EQUAL: ${caps.length} states x 8 ring slots = ${compared} entries, RAM + registers identical`);
});

// -- 2. POSITIVE: the enqueue really lands command 4 in the pinned slot --------

test("POSITIVE: command 4 is stored (pending) in the pinned ring slot and the pointer advances/wraps", () => {
  const caps = captureEntries(1, 400);
  assert.ok(caps.length >= 1, "need a captured entry to craft from");
  for (const head of [0, 3, 7]) {
    const seed = caps[0].clone();
    seed.mem.write8(SOUND_HEAD, head);

    const b = seed.clone();
    idiomatic(b);

    assert.equal(
      b.mem.read8(SOUND_RING + head),
      PENDING,
      `ring slot ${head} should hold ${hx(PENDING)} after the request`,
    );
    assert.equal(
      b.mem.read8(SOUND_HEAD),
      (head + 1) % 8,
      `write pointer should advance to ${(head + 1) % 8} (wrapping after the eighth slot)`,
    );
  }
  console.log(`  POSITIVE: command 4 -> ${hx(PENDING)} landed in slots 0/3/7, pointer advanced with wrap`);
});

// -- 3. TEETH: a twin that names the WRONG command is caught ------------------

/** Broken twin: requests command 5 instead of 4 — the ring byte comes out 0x85. */
function brokenRequestSound4(m) {
  m.regs.a = 5;
  return m.call(0x4ca5);
}

test("TEETH: a wrong-command twin (5 instead of 4) is CAUGHT at the ring slot it fills", () => {
  const caps = captureEntries(1, 400);
  const head = 2;
  const seed = caps[0].clone();
  seed.mem.write8(SOUND_HEAD, head);

  const a = seed.clone();
  const b = seed.clone();
  oracle(a);
  brokenRequestSound4(b);

  const rd = ramDiff(a, b);
  assert.notEqual(rd, null, "the gate FAILED to catch the wrong-command twin — it proves nothing");
  assert.equal(
    rd.addr,
    SOUND_RING + head,
    `teeth caught the wrong address ${hx(rd.addr ?? 0)} (expected ${hx(SOUND_RING + head)})`,
  );
  console.log(`  TEETH: wrong command caught at ${hx(rd.addr)} (oracle=${hx(rd.a)} broken=${hx(rd.b)})`);
});

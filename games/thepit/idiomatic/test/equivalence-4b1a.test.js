// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for advanceRandom (ROM 0x4b1a) — the pseudo-random generator
 * step that shifts the 16-bit state at 0x800d(low)/0x800e(high) and returns a
 * fresh byte in the accumulator.
 *
 * The routine's whole output — the two new state bytes AND the returned byte — is
 * a function of ONLY the two state bytes it reads; it touches no other memory and
 * takes no register input. So it is validated as a near-pure leaf: an EXHAUSTIVE
 * sweep over its entire input domain, plus real captured states for a full-RAM
 * check that nothing else moves.
 *
 * The declared live-out is memory + the accumulator only. The oracle's residual
 * working registers and flags are dead ABI (every caller masks the returned byte,
 * overwriting the flags), so this gate compares RAM + the accumulator, NOT the
 * full register file — comparing the dead working registers would false-fail a
 * correct idiomatic rewrite (exactly the case the pipeline warns about).
 *
 * THREE checks:
 *   1. EQUAL (real captured attract states) — clone the running attract machine at
 *      a spread of frames, run the oracle and advanceRandom on independent clones
 *      of each, and diff work RAM + the returned byte. Catches any stray write.
 *   2. EXHAUSTIVE — over all 65,536 (low,high) states, seed both bytes identically
 *      on both sides, run oracle vs advanceRandom, and confirm the two new state
 *      bytes and the returned byte match. Covers the reseed branch (0,0) too.
 *   3. TEETH — a twin that corrupts the returned low byte MUST be caught.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal
 * cycle steps cannot trip a live NMI whose handler would write RAM and masquerade
 * as a side effect. advanceRandom writes memory directly and steps nothing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4b1a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4b1a as oracle } from "../../translated/loc_4b1a.js";
import { advanceRandom } from "../advanceRandom.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const RNG_LOW = 0x800d;
const RNG_HIGH = 0x800e;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames.
 * Each clone is a genuine in-play machine with its frame machinery neutralised
 * (safe to run the oracle on).
 */
function captureStates(count, stride, startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  const caps = [];
  for (let i = 0; i < count; i++) {
    m.runFrames(stride);
    caps.push(m.clone());
  }
  return caps;
}

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: advanceRandom leaves the same work RAM + returned byte as the oracle over real states", () => {
  const caps = captureStates(8, 120, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    oracle(a);
    advanceRandom(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
    assert.equal(
      b.regs.a,
      a.regs.a,
      `returned byte differs: oracle=${a.regs.a} idiomatic=${b.regs.a}`,
    );
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states — work RAM + returned byte identical`);
});

// -- 2. EXHAUSTIVE over the entire 16-bit generator state ---------------------

test("EXHAUSTIVE: over all 65,536 (low,high) states the new state bytes + returned byte match the oracle", () => {
  const [entry] = captureStates(1, 1, 200);
  const oracleM = entry.clone();
  const idioM = entry.clone();
  let checked = 0;
  let sawReseed = false;

  for (let high = 0; high < 256; high++) {
    for (let low = 0; low < 256; low++) {
      // Seed the generator state identically on both sides.
      oracleM.mem.write8(RNG_LOW, low);
      oracleM.mem.write8(RNG_HIGH, high);
      idioM.mem.write8(RNG_LOW, low);
      idioM.mem.write8(RNG_HIGH, high);
      // A fixed, harmless stack anchor so the oracle's ret only ever reads a known
      // work-RAM cell rather than wandering as it is re-run in place.
      oracleM.regs.sp = 0x8780;

      oracle(oracleM);
      advanceRandom(idioM);

      const oLow = oracleM.mem.read8(RNG_LOW);
      const oHigh = oracleM.mem.read8(RNG_HIGH);
      if (idioM.mem.read8(RNG_LOW) !== oLow || idioM.mem.read8(RNG_HIGH) !== oHigh) {
        assert.fail(
          `state ${hx((high << 8) | low)}: new bytes differ — oracle=(${oLow},${oHigh}) ` +
            `idiomatic=(${idioM.mem.read8(RNG_LOW)},${idioM.mem.read8(RNG_HIGH)})`,
        );
      }
      if (idioM.regs.a !== oracleM.regs.a) {
        assert.fail(
          `state ${hx((high << 8) | low)}: returned byte differs — ` +
            `oracle=${oracleM.regs.a} idiomatic=${idioM.regs.a}`,
        );
      }
      if (low === 0 && high === 0) sawReseed = true;
      checked++;
    }
  }

  assert.equal(checked, 65536, "must have swept the full 16-bit state domain");
  assert.ok(sawReseed, "the all-zero reseed branch must have been exercised");
  console.log(`  EXHAUSTIVE: all ${checked} generator states agree (state bytes + returned byte)`);
});

// -- 3. TEETH: a wrong-value twin MUST be caught ------------------------------

/** Broken twin: advances correctly but flips one bit of the returned low byte. */
function brokenAdvanceRandom(m) {
  advanceRandom(m);
  m.mem.write8(RNG_LOW, m.mem.read8(RNG_LOW) ^ 1); // BUG: corrupts the new low byte
}

test("TEETH: a twin that corrupts the new low byte is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    // Force a non-zero state so the flipped bit definitely changes a byte.
    cap.mem.write8(RNG_LOW, 0x6b);
    cap.mem.write8(RNG_HIGH, 0xa4);
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenAdvanceRandom(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a corrupted-output twin — it proves nothing");
  assert.equal(caught.addr, RNG_LOW, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});

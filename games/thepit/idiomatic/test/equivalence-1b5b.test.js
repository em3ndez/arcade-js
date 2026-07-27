// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for stageObjectSpriteRecord (ROM 0x1b5b) — the tile-under-object classifier's
 * solid-tile deferral step: it builds a 4-byte record at 0x8220 from the object's
 * probe block (0x8068-0x806b), with the leading byte biased down and the trailing
 * byte biased up by the value at 0x8051.
 *
 * Like seedActorSpawnState (0x36fe) and unlike the pure-leaf exemplar (0x2333), this
 * routine WRITES MEMORY and its declared LIVE-OUT is memory-only (the four record
 * bytes). So the gate is memory-equivalence — the whole state dump (work + colour +
 * video + attr) via firstStateDiff — NOT the full register file: the oracle's residual
 * register values are dead ABI, and comparing them (as unitEquivalence does) would
 * false-fail an honest memory-only rewrite. This is the same contract seedActorSpawnState
 * uses. The oracle rets (a stack read, no RAM write) and steps only pc/cycles, so neither
 * arm perturbs the compared state beyond the four record bytes.
 *
 * It reads five input bytes (0x8051, 0x8068, 0x8069, 0x806a, 0x806b) and its output is a
 * pure function of them, so any realistic machine state is a valid entry (the CRAFTED-ENTRY
 * path — attract need not naturally dispatch 0x1b5b for this to be airtight).
 *
 * FOUR checks:
 *   1. EQUAL (real captured attract states) — clone the running attract machine at a
 *      spread of frames (real RAM), run oracle vs idiomatic on independent clones, and
 *      diff the whole state dump. Must be identical.
 *   2. EQUAL (crafted arithmetic sweep) — poke the five input bytes across a broad range
 *      INCLUDING the wrap edges (leading byte where column < bias underflows; trailing
 *      byte where row + bias overflows), identically on both arms, and confirm the
 *      biased ends wrap the same on both. This is the strong correctness evidence.
 *   3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set the four record bytes to a
 *      sentinel on both sides so a no-op or partial twin cannot pass by the entry already
 *      holding the built values: every record byte must be overwritten and both arms agree.
 *   4. TEETH — a twin that DROPS the bias on the leading byte (writes the raw column)
 *      MUST be caught; forced non-vacuous with a nonzero bias.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1b5b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1b5b as oracle } from "../../translated/loc_1b5b.js";
import { stageObjectSpriteRecord as idiomatic } from "../stageObjectSpriteRecord.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ_X, SPRITE_CODE, OBJ_Y } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x1b5b;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const BIAS = 0x8051;
const PROBE_MID = 0x806a;
const RECORD = 0x8220;
const RECORD_ADDRS = [RECORD, RECORD + 1, RECORD + 2, RECORD + 3];
const INPUT_ADDRS = [BIAS, OBJ_X, SPRITE_CODE, PROBE_MID, OBJ_Y];

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (real RAM), independent of the source run, with its
 * frame machinery neutralised (safe to run the oracle's steps/ret on).
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

/** Run oracle and idiomatic on independent clones; return the first differing state byte (or null). */
function stateDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Poke the five input bytes identically, returning a fresh entry clone. */
function withInputs(base, { bias, x, code, mid, y }) {
  const e = base.clone();
  e.mem.write8(BIAS, bias);
  e.mem.write8(OBJ_X, x);
  e.mem.write8(SPRITE_CODE, code);
  e.mem.write8(PROBE_MID, mid);
  e.mem.write8(OBJ_Y, y);
  return e;
}

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: stageObjectSpriteRecord leaves the same state as the oracle over real captured attract states", () => {
  const caps = captureStates(10, 90, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const d = stateDiff(cap, idiomatic);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states — state identical to the oracle`);
});

// -- 2. EQUAL over a crafted arithmetic sweep (incl. wrap edges) --------------

test("EQUAL (crafted): the biased ends match the oracle across the input range, including wraps", () => {
  const [base] = captureStates(1, 1, 200);

  const values = [0, 1, 2, 5, 15, 16, 63, 64, 127, 128, 200, 254, 255];
  let n = 0;
  for (const bias of values) {
    for (const x of values) {
      for (const y of values) {
        // code/mid fixed here (pure copy-through); their variation is covered by test 3's
        // sentinel and by the real-state sweep. This grid stresses both biased ends' wrap.
        const e = withInputs(base, { bias, x, code: 0x7c, mid: 0x33, y });
        const d = stateDiff(e, idiomatic);
        assert.equal(
          d,
          null,
          d && `bias=${bias} x=${x} y=${y}: diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`,
        );
        n++;
      }
    }
  }

  // And a targeted check that the copy-through bytes track their sources too.
  for (const code of values) {
    for (const mid of values) {
      const e = withInputs(base, { bias: 7, x: 100, code, mid, y: 100 });
      const d = stateDiff(e, idiomatic);
      assert.equal(d, null, d && `code=${code} mid=${mid}: diff at ${hx(d.addr ?? 0)}`);
      n++;
    }
  }
  console.log(`  EQUAL/crafted: ${n} input combinations identical to the oracle (both ends wrap correctly)`);
});

// -- 3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) -------------------------

test("NON-VACUOUS: with every record byte pre-set to a sentinel, both arms overwrite all four and agree", () => {
  // Pick inputs whose built record bytes are all != the sentinel, so "overwritten" is observable.
  const [seed] = captureStates(1, 1, 220);
  const entry = withInputs(seed, { bias: 3, x: 40, code: 0x10, mid: 0x20, y: 40 });
  const SENTINEL = 0x55;
  for (const addr of RECORD_ADDRS) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  for (const addr of RECORD_ADDRS) {
    assert.notEqual(b.mem.read8(addr), SENTINEL, `idiomatic left ${hx(addr)} unwritten (still the sentinel)`);
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: all ${RECORD_ADDRS.length} record bytes overwritten from the sentinel, arms agree`);
});

// -- 4. TEETH: a bias-dropping twin MUST be caught ----------------------------

/** Broken twin: builds the record but forgets the bias on the leading byte. */
function brokenLoc1b5b(m) {
  idiomatic(m);
  m.mem.write8(RECORD, m.mem.read8(OBJ_X)); // BUG: leading byte should be column - bias
}

test("TEETH: a twin that drops the bias on the leading byte is CAUGHT", () => {
  const [seed] = captureStates(1, 1, 250);
  // Nonzero bias so column - bias != column, guaranteeing the twin diverges.
  const entry = withInputs(seed, { bias: 9, x: 120, code: 0x22, mid: 0x44, y: 120 });

  const d = stateDiff(entry, brokenLoc1b5b);
  assert.notEqual(d, null, "the gate FAILED to catch a bias-dropping twin — it proves nothing");
  assert.equal(d.addr, RECORD, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(RECORD)})`);

  // and the correct routine is still EQUAL on the very same entry
  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH: bias-dropping twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

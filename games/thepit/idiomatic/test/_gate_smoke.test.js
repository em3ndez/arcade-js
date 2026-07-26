// SPDX-License-Identifier: GPL-3.0-only
/**
 * SMOKE TEST for The Pit's memory-equivalence gate.
 *
 * Not a routine test — its job is to prove the game-agnostic equivalence engine
 * (core/equivalence.js) runs END TO END on The Pit's machine, now that machine.js
 * has clone() + an override layer (modelled on DK). It exercises `unitEquivalence`,
 * which needs both: a construction-time override to snapshot the entry state, and
 * clone() to run translated-vs-candidate on two independent copies of it.
 *
 * The routine under test is loc_3dae (ROM 0x3dae) — the (row,col)→tilemap-offset
 * calc: it reads row 0x8059 / col 0x8058 and stores 32*row+col at 0x805a. A real
 * leaf, dispatched during attract (first entered ~frame 81 in a plain boot run).
 *
 * TWO checks, the gate's two directions:
 *   1. IDENTITY  — run the gate with the "idiomatic" arm = the ORACLE ITSELF.
 *      Running the same routine on both clones MUST report EQUAL. Proves the gate
 *      wiring (construct-with-override → host run → capture → clone → diff) works on
 *      The Pit at all.
 *   2. TEETH     — run the gate with a deliberately-broken twin (the oracle, then
 *      one WRONG store to the output byte 0x805a). The gate MUST report a RAM diff
 *      at 0x805a. Proves the gate can actually FAIL — an always-EQUAL gate is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/_gate_smoke.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3dae as oracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3dae;
const OUT = 0x805a; // where loc_3dae stores the 16-bit tilemap offset
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- 1. IDENTITY: idiomatic arm = the oracle -> MUST be EQUAL -----------------

test("IDENTITY: gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} ` +
      `regs=${JSON.stringify(res.regs)} pc=${JSON.stringify(res.pc)}`,
  );
  assert.equal(res.ram, null, "identity RAM must be identical");
  assert.equal(res.regs, null, "identity registers must be identical");
  assert.equal(res.pc, null, "identity pc must be identical");
  console.log("  IDENTITY: gate captured 0x3dae, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 2. TEETH: a broken twin -> MUST be caught -------------------------------

/** Broken twin: the real routine, then one WRONG store to the output byte 0x805a. */
function brokenLoc3dae(m) {
  oracle(m);
  m.mem.write8(OUT, m.mem.read8(OUT) ^ 0xff); // BUG: corrupts the computed offset
}

test("TEETH: a wrong store to 0x805a is CAUGHT (the gate can fail)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, brokenLoc3dae);
  assert.equal(res.equal, false, "the gate FAILED to catch a wrong output store — it is worthless");
  assert.notEqual(res.ram, null, "the diff must be a RAM difference");
  assert.equal(
    res.ram.addr,
    OUT,
    `teeth caught the wrong address ${hx(res.ram.addr ?? 0)} (expected ${hx(OUT)})`,
  );
  console.log(
    `  TEETH: wrong 0x805a store caught at ${hx(res.ram.addr)} ` +
      `(oracle=${res.ram.a} broken=${res.ram.b})`,
  );
});

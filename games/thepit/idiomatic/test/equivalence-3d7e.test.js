// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3d7e (ROM 0x3d7e) — advance BOARD_MODE keeping bit 3
 * clear, then tail-call the still-oracle column fill (loc_3e01).
 *
 * WHY CRAFTED ENTRIES (not the stock unitEquivalence capture). loc_3d7e is
 * dispatched ONLY from the fixed-screen display loop loc_3ba8, which a plain
 * boot/attract run never enters — 0 dispatches in 5000 frames. So there is no
 * real dispatch of loc_3d7e to snapshot, and unitEquivalence (which requires the
 * target to be entered) cannot reach it. Instead this gate follows the
 * crafted-entry method: capture a real attract machine state (realistic full RAM
 * + the oracle routine registry + a live stack) by hooking a routine attract DOES
 * reach, then surgically poke BOARD_MODE — the one byte loc_3d7e's behaviour turns
 * on — and run oracle vs idiomatic on identical clones. Because BOARD_MODE spans
 * only 0..255, the EQUAL check is an EXHAUSTIVE sweep of the whole input domain.
 *
 * Both arms tail-call the SAME still-oracle column fill loc_3e01, so the only
 * thing that can diverge is loc_3d7e's own BOARD_MODE advance — exactly what this
 * isolates. The fill's base pointer + row count are poked to sane work-RAM values
 * so the fill is bounded and observable, and a wrong advance shows up both in the
 * stored BOARD_MODE byte and in the painted column.
 *
 * THE CONTRACT is memory-equivalence: RAM + pc + SP. The routine's live-out is
 * MEMORY-ONLY. Its residual flags (the S/Z/PV bits the column fill preserves) are
 * dead ABI — the caller loc_3ba8 reloads A immediately after the call and never
 * reads the flags — so they are deliberately NOT compared; the whole-machine /
 * pixel gate backstops that. (Every other register the column fill leaves is
 * identical on both sides because both run that same oracle.)
 *
 * TWO checks, the gate's two directions:
 *   1. EQUAL (exhaustive) — over every BOARD_MODE value 0..255 the idiomatic
 *      routine leaves RAM + pc + SP byte-identical to the oracle.
 *   2. TEETH — a twin that drops the bit-3 mask (a plain increment) is CAUGHT on
 *      every value where bit 3 matters (where the incremented byte would carry
 *      the 8s bit). On values where the mask is a no-op the twin coincides with
 *      the oracle — correctly not flagged; that is the mask being irrelevant
 *      there, not a hole in the gate.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3d7e.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3d7e as oracle } from "../../translated/loc_3d7e.js";
import { loc_3d7e as idiomatic } from "../loc_3d7e.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { BOARD_MODE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// Column-fill inputs (read by the still-oracle loc_3e01): the base pointer word
// and the row count. Poked to sane work-RAM values so the fill is bounded and its
// bytes land in dumped RAM.
const FILL_PTR = 0x805e; // 16-bit column base pointer word
const FILL_COUNT = 0x8055; // number of rows to paint
const FILL_BASE = 0x8600; // a safe work-RAM column base (0x8600, 0x8620, …)
const FILL_ROWS = 8;

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state to seed crafted entries. loc_3d7e itself
 * is never dispatched in attract, so hook a routine that IS (loc_3dae, entered
 * within the first ~100 frames) and clone the machine the first time it fires —
 * that gives realistic full RAM, the oracle registry, and a live stack.
 */
function captureSeed() {
  let seed = null;
  const snapshot = new Map([[0x3dae, (mm) => {
    if (seed === null) seed = mm.clone();
    return reachableOracle(mm);
  }]]);
  makeMachine(snapshot).runFrames(240);
  assert.ok(seed !== null, "expected loc_3dae to be dispatched during attract to seed crafted entries");
  return seed;
}

/** A crafted entry: real captured RAM, BOARD_MODE set to `v`, sane fill inputs. */
function craft(seed, v) {
  const e = seed.clone();
  e.mem.write8(BOARD_MODE, v);
  e.mem.write16(FILL_PTR, FILL_BASE);
  e.mem.write8(FILL_COUNT, FILL_ROWS);
  return e;
}

/**
 * Run oracle and candidate on two independent clones of one entry and diff the
 * memory-equivalence contract: RAM + pc + SP. Registers/flags are the routine's
 * dead-ABI residual and are not compared. Returns a list of mismatch strings
 * (empty when equivalent).
 */
function contractDiffs(entry, fn) {
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  fn(b);

  const diffs = [];
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (ram) diffs.push(`RAM@0x${(ram.addr ?? 0).toString(16)} oracle=${hx(ram.a)} cand=${hx(ram.b)}`);
  if (a.pc !== b.pc) diffs.push(`pc oracle=0x${a.pc.toString(16)} cand=0x${b.pc.toString(16)}`);
  if (a.regs.sp !== b.regs.sp) diffs.push(`SP oracle=0x${a.regs.sp.toString(16)} cand=0x${b.regs.sp.toString(16)}`);
  return diffs;
}

/** Broken twin: increments BOARD_MODE WITHOUT clearing bit 3, then the same fill. */
function maskDroppingTwin(m) {
  m.mem.write8(BOARD_MODE, m.mem.read8(BOARD_MODE) + 1); // BUG: no bit-3 mask
  return m.call(0x3e01);
}

// -- 1. EQUAL (exhaustive over BOARD_MODE 0..255) -----------------------------

test("EQUAL (exhaustive): idiomatic == oracle for every BOARD_MODE value", () => {
  const seed = captureSeed();
  for (let v = 0; v <= 255; v++) {
    const diffs = contractDiffs(craft(seed, v), idiomatic);
    assert.equal(diffs.length, 0, `BOARD_MODE=${hx(v)}: ${diffs.join("; ")}`);
  }
  console.log("  EQUAL: idiomatic matches oracle (RAM+pc+SP) across all 256 BOARD_MODE values");
});

// -- 2. TEETH (the mask-dropping twin is caught where bit 3 matters) ----------

test("TEETH: dropping the bit-3 mask is CAUGHT on every value where bit 3 matters", () => {
  const seed = captureSeed();

  // The mask is load-bearing exactly when the incremented byte would carry the
  // 8s bit — ((v + 1) & 8) !== 0. On those values the twin MUST be caught.
  let caught = 0;
  let bitThreeValues = 0;
  for (let v = 0; v <= 255; v++) {
    const maskMatters = ((v + 1) & 8) !== 0;
    const diffs = contractDiffs(craft(seed, v), maskDroppingTwin);
    if (maskMatters) {
      bitThreeValues++;
      assert.ok(diffs.length > 0, `BOARD_MODE=${hx(v)}: mask-dropping twin escaped the gate`);
      caught++;
    }
  }
  assert.ok(bitThreeValues > 0, "expected some values where bit 3 matters");
  assert.equal(caught, bitThreeValues, "the twin must be caught on every bit-3 value");
  console.log(`  TEETH: mask-dropping twin caught on all ${caught} values where bit 3 is set`);
});

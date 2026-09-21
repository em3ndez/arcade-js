// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for nextTileInProbeRow (ROM 0x3410) — the 32-byte table-row
 * search the object-movement dispatcher uses as a "can the object step this way?"
 * test. It reads memory (the row index at 0x808d, the display-cell pointer at
 * 0x8089, the ROM table at 0x35fe) and writes NO work RAM; its only live result is
 * the found/not-found answer, which the idiomatic routine now RETURNS as a boolean.
 * (The frozen oracle still leaves that answer in its Z flag; the dead 0x319d reader
 * is overridden by stepEnemyMover, so the oracle's Z and its cursor-in-HL are no
 * longer live-outs.)
 *
 * So the contract compared here is: work RAM (dumpState) identical + the idiomatic
 * routine's BOOLEAN RETURN equals the oracle's Z flag (the true live-out). The
 * oracle's dead HL/scratch registers and SP are deliberately NOT compared.
 *
 * Jobs:
 *   1. EQUAL (captured dispatches) — hook 0x3410 in a real attract run; on every
 *      true dispatch, RAM is identical and the idiomatic return matches the oracle's
 *      Z. Attract naturally exercises BOTH arms (found and not-found), which is asserted.
 *   2. PURITY (captured) — the oracle writes no work RAM on any captured state,
 *      which is what licenses the memory-only contract.
 *   3. CRAFTED (non-zero row index) — attract only ever passes index 0, so a
 *      crafted entry pokes a non-zero index and a chosen neighbour key to force
 *      BOTH a found and a not-found result, proving the row-offset arithmetic and
 *      both branches agree with the oracle. The oracle's HL is checked to confirm the
 *      craft reached the offset row.
 *   4. TEETH — a twin that drops the pointer "+1" (searches the current cell, not
 *      the neighbour) returns a boolean that MUST diverge from the oracle's Z.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3410.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3410 as oracle } from "../../translated/loc_3410.js";
import { nextTileInProbeRow } from "../nextTileInProbeRow.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { F_Z } from "../../../../core/cpu/z80.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3410;
const TABLE_BASE = 0x35fe;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Build the factory once (the registry is built asynchronously and closed over).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Hook 0x3410 in a real attract run; clone the machine at up to K real dispatches. */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm); // let the host game proceed undisturbed
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/** Run `fn` on a fresh clone of `entry`; return the machine and `fn`'s return value. */
function runOn(entry, fn) {
  const m = entry.clone();
  const ret = fn(m);
  return { m, ret };
}

/** The declared contract: work RAM identical + the candidate's boolean return equals
 *  the oracle's Z flag (the true live-out). Returns a description or null. */
function contractDiff(oracleRun, candRun) {
  const oa = oracleRun.m, ca = candRun.m;
  const ram = firstStateDiff(oa.dumpState(), ca.dumpState(), (off) => oa.stateOffsetToAddr(off));
  if (ram) return `RAM@${hx(ram.addr ?? 0)} ${ram.a}!=${ram.b}`;
  const oracleZ = (oa.regs.f & F_Z) !== 0;
  if (candRun.ret !== oracleZ) return `bool ${candRun.ret}!=oracleZ ${oracleZ}`;
  return null;
}

// -- 1. EQUAL + 2. PURITY (captured dispatches) ------------------------------

test("EQUAL + PURITY: idiomatic == oracle on every real dispatch (RAM+HL+Z), oracle writes no RAM", () => {
  const caps = captureDispatches(200, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x3410 dispatch during attract");

  let found = 0, miss = 0;
  for (const cap of caps) {
    // PURITY: the oracle mutates no work RAM (licenses the memory-only contract).
    const oc = cap.clone();
    const before = oc.dumpState();
    oracle(oc);
    const wrote = firstStateDiff(before, oc.dumpState(), (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      wrote,
      null,
      wrote && `oracle wrote RAM at ${hx(wrote.addr ?? 0)} (${wrote.a}->${wrote.b}) — not memory-clean`,
    );

    // EQUAL: idiomatic reproduces the oracle on the declared contract.
    const a = runOn(cap, oracle);
    const b = runOn(cap, nextTileInProbeRow);
    const diff = contractDiff(a, b);
    assert.equal(diff, null, diff && `contract mismatch on a real dispatch: ${diff}`);

    if ((a.m.regs.f & F_Z) !== 0) found++; else miss++;
  }
  assert.ok(found > 0, "attract should hit the found arm at least once");
  assert.ok(miss > 0, "attract should hit the not-found arm at least once");
  console.log(
    `  EQUAL/purity: ${caps.length} real dispatches — RAM+HL+Z identical, no memory written ` +
      `(${found} found / ${miss} not-found)`,
  );
});

// -- 3. CRAFTED (non-zero row index, both arms forced) -----------------------

test("CRAFTED: a non-zero row index with a forced found & not-found key matches the oracle", () => {
  const caps = captureDispatches(4, 3000);
  assert.ok(caps.length >= 1, "need a base state to craft from");
  const base = caps[0];

  // Read a real ROM row so we can pick a key that IS present and one that is NOT.
  const rowIndex = 5; // non-zero -> exercises the row-offset add attract never does
  const rowBase = TABLE_BASE + rowIndex;
  const row = [];
  for (let i = 0; i < 32; i++) row.push(base.mem.read8(rowBase + i));
  const present = row[10];
  let absent = null;
  for (let v = 0; v < 256; v++) if (!row.includes(v)) { absent = v; break; }
  assert.notEqual(absent, null, "the row somehow contains all 256 byte values");

  const PTR = 0x87f0; // scratch high in work RAM, clear of the stack and game state

  for (const [label, key, wantZ] of [["found", present, true], ["not-found", absent, false]]) {
    const entry = base.clone();
    entry.mem.write8(0x808d, rowIndex);
    entry.mem.write8(0x8089, PTR & 0xff);
    entry.mem.write8(0x808a, (PTR >> 8) & 0xff);
    entry.mem.write8(PTR + 1, key); // the neighbour byte the search keys on

    const a = runOn(entry, oracle);
    const b = runOn(entry, nextTileInProbeRow);
    const diff = contractDiff(a, b);
    assert.equal(diff, null, diff && `crafted ${label}: contract mismatch: ${diff}`);
    assert.equal((a.m.regs.f & F_Z) !== 0, wantZ, `crafted ${label}: expected oracle Z=${wantZ}`);
    assert.equal(b.ret, wantZ, `crafted ${label}: expected idiomatic return ${wantZ}`);
    // The oracle's HL must land inside the offset row -> proves the index add was applied.
    assert.ok(
      a.m.regs.hl >= rowBase && a.m.regs.hl <= rowBase + 32,
      `crafted ${label}: oracle HL ${hx(a.m.regs.hl)} outside offset row [${hx(rowBase)}..${hx(rowBase + 32)}]`,
    );
    console.log(`  CRAFTED/${label}: index ${rowIndex}, key ${hx(key)} -> ret=${wantZ}, oracle HL=${hx(a.m.regs.hl)}, contract EQUAL`);
  }
});

// -- 4. TEETH (a broken twin must be caught) ---------------------------------

/** Broken twin: searches the current cell instead of the neighbour (drops the +1).
 *  Returns its (wrong) found/not-found boolean, the same live-out the real routine returns. */
function brokenLoc3410(m) {
  const { mem } = m;
  const rowIndex = mem.read8(0x808d);
  const rowBase = TABLE_BASE + rowIndex;
  const cellPtr = mem.read16(0x8089);
  const key = mem.read8(cellPtr); // BUG: should be cellPtr + 1 (the neighbour)
  for (let i = 0; i < 32; i++) {
    if (mem.read8(rowBase + i) === key) return true;
  }
  return false;
}

test("TEETH: the wrong-key twin (drops the pointer +1) is CAUGHT — its boolean return diverges from the oracle Z", () => {
  const caps = captureDispatches(200, 3000);
  assert.ok(caps.length >= 1);

  let caughtAt = -1, caughtDesc = null, boolFlips = 0;
  for (let i = 0; i < caps.length; i++) {
    const a = runOn(caps[i], oracle);
    const b = runOn(caps[i], brokenLoc3410);
    const diff = contractDiff(a, b);
    if (diff && caughtAt === -1) { caughtAt = i; caughtDesc = diff; }
    // The genuine live-out: the twin's boolean return vs the oracle's Z flag.
    const oracleZ = (a.m.regs.f & F_Z) !== 0;
    if (b.ret !== oracleZ) boolFlips++;
  }
  assert.notEqual(caughtAt, -1, "the contract FAILED to catch the wrong-key twin — it is worthless");
  assert.ok(boolFlips > 0, "the twin's boolean return never diverged from the oracle Z — the teeth do not bite");
  console.log(
    `  TEETH: wrong-key twin caught at dispatch ${caughtAt} (${caughtDesc}); ` +
      `its boolean return diverges from the oracle Z on ${boolFlips}/${caps.length} dispatches`,
  );
});

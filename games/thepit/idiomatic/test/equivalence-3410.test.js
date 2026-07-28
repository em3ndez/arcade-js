// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for nextTileInProbeRow (ROM 0x3410) — the 32-byte table-row
 * search the object-movement dispatcher uses as a "can the object step this way?"
 * test. It reads memory (the row index at 0x808d, the display-cell pointer at
 * 0x8089, the ROM table at 0x35fe) and writes NO work RAM; its only result the
 * caller consumes is the found/not-found flag (Z) it branches on. HL — the cursor
 * one past the matched byte — is reproduced to match the oracle though no caller
 * reads it.
 *
 * So the contract compared here is: work RAM (dumpState) identical + HL identical
 * + the Z flag identical. Dead scratch registers/flags and SP (the dropped stack
 * ABI) are deliberately NOT compared — the caller reads none of them.
 *
 * Jobs:
 *   1. EQUAL (captured dispatches) — hook 0x3410 in a real attract run; on every
 *      true dispatch, oracle vs nextTileInProbeRow leave identical RAM + HL + Z. Attract
 *      naturally exercises BOTH arms (found and not-found), which is asserted.
 *   2. PURITY (captured) — the oracle writes no work RAM on any captured state,
 *      which is what licenses the memory-only-except-the-flag contract.
 *   3. CRAFTED (non-zero row index) — attract only ever passes index 0, so a
 *      crafted entry pokes a non-zero index and a chosen neighbour key to force
 *      BOTH a found and a not-found result, proving the row-offset arithmetic and
 *      both branches agree with the oracle.
 *   4. TEETH — a twin that drops the pointer "+1" (searches the current cell, not
 *      the neighbour) MUST be caught by the same contract on the real dispatches.
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

/** Run `fn` on a fresh clone of `entry` and return the resulting machine. */
function runOn(entry, fn) {
  const c = entry.clone();
  fn(c);
  return c;
}

/** The declared contract: work RAM + HL + Z flag. Returns a description or null. */
function contractDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `RAM@${hx(ram.addr ?? 0)} ${ram.a}!=${ram.b}`;
  if (a.regs.hl !== b.regs.hl) return `HL ${hx(a.regs.hl)}!=${hx(b.regs.hl)}`;
  if ((a.regs.f & F_Z) !== (b.regs.f & F_Z)) {
    return `Z ${a.regs.f & F_Z}!=${b.regs.f & F_Z}`;
  }
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

    if ((a.regs.f & F_Z) !== 0) found++; else miss++;
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
    assert.equal((a.regs.f & F_Z) !== 0, wantZ, `crafted ${label}: expected Z=${wantZ}`);
    // HL must land inside the offset row -> proves the index add was applied.
    assert.ok(
      a.regs.hl >= rowBase && a.regs.hl <= rowBase + 32,
      `crafted ${label}: HL ${hx(a.regs.hl)} outside offset row [${hx(rowBase)}..${hx(rowBase + 32)}]`,
    );
    console.log(`  CRAFTED/${label}: index ${rowIndex}, key ${hx(key)} -> Z=${wantZ}, HL=${hx(a.regs.hl)}, contract EQUAL`);
  }
});

// -- 4. TEETH (a broken twin must be caught) ---------------------------------

/** Broken twin: searches the current cell instead of the neighbour (drops the +1). */
function brokenLoc3410(m) {
  const { regs, mem } = m;
  const rowIndex = mem.read8(0x808d);
  const rowBase = TABLE_BASE + rowIndex;
  const cellPtr = mem.read16(0x8089);
  const key = mem.read8(cellPtr); // BUG: should be cellPtr + 1 (the neighbour)
  let cursor = rowBase;
  let matched = false;
  for (let i = 0; i < 32; i++) {
    const hit = mem.read8(cursor) === key;
    cursor += 1;
    if (hit) { matched = true; break; }
  }
  regs.hl = cursor;
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z;
}

test("TEETH: the wrong-key twin (drops the pointer +1) is CAUGHT, including on the Z flag the caller reads", () => {
  const caps = captureDispatches(200, 3000);
  assert.ok(caps.length >= 1);

  let caughtAt = -1, caughtDesc = null, zFlips = 0;
  for (let i = 0; i < caps.length; i++) {
    const a = runOn(caps[i], oracle);
    const b = runOn(caps[i], brokenLoc3410);
    const diff = contractDiff(a, b);
    if (diff && caughtAt === -1) { caughtAt = i; caughtDesc = diff; }
    // The genuine live-out: the found/not-found flag the caller branches on.
    if ((a.regs.f & F_Z) !== (b.regs.f & F_Z)) zFlips++;
  }
  assert.notEqual(caughtAt, -1, "the contract FAILED to catch the wrong-key twin — it is worthless");
  assert.ok(zFlips > 0, "the twin never flipped the Z flag — teeth would only cover the dead HL");
  console.log(
    `  TEETH: wrong-key twin caught at dispatch ${caughtAt} (${caughtDesc}); ` +
      `flips the consumed Z flag on ${zFlips}/${caps.length} dispatches`,
  );
});

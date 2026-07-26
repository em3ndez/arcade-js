// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_4b3c (ROM 0x4b3c) — the 0xC0 board-mode door.
 *
 * loc_4b3c stows the board-mode / entry-select byte 0xC0 (into BOARD_MODE) and tail-
 * hands to the still-oracle shared setup body at 0x4b46, which clears sprite/attribute
 * RAM, repaints the tilemap, flat-fills colour RAM with that byte, and wipes a work
 * block. The idiomatic rewrite passes the byte the register way (a genuine oracle
 * boundary) and returns the same tail call, so it is gated by MEMORY-equivalence
 * against the frozen oracle: RAM byte-identical, and SP + pc landing at the same place
 * (both go through the same 0x4b46 body's return). It is NOT gated on the full register
 * file — the oracle's residual byte/flags are dead (the shared body reloads what it
 * needs); the whole-machine/pixel gate backstops that.
 *
 *   1. EQUAL (real dispatch) — boot the machine, hook 0x4b3c, and clone it at its
 *      single real dispatch (it fires once during the cold-boot init). Run the ORACLE
 *      on one clone and the idiomatic loc_4b3c on another, and prove RAM is byte-
 *      identical and SP/pc match. The routine is straight-line (set the byte, tail-hand
 *      to the shared body), so that one entry covers the whole control path.
 *
 *   2. NON-VACUOUS — the same run proves EQUAL is not passing on a no-op: the setup
 *      actually changes memory versus the captured entry (BOARD_MODE goes 0x00 -> 0xC0
 *      and the colour RAM it flat-fills changes too).
 *
 *   3. TEETH — a twin that stows the WRONG board-mode byte (0x00 instead of 0xC0) MUST
 *      be caught, at BOARD_MODE and in the colour RAM that byte flat-fills. A gate a
 *      wrong-selector bug slips through is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4b3c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4b3c as oracle } from "../../translated/loc_4b3c.js";
import { loc_4b3c as idiomatic } from "../loc_4b3c.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4b3c;
const BOARD_MODE = 0x8057; // where the door stows the selector byte
const COLOR_RAM_LO = 0x8800; // colour RAM the setup flat-fills with the selector byte
const COLOR_RAM_HI = 0x8bff;
const isColorRam = (a) => a >= COLOR_RAM_LO && a <= COLOR_RAM_HI;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** First game-visible RAM difference between two machines (full state dump), or null. */
function ramDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Boot the machine, hook 0x4b3c, and clone it at its first real dispatch. The wrapper
 * clones the entry state, then runs the oracle so the host boot proceeds undisturbed.
 */
function captureEntry(maxFrames) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  makeMachine(snap).runFrames(maxFrames);
  return entry;
}

/** Replay one entry state through the oracle and a candidate on independent fresh
 *  clones (the routine writes RAM), returning the diff + both post-run machines. */
function replay(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return { a, b, bad: ramDiff(a, b) };
}

// -- 1 + 2. EQUAL (real dispatch) + NON-VACUOUS -------------------------------

test("EQUAL: idiomatic loc_4b3c == oracle on the real dispatch (RAM + SP + pc)", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "expected a real 0x4b3c dispatch during boot");

  const { a, b, bad } = replay(entry, idiomatic);
  assert.equal(
    bad,
    null,
    bad && `game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
  );
  // Tail hand-off through the shared 0x4b46 body: both sides pop the same caller
  // return, so SP/pc land identically (this is what makes the tail modelling faithful).
  assert.equal(b.regs.sp, a.regs.sp, "SP must match the oracle after the tail return");
  assert.equal(b.pc, a.pc, "pc must match the oracle after the tail return");

  // NON-VACUOUS: the setup actually rewrote memory — the stowed selector byte and the
  // colour RAM it flat-fills both differ from the captured entry state.
  assert.notEqual(
    a.mem.read8(BOARD_MODE),
    entry.mem.read8(BOARD_MODE),
    "expected BOARD_MODE to change from the entry state (non-vacuous)",
  );
  const colorChanged = a.mem.read8(COLOR_RAM_LO) !== entry.mem.read8(COLOR_RAM_LO);
  assert.ok(colorChanged, "expected the flat-filled colour RAM to differ from the entry state (non-vacuous)");

  console.log(
    `  EQUAL: 1 real dispatch — RAM byte-identical, SP/pc land at ${hx(a.pc)}; ` +
      `BOARD_MODE ${hx(entry.mem.read8(BOARD_MODE))} -> ${hx(a.mem.read8(BOARD_MODE))}, ` +
      `colour[${hx(COLOR_RAM_LO)}] ${hx(entry.mem.read8(COLOR_RAM_LO))} -> ${hx(a.mem.read8(COLOR_RAM_LO))}`,
  );
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin: stows the WRONG board-mode byte (0x00, a sibling door's value) before
 *  running the same shared body — a plausible wrong-selector bug the RAM diff MUST
 *  catch at BOARD_MODE and in the colour RAM it flat-fills. */
function brokenLoc4b3c(m) {
  m.regs.a = 0x00; // BUG: stows the wrong door's selector byte
  return m.call(0x4b46);
}

test("TEETH: the wrong board-mode byte is CAUGHT (at BOARD_MODE / colour RAM)", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "need a real dispatch to test the teeth against");

  const { bad } = replay(entry, brokenLoc4b3c);
  assert.notEqual(bad, null, "the gate FAILED to catch a wrong board-mode byte — it is worthless");
  assert.ok(
    bad.addr === BOARD_MODE || isColorRam(bad.addr),
    `expected the caught diff at BOARD_MODE or in the flat-filled colour RAM, got ${hx(bad.addr)}`,
  );
  console.log(`  TEETH: wrong board-mode byte caught at ${hx(bad.addr)} (oracle=${bad.a} broken=${bad.b})`);
});

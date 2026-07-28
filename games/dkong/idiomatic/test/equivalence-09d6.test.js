// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for armTwoPlayerBoardSetup (ROM 0x09D6) — the 2-player board-setup arm.
 *
 * armTwoPlayerBoardSetup WRITES memory (two control latches, two posts through enqueueTask,
 * GAME_SUBSTATE, and a 3-cell VRAM column via the sub_09ee oracle) and ends by FALLING
 * THROUGH into sub_09ee, whose `ret` moves the stack — so unlike a pure leaf it is gated by
 * capture / clone / replay (docs/decompiler-pipeline) with a FRESH clone per case, and the contract includes
 * pc + SP (not just RAM):
 *
 *   1. EQUAL (real driven dispatch) — attract is a 1-player demo and never reaches this arm,
 *      so a 2-coin + start-2 tape drives a real 2-player game; the routine dispatches exactly
 *      once, at game start (GAME_SUBSTATE == 2, TWO_PLAYER_GAME == 1), with a real task ring
 *      and SP inside STACK_SCRATCH. Run the ORACLE on one clone and armTwoPlayerBoardSetup on
 *      another and confirm IDENTICAL RAM everywhere game-visible + identical pc + SP. The only
 *      residual RAM difference is confined to STACK_SCRATCH: the oracle models the push/ret
 *      stack traffic of its two `call 0x309F` sites; the idiomatic version calls enqueueTask
 *      directly and only sub_09ee's tail `ret` touches the stack — which is why pc/SP still
 *      MATCH (both pop the same caller return address) while the pushed bytes differ in-region.
 *
 *   2. EQUAL (crafted arms) — the single natural dispatch exercises only one ring state, so the
 *      enqueueTask branches attract/driven does not force are crafted on a real entry, poked
 *      IDENTICALLY on both sides: FULL ring (every slot occupied → both posts dropped, tail
 *      untouched, GAME_SUBSTATE + column still written) and WRAP ring (tail near the end → the
 *      second post wraps past 0xFF back to 0xC0). A CLEAN-ring arm additionally pins the exact
 *      footprint: ring payload 03 02 02 01, tail 0xC0 → 0xC4, GAME_SUBSTATE 0x600A = 5, and the
 *      VRAM column 0x74E0/0x74C0/0x74A0 = 02/25/20. (The two latches at 0x7D86/0x7D87 are
 *      write-only hardware latches — unmapped for READ — so they cannot be read back; both
 *      sides write them the same way and the whole-machine RAM diff covers everything else.)
 *
 *   3. TEETH — a deliberately-broken twin that posts the SECOND task with the wrong opcode
 *      (0x0301 instead of 0x0201 — a plausible copy-paste of the first post's opcode) MUST be
 *      caught. It diverges in the ring wherever the slot was free, so it is caught both on the
 *      real free-ring dispatch and on the deterministic CLEAN-ring arm. A gate a real
 *      corruption slips through is worthless.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-09d6.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_09d6 as oracle } from "../../translated/sub_09d6.js";
import { armTwoPlayerBoardSetup } from "../armTwoPlayerBoardSetup.js";
import { enqueueTask } from "../enqueueTask.js";
import { sub_09ee } from "../../translated/sub_09ee.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../../optimized/ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x09d6;
const TASK_TAIL = 0x60b0;
const RING_LO = 0x60c0, RING_HI = 0x60ff; // 32 slots x 2 bytes
const GAME_SUBSTATE = 0x600a;
const VRAM_CELLS = [0x74e0, 0x74c0, 0x74a0]; // the 3-cell column sub_09ee paints
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/**
 * Diff two machines' RAM. Returns the first difference OUTSIDE STACK_SCRATCH
 * (game-visible — a real failure) or null, plus how many bytes differed inside the
 * dead stack scratch (the tolerated push residue).
 */
function ramDiffMinusStack(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  let stackDiffs = 0, bad = null;
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) { stackDiffs++; continue; }
    if (!bad) bad = { addr, a: da[i], b: db[i] };
  }
  return { bad, stackDiffs };
}

/**
 * Replay one entry state through the oracle and a candidate on independent clones and
 * return the RAM diff plus each side's post-run pc/SP. The full contract is RAM(−stack)
 * + pc + SP (live-out is memory-only, so no register/flag comparison).
 */
function replay(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return { a, b, ...ramDiffMinusStack(a, b) };
}

// A 2-coin + start-2 tape credits and starts a real 2-player game (attract is a 1-player
// demo and never routes through this arm). IN2 (0x7D00): coin = bit7 (0x80), start2 = bit3 (0x08).
const TWO_PLAYER_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin 1
  { port: 0x7d00, bits: 0x80, frame: 30, dur: 6 }, // coin 2 (line must re-arm between coins)
  { port: 0x7d00, bits: 0x08, frame: 60, dur: 6 }, // start2
];

/**
 * Drive TWO_PLAYER_TAPE and clone the machine at up to K true 0x09D6 dispatches. The arm
 * fires once, at 2-player game start; the wrapper delegates to the oracle so the host run
 * proceeds. Capturing is fenced off after the host run.
 */
function captureDrivenDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.inputTape = TWO_PLAYER_TAPE.map((t) => ({ ...t }));
  host.runFrames(maxFrames);
  return caps;
}

// Poke a whole ring state (fill + tail) IDENTICALLY on a real entry — a surgical crafted
// nudge (docs/decompiler-pipeline), not a fabrication.
const fillRing = (m, byte) => { for (let s = RING_LO; s <= RING_HI; s++) m.mem.write8(s, byte); };
const CLEAN = (m) => { fillRing(m, 0xff); m.mem.write8(TASK_TAIL, 0xc0); }; // all free, base
const FULL  = (m) => { fillRing(m, 0x00); m.mem.write8(TASK_TAIL, 0xc0); }; // all occupied
const WRAP  = (m) => { fillRing(m, 0xff); m.mem.write8(TASK_TAIL, 0xfc); }; // 2nd post wraps to base

// -- 1. EQUAL (real driven dispatch) ------------------------------------------

test("EQUAL (driven): armTwoPlayerBoardSetup == oracle on the real 2-player dispatch (RAM−stack + pc + SP)", () => {
  const caps = captureDrivenDispatches(8, 400);
  assert.ok(caps.length >= 1, "expected the 2-player board-setup arm to dispatch during a driven start-2 game");

  for (const entry of caps) {
    // Sanity: the routine really is reached in its 2-player board-setup context.
    assert.equal(entry.mem.read8(0x600f), 1, "TWO_PLAYER_GAME must be 1 at this dispatch");
    assert.equal(entry.mem.read8(GAME_SUBSTATE), 2, "GAME_SUBSTATE must be 2 at this dispatch");
    // The oracle's push traffic must land in dead stack scratch, so excluding STACK_SCRATCH
    // cannot mask a real diff — the entry SP sits inside the region.
    assert.ok(
      entry.regs.sp > STACK_SCRATCH.lo && entry.regs.sp <= STACK_SCRATCH.hi,
      `entry SP must sit inside STACK_SCRATCH so oracle pushes stay in-region (SP=${hx(entry.regs.sp)})`,
    );

    const { a, b, bad } = replay(entry, armTwoPlayerBoardSetup);
    assert.equal(
      bad,
      null,
      bad && `game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
    );
    assert.equal(b.pc, a.pc, `pc mismatch: oracle=${hx(a.pc)} idiomatic=${hx(b.pc)}`);
    assert.equal(b.regs.sp, a.regs.sp, `SP mismatch: oracle=${hx(a.regs.sp)} idiomatic=${hx(b.regs.sp)}`);
  }
  console.log(`  EQUAL/driven: ${caps.length} real 2-player dispatch(es) — game-visible RAM + pc + SP identical`);
});

// -- 2. EQUAL (crafted arms) --------------------------------------------------

test("EQUAL (crafted): CLEAN / FULL / WRAP ring arms match the oracle, exact footprint pinned", () => {
  const caps = captureDrivenDispatches(1, 400);
  assert.ok(caps.length >= 1, "need a real entry to craft from");
  const entry = caps[0];

  for (const [label, craft] of [["CLEAN", CLEAN], ["FULL", FULL], ["WRAP", WRAP]]) {
    const a = entry.clone(), b = entry.clone();
    craft(a); craft(b);
    oracle(a);
    armTwoPlayerBoardSetup(b);
    const { bad } = ramDiffMinusStack(a, b);
    assert.equal(
      bad,
      null,
      bad && `${label}: game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
    );
    console.log(`  EQUAL/crafted ${label}: tail 0x60b0 -> ${hx(a.mem.read8(TASK_TAIL))}, game-visible RAM identical`);
  }

  // Positive content check on a clean ring: the exact footprint this arm lays down.
  const b = entry.clone();
  CLEAN(b);
  armTwoPlayerBoardSetup(b);
  const ring = [0, 1, 2, 3].map((i) => b.mem.read8(RING_LO + i));
  assert.deepEqual(ring, [0x03, 0x02, 0x02, 0x01], `clean-ring payload mismatch: got ${ring.map(hx).join(" ")}`);
  assert.equal(b.mem.read8(TASK_TAIL), 0xc4, "tail must advance 0xC0 -> 0xC4 (two posts)");
  assert.equal(b.mem.read8(GAME_SUBSTATE), 0x05, "GAME_SUBSTATE must advance to 5");
  const vram = VRAM_CELLS.map((a) => b.mem.read8(a));
  assert.deepEqual(vram, [0x02, 0x25, 0x20], `VRAM column mismatch: got ${vram.map(hx).join(" ")}`);
  console.log(
    `  EQUAL/crafted footprint: ring ${ring.map((v) => v.toString(16).padStart(2, "0")).join(" ")}, ` +
      `tail -> 0xc4, 0x600a -> 5, column ${vram.map((v) => v.toString(16).padStart(2, "0")).join(" ")}`,
  );
});

// -- 3. TEETH -----------------------------------------------------------------

/**
 * Broken twin: posts the SECOND task with the wrong opcode (0x0301 instead of 0x0201 — the
 * first post's opcode 0x03 copy-pasted). It differs ONLY in that byte, so it diverges in the
 * ring wherever the slot was free (the opcode byte of the second post: 0x03 vs 0x02).
 */
function brokenArmTwoPlayerBoardSetup(m) {
  const { regs, mem } = m;
  mem.write8(0x7d86, 0x00);
  mem.write8(0x7d87, 0x00);
  regs.de = 0x0302;
  enqueueTask(m);
  regs.de = 0x0301; // BUG: opcode should be 0x02
  enqueueTask(m);
  mem.write8(GAME_SUBSTATE, 0x05);
  return sub_09ee(m);
}

test("TEETH: the wrong-second-opcode twin is CAUGHT (real free-ring dispatch + deterministic clean ring)", () => {
  const caps = captureDrivenDispatches(8, 400);
  assert.ok(caps.length >= 1, "need a real dispatch to test the teeth against");

  // Captured catch: the real dispatch's ring slot is free, so the twin's wrong opcode shows.
  let caught = null;
  for (const entry of caps) {
    const { bad } = replay(entry, brokenArmTwoPlayerBoardSetup);
    if (bad) { caught = bad; break; }
  }
  assert.notEqual(caught, null, "the captured sweep FAILED to catch the wrong-opcode twin — it is worthless");

  // Deterministic clean-ring catch, independent of whatever ring state the game minted.
  const a = caps[0].clone(), b = caps[0].clone();
  CLEAN(a); CLEAN(b);
  oracle(a);
  brokenArmTwoPlayerBoardSetup(b);
  const { bad } = ramDiffMinusStack(a, b);
  assert.notEqual(bad, null, "clean-ring sweep FAILED to catch the wrong-opcode twin");
  console.log(`  TEETH: caught at ${hx(caught.addr)} (captured) and ${hx(bad.addr)} (clean ring)`);
});

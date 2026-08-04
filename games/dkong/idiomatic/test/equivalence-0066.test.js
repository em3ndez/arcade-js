// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for serviceVblankNmi (ROM 0x0066) — the vblank NMI handler:
 * ack the interrupt, kick the watchdog / reject SERVICE, DMA-blit the sprites, read the
 * controls when a game is in play, then run the per-frame work + epilogue (loc_00b5).
 *
 * This is the CYCLE-FREE / memory-equivalence gate (docs/decompiler-pipeline), not the retired strict
 * whole-machine one. serviceVblankNmi WRITES RAM everywhere (frame counter, RNG, sound
 * and task rings, the input latch, and whatever the GAME_STATE handler dispatches), so
 * every case uses a FRESH clone per side. The go-forward contract compared here is:
 *
 *     RAM (dumpState, minus STACK_SCRATCH)  +  SP  +  pc.
 *
 * Unlike a leaf whose oracle ends in a modelled `ret`, this routine's SP and pc are
 * FAITHFUL to the oracle — serviceVblankNmi reserves the 12-byte register-save frame
 * that loc_00b5's epilogue pops (see the routine header), so loc_00b5's SP arithmetic
 * and its final `ret` land byte-identically. So SP and pc ARE part of the contract here
 * (which also makes the reserve testable — TEETH B). Only the register FILE is excluded:
 * the oracle's saved-register VALUES are the interrupt ABI the direct-call layer drops,
 * and every push/pop lands in the excluded STACK_SCRATCH region (the DK stack never dips
 * below 0x6be0 — measured min SP over a 2600-frame run == 0x6be0).
 *
 * CAPTURE — 0x0066 is NOT reached through the m.call registry (fireNmi calls entry_0066
 * DIRECTLY), so it cannot be hooked via the override map like other routines. Instead we
 * wrap the host machine's fireNmi to MIRROR its prologue exactly (push the return PC,
 * charge the 11-t accept cost) and clone at that instant — the precise state entry_0066
 * is entered with — then run the oracle so the host attract run proceeds undisturbed.
 *
 * Jobs:
 *   1. EQUAL (captured NMI entries) — sample ~64 real NMI entries across a 2600-frame
 *      attract run (title frames, GAME_STATE 0 and 1, and demo frames with moving
 *      sprites so the blit is non-trivial); on each, oracle vs serviceVblankNmi leave
 *      identical RAM(−stack) + SP + pc.
 *   2. CRAFTED (game-in-play arm) — attract keeps ATTRACT (0x6007) != 0, so the
 *      loc_0087 arm is never taken naturally. Poke ATTRACT = 0 identically on both
 *      sides so both route through loc_0087, and confirm the arm is equivalent.
 *   3. TEETH A (the ATTRACT gate) — a twin that INVERTS the gate (reads input during
 *      attract) MUST be caught. On a capture where the oracle leaves the input-latch
 *      sentinel untouched, the inverted twin overwrites it — caught at 0x6010.
 *   4. TEETH B (the reserve is load-bearing) — a twin that OMITS the 12-byte SP reserve
 *      MUST break: loc_00b5's epilogue pops then overrun past 0x6C00. Caught as a throw.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0066.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0066 as oracleNmi } from "../../translated/loc_0066.js";
import { serviceVblankNmi } from "../serviceVblankNmi.js";
import { blitSpritesViaDma } from "../blitSpritesViaDma.js";
import { loc_0087 } from "../../translated/loc_0087.js";
import { loc_00b5 } from "../../translated/loc_00b5.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, ATTRACT } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Board I/O + the input latch, for the teeth twins (mirrors the routine's own consts).
const NMI_ENABLE = 0x7d84;
const IN2_WATCHDOG = 0x7d00;
const DMA_SETUP_BLOCK = 0x0138;
const P1_INPUT = 0x6010; // the byte loc_0087 writes; low byte ∈ {0x00-0x0f, 0x80-0x8f}
const SENTINEL = 0x5a; // a value loc_0087 can NEVER leave at 0x6010 -> unambiguous "it ran"

const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

/**
 * First divergence on the go-forward contract, or null: RAM (dumpState, minus the dead
 * STACK_SCRATCH region), then SP, then pc. Returns a tagged diff for reporting.
 *
 * A single forward pass that simply SKIPS dead-stack addresses — unlike the blit test's
 * subarray-restart helper, which cannot be reused here: entry_0066 leaves MANY dead-stack
 * diffs (the 12-byte register-save frame the oracle writes and the idiomatic side does
 * not, plus the offset stack traffic), and skipping them one subarray at a time is both
 * quadratic and easy to get wrong. One masked scan is correct and O(n).
 */
function contractDiff(ma, mb) {
  const a = ma.dumpState();
  const b = mb.dumpState();
  const n = Math.min(a.length, b.length);
  for (let off = 0; off < n; off++) {
    if (a[off] === b[off]) continue;
    const addr = ma.stateOffsetToAddr(off);
    if (inDeadStack(addr)) continue;
    return { kind: "ram", addr, a: a[off], b: b[off] };
  }
  if (ma.regs.sp !== mb.regs.sp) return { kind: "sp", a: ma.regs.sp, b: mb.regs.sp };
  if (ma.pc !== mb.pc) return { kind: "pc", a: ma.pc, b: mb.pc };
  return null;
}

/**
 * Capture up to K real NMI entry states, sampled one in `stride`, over a `maxFrames`
 * attract run. 0x0066 is not in the m.call registry (fireNmi calls entry_0066 directly),
 * so we wrap fireNmi and MIRROR its prologue (push PC, +11 t) to clone the exact state
 * entry_0066 is entered with, then run the oracle so the host proceeds to a clean stop.
 */
function captureNmiEntries(K, stride, maxFrames) {
  const caps = [];
  let seen = 0;
  const host = new Machine(ROM);
  const origFire = host.fireNmi.bind(host);
  host.fireNmi = function () {
    if (!this.pcKnown) return origFire(); // let the real guard throw its diagnostic
    this.nmiCount += 1;
    this.push16(this.pc);
    this.cycles += 11;
    if (caps.length < K && seen % stride === 0) caps.push(this.clone());
    seen += 1;
    return oracleNmi(this);
  };
  host.runFrames(maxFrames);
  return caps;
}

// Sample across ~2600 frames so the window spans the title (GAME_STATE 0/1, trivial
// blit) and the attract 25m demo (moving sprites -> non-trivial blit) alike.
const CAPS = ROM_PRESENT ? captureNmiEntries(64, 40, 2600) : [];

/** Does the oracle's blit move any sprite-RAM byte on this capture? */
function blitIsNonTrivial(cap) {
  const before = cap.clone();
  const after = cap.clone();
  oracleNmi(after);
  for (let a = 0x7000; a <= 0x7180; a++) {
    if (before.mem.read8(a) !== after.mem.read8(a)) return true;
  }
  return false;
}

// -- 1. EQUAL (captured NMI entries) ------------------------------------------

test("EQUAL: real captured NMI entries — serviceVblankNmi == oracle (RAM −stack, SP, pc)", () => {
  assert.ok(CAPS.length >= 1, "expected at least one real NMI entry in the attract window");

  let attractSkips = 0, nonTrivial = 0;
  const states = new Set();
  for (const cap of CAPS) {
    const o = cap.clone();
    const c = cap.clone();
    oracleNmi(o);
    serviceVblankNmi(c);

    const d = contractDiff(o, c);
    assert.equal(
      d,
      null,
      d && (d.kind === "ram"
        ? `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`
        : `${d.kind} diff: oracle=${hx(d.a)} idiomatic=${hx(d.b)}`),
    );

    if (cap.mem.read8(ATTRACT) !== 0) attractSkips += 1;
    if (blitIsNonTrivial(cap)) nonTrivial += 1;
    states.add(cap.mem.read8(0x6005));
  }
  console.log(
    `  EQUAL: ${CAPS.length} NMI entries identical (RAM −stack, SP, pc); ` +
      `attract(skip-input)=${attractSkips}, non-trivial blit=${nonTrivial}, ` +
      `GAME_STATE seen={${[...states].sort().join(",")}}`,
  );
});

// -- 2. CRAFTED (game-in-play arm: loc_0087) ------------------------------

test("CRAFTED: game-in-play arm — poke ATTRACT=0, both route through loc_0087, equal", () => {
  const base = CAPS.find((c) => c.mem.read8(ATTRACT) !== 0) ?? CAPS[0];
  const o = base.clone();
  const c = base.clone();
  // Identical surgical nudge: force a credited game so BOTH sides take the loc_0087
  // arm attract never reaches. (No input asserted, so loc_0087' bit-6 soft-reset
  // path is not tripped.)
  o.mem.write8(ATTRACT, 0);
  c.mem.write8(ATTRACT, 0);

  oracleNmi(o);
  serviceVblankNmi(c);

  const d = contractDiff(o, c);
  assert.equal(
    d,
    null,
    d && (d.kind === "ram"
      ? `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`
      : `${d.kind} diff: oracle=${hx(d.a)} idiomatic=${hx(d.b)}`),
  );

  // Non-vacuous: the arm choice is observable — the ATTRACT=0 result differs from the
  // attract skip-path result on the same base (loc_0087 ran, and/or the dispatch
  // saw a different ATTRACT), so this exercised a genuinely different code path.
  const skip = base.clone(); // ATTRACT left != 0 -> loc_0087 skipped
  serviceVblankNmi(skip);
  assert.notEqual(
    contractDiff(c, skip),
    null,
    "poking ATTRACT=0 produced an identical machine to the skip path — the arm was not exercised",
  );
  console.log("  CRAFTED: ATTRACT=0 -> both route through loc_0087; RAM/SP/pc identical; arm is observable");
});

// -- 3. TEETH A (the ATTRACT gate) --------------------------------------------

// Broken twin: the ATTRACT gate is INVERTED — it reads the controls DURING attract and
// skips them in a credited game. Everything else (blit, reserve, loc_00b5) is faithful.
function brokenInvertedGate(m) {
  const { regs, mem } = m;
  mem.write8(NMI_ENABLE, 0);
  if (mem.read8(IN2_WATCHDOG) & 0x01) throw new Error("service");
  regs.hl = DMA_SETUP_BLOCK;
  blitSpritesViaDma(m);
  if (mem.read8(ATTRACT) !== 0) loc_0087(m); // BUG: should be === 0
  regs.sp = (regs.sp - 12) & 0xffff;
  loc_00b5(m);
}

test("TEETH A: an inverted ATTRACT gate (reads input during attract) is CAUGHT", () => {
  // Find a capture where the CORRECT handler (attract skip) leaves the input-latch
  // sentinel untouched — i.e. the dispatch does not overwrite 0x6010 that frame — so
  // the inverted twin's loc_0087 write is observable.
  let idx = -1;
  for (let i = 0; i < CAPS.length; i++) {
    const probe = CAPS[i].clone();
    probe.mem.write8(ATTRACT, 1);
    probe.mem.write8(P1_INPUT, SENTINEL);
    oracleNmi(probe);
    if (probe.mem.read8(P1_INPUT) === SENTINEL) { idx = i; break; }
  }
  assert.notEqual(idx, -1, "no capture left the input-latch sentinel intact — cannot stage the gate teeth");

  const o = CAPS[idx].clone();
  const c = CAPS[idx].clone();
  o.mem.write8(ATTRACT, 1); c.mem.write8(ATTRACT, 1); // force attract -> correct handler SKIPS input
  o.mem.write8(P1_INPUT, SENTINEL); c.mem.write8(P1_INPUT, SENTINEL);

  oracleNmi(o); // correct: skips loc_0087, sentinel survives
  brokenInvertedGate(c); // wrong: reads input in attract, overwrites the sentinel

  const d = contractDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch an inverted ATTRACT gate — it is worthless");
  assert.equal(d.kind, "ram");
  assert.equal(d.addr, P1_INPUT, `expected the catch at the input latch ${hx(P1_INPUT)}, got ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH A: inverted ATTRACT gate caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH B (the 12-byte SP reserve is load-bearing) ----------------------

// Broken twin: identical to serviceVblankNmi but OMITS `regs.sp -= 12`. loc_00b5's
// epilogue then pops the register-save frame + return PC from too high a stack and
// overruns past the top of work RAM (0x6C00) — an unmapped read.
function brokenNoReserve(m) {
  const { regs, mem } = m;
  mem.write8(NMI_ENABLE, 0);
  if (mem.read8(IN2_WATCHDOG) & 0x01) throw new Error("service");
  regs.hl = DMA_SETUP_BLOCK;
  blitSpritesViaDma(m);
  if (mem.read8(ATTRACT) === 0) loc_0087(m);
  // BUG: no `regs.sp -= 12` — loc_00b5's epilogue pops will overrun.
  loc_00b5(m);
}

test("TEETH B: omitting the 12-byte SP reserve overruns the stack — CAUGHT (throws)", () => {
  const base = CAPS[0];
  // The correct routine runs clean on this same state...
  serviceVblankNmi(base.clone());
  // ...and the reserve-less twin overruns loc_00b5's pops past 0x6C00.
  assert.throws(
    () => brokenNoReserve(base.clone()),
    /unmapped read|0x6c00/i,
    "the reserve-less twin did NOT overrun — the 12-byte reserve is not actually load-bearing here",
  );
  console.log("  TEETH B: dropping the SP reserve overruns loc_00b5's epilogue past 0x6C00 (throws) — reserve is load-bearing");
});

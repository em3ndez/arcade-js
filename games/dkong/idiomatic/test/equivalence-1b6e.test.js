// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for initMarioJump (ROM 0x1B6E) — the jump-init front half.
 *
 * loc_1b6e flags Mario airborne (MARIO_AIRBORNE := 1), reads P1_INPUT to choose a
 * horizontal launch velocity (Right -> +0x0080, Left -> 0xFF80, neither -> 0x0000,
 * Right winning if both are held), and tail-calls loc_1b8a (launchMarioJump) to write
 * the rest of the airborne record. Its observable output is therefore a function of
 * three RAM inputs: P1_INPUT (the direction bits), MARIO_SPRITE_CODE (only bit 7,
 * facing, survives into the jump pose) and MARIO_Y (copied to the take-off snapshot).
 * The candidate takes NO parameters — like the oracle, it reads P1_INPUT from RAM —
 * so both sides are driven purely by memory. Gated four ways:
 *
 *   1. EQUAL (crafted sweep) — over every P1_INPUT edge (all three velocity arms,
 *      Right-precedence when both held, Up/Down noise bits) × facing-bit × take-off-Y,
 *      run oracle vs initMarioJump on FRESH clones of a real captured entry and diff
 *      the full state dump (work+sprite+video, which excludes pc/SP). Covers the
 *      airborne flag, the velocity mapping, the pose facing bit, and the Y snapshot.
 *
 *   2. EQUAL (input breadth) — sweep all 256 P1_INPUT bytes at a fixed sprite/Y and
 *      confirm every one lands byte-identically: proves no input bit beyond 0/1 (and
 *      their Right-first precedence) changes the outcome.
 *
 *   3. TEETH — a deliberately-broken twin that checks Left (bit 1) BEFORE Right
 *      (bit 0), so it picks the wrong velocity only when both are held. It agrees with
 *      the oracle on every single-direction and no-direction input, so only a sweep
 *      that includes a both-held input (0x03 / 0x83 / 0xff) catches it.
 *
 *   4. REALISM + MEMORY-EQUIVALENCE (captured dispatches) — hook 0x1B6E in a real
 *      attract run (Mario jumps naturally, hitting all three arms) and clone the
 *      machine at each true invocation; for each, run the oracle and initMarioJump on
 *      independent FRESH clones and diff the full state dump. Also confirm the oracle's
 *      memory footprint is a subset of the eleven expected addresses — nothing else,
 *      stack untouched.
 *
 * WHY NOT pc/SP or registers: the idiomatic routine models the Z80 tail-jump chain's
 * `ret` as the JS return and drops the dead register ABI (doc-06). loc_1b6e's live-out
 * is memory-only (entry_1ac3→here→loc_1b8a returns to loc_197a @0x1983, which calls the
 * next cascade routine without reading A/HL/BC/flags). So RAM is the whole contract;
 * comparing pc/SP would measure the absent ret, not the routine's logic. A FRESH clone
 * per side is used everywhere — this routine writes memory, so snapshots are never
 * shared (unlike the pure-leaf exemplar).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1b6e.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1b6e as oracle } from "../../translated/loc_1b6e.js";
import { initMarioJump } from "../initMarioJump.js";
import { launchMarioJump } from "../launchMarioJump.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  MARIO_AIRBORNE, P1_INPUT, MARIO_SPRITE_CODE, MARIO_Y,
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_AIR_START_Y, SND_TRIGGER,
} from "../../optimized/ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1b6e;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// The eleven RAM bytes the loc_1b6e -> loc_1b8a chain may write: MARIO_AIRBORNE (set
// here) plus the ten launchMarioJump writes. A footprint MUST be a subset of these.
const FOOTPRINT = [
  MARIO_AIRBORNE,
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_SPRITE_CODE,
  MARIO_AIR_START_Y, SND_TRIGGER + 1,
];
const FOOTPRINT_SET = new Set(FOOTPRINT);

/**
 * Hook 0x1B6E in a real attract run and clone the machine at up to K real dispatches.
 * Attract plays 25m and the demo Mario jumps, so entry_1ac3 tail-jumps here with a real
 * P1_INPUT and live surrounding RAM. The wrapper clones the entry state, then runs the
 * oracle so the host game proceeds undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

/**
 * Prime a clone with a crafted (input, spr, y) entry, run `which`
 * (oracle | candidate), and return its full state dump. BOTH the oracle and the
 * candidate read the direction from P1_INPUT in RAM, so the crafted state is entirely
 * in memory — no registers are set. SP is put into work RAM so the oracle's trailing
 * `ret` (in the loc_1b8a tail) pops valid bytes (it reads them, never writes).
 */
function runCrafted(base, which, input, spr, y) {
  const m = base.clone();
  m.mem.write8(P1_INPUT, input);
  m.mem.write8(MARIO_SPRITE_CODE, spr);
  m.mem.write8(MARIO_Y, y);
  m.regs.sp = 0x6bfe;
  if (which === "oracle") oracle(m);
  else which(m);
  return m;
}

/**
 * Sweep a candidate against the oracle over INPUTS × SPRS × YS, on fresh clones of
 * `base`. Returns the first state-dump mismatch (or null) and the combo count.
 */
function craftedSweep(base, candidate, INPUTS, SPRS, YS) {
  let count = 0;
  for (const input of INPUTS) {
    for (const spr of SPRS) {
      for (const y of YS) {
        const a = runCrafted(base, "oracle", input, spr, y);
        const b = runCrafted(base, candidate, input, spr, y);
        count++;
        const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
        if (d) return { mismatch: { input, spr, y, d }, count };
      }
    }
  }
  return { mismatch: null, count };
}

// P1_INPUT edges: all three velocity arms, Right-precedence when both bits set, and
// noise from the jump-edge (bit7) / Up (bit2) / Down (bit3) bits that must NOT matter.
const INPUTS = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x08, 0x0c,
  0x80, 0x81, 0x82, 0x83, 0x84, 0x88,
  0xfe, 0xff,
];
// Entry sprite codes: facing bit clear/set over varied low bits (only bit 7 survives).
const SPRS = [0x00, 0x80, 0x02, 0x82, 0x0f, 0x8f];
// Entry Y values (copied to the take-off snapshot): boundaries + samples.
const YS = [0x00, 0x4c, 0xa0, 0xf0, 0xff];

const fmt = (mm) =>
  `input=${hx(mm.input)} spr=${hx(mm.spr)} y=${hx(mm.y)}: ` +
  `diverged at 0x${(mm.d.addr ?? 0).toString(16)} (oracle=${mm.d.a} cand=${mm.d.b})`;

// -- 1. EQUAL (crafted sweep) -------------------------------------------------

test("EQUAL (crafted sweep): initMarioJump == oracle over input × facing × Y edges", () => {
  const caps = captureDispatches(8, 6000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b6e dispatch to seed the sweep base");
  const base = caps[0];

  const { mismatch, count } = craftedSweep(base, initMarioJump, INPUTS, SPRS, YS);
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  assert.equal(count, INPUTS.length * SPRS.length * YS.length, "must have swept the full crafted grid");
  console.log(`  EQUAL/crafted: ${count} (input,facing,Y) combos identical state dumps`);
});

// -- 2. EQUAL (input breadth) -------------------------------------------------

test("EQUAL (input breadth): all 256 P1_INPUT bytes match the oracle", () => {
  const caps = captureDispatches(8, 6000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b6e dispatch to seed the base");
  const base = caps[0];

  let count = 0;
  let mismatch = null;
  for (let input = 0; input < 256 && !mismatch; input++) {
    const a = runCrafted(base, "oracle", input, 0x82, 0xcc);
    const b = runCrafted(base, initMarioJump, input, 0x82, 0xcc);
    count++;
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) mismatch = { input, spr: 0x82, y: 0xcc, d };
  }
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  assert.equal(count, 256, "must have swept all 256 input bytes");
  console.log(`  EQUAL/input-breadth: ${count} P1_INPUT bytes identical to the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

/**
 * Broken twin: checks Left (bit 1) BEFORE Right (bit 0), inverting the oracle's
 * Right-first precedence. It picks the wrong velocity only when BOTH are held, so it
 * agrees with the oracle on every single-direction and no-direction input — only a
 * both-held input (0x03 / 0x83 / 0xff) exposes it.
 */
function brokenInit(m) {
  const { mem } = m;
  mem.write8(MARIO_AIRBORNE, 1);
  const input = mem.read8(P1_INPUT);
  let vxHi, vxLo;
  if (input & 0x02) {        // BUG: Left tested first
    vxHi = 0xff; vxLo = 0x80;
  } else if (input & 0x01) { // Right only reached if Left is clear
    vxHi = 0x00; vxLo = 0x80;
  } else {
    vxHi = 0x00; vxLo = 0x00;
  }
  launchMarioJump(m, vxHi, vxLo);
}

test("TEETH: the wrong-precedence twin (Left before Right) is CAUGHT by the sweep", () => {
  const caps = captureDispatches(8, 6000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b6e dispatch to seed the base");
  const base = caps[0];

  const { mismatch, count } = craftedSweep(base, brokenInit, INPUTS, SPRS, YS);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch inverted Right/Left precedence — it is worthless");
  console.log(`  TEETH: caught after ${count} combos at ${fmt(mismatch)}`);
});

// -- 4. REALISM + MEMORY-EQUIVALENCE (captured dispatches) --------------------

test("REALISM + MEMORY-EQUIVALENCE: real captured jump-init dispatches — state dumps match, footprint ⊆ expected", () => {
  const caps = captureDispatches(64, 8000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b6e dispatch during attract");

  const armsSeen = new Set();
  for (const cap of caps) {
    armsSeen.add(hx(cap.mem.read8(P1_INPUT)));

    // FRESH clone per side — this routine writes memory, so snapshots are never shared.
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    const before = a.dumpState();
    oracle(a);
    initMarioJump(b);

    // MEMORY-EQUIVALENCE: identical state dump (excludes pc/SP; neither the oracle's
    // tail `ret` nor the JS return writes RAM beyond the eleven bytes above).
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `RAM diverged at 0x${(d.addr ?? 0).toString(16)} (oracle=${d.a} cand=${d.b}) ` +
        `on real dispatch input=${hx(cap.mem.read8(P1_INPUT))}`,
    );

    // FOOTPRINT: every byte the oracle changed vs the captured entry is one of the
    // eleven expected addresses — justifies the routine's write set, stack untouched.
    const after = a.dumpState();
    const changed = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) changed.push(a.stateOffsetToAddr(i));
    }
    const stray = changed.filter((addr) => !FOOTPRINT_SET.has(addr));
    assert.equal(
      stray.length,
      0,
      `oracle wrote outside its footprint: [${stray.map((x) => "0x" + x.toString(16)).join(",")}]`,
    );
  }
  console.log(
    `  REALISM: ${caps.length} real 0x1b6e dispatches — state dumps == oracle, footprint ⊆ expected; ` +
      `P1_INPUT values seen: ${[...armsSeen].join(", ")}`,
  );
});

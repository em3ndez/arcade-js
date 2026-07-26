// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_384a (ROM 0x384a) — the per-frame animate + march
 * step for an active object (cadence tick + walk-tile flip, an every-4th-tick move that
 * marches the object across its travel row then descends it to the floor).
 *
 * The whole observable effect is the work RAM the object leaves behind: its coordinate
 * and tile, the shadow sprite's coordinate and tile, the arrival flag/latch, the floor
 * hold-timer, and the two sprite records the tail call (loc_3a4c) rebuilds. Everything
 * else the oracle also moves — the accumulator/flags it threads instruction to
 * instruction, and, on the one direct-return arm, the stack pop — is dead: every non-idle
 * exit routes through loc_3a4c, which reloads the whole register file, and the idle
 * direct-return's residual accumulator is read by no one up the tail-jump caller chain.
 * So the idiomatic rewrite replicates every memory write (including the return address it
 * must seed for the still-oracle callee loc_1b5b) and the comparison is full work RAM.
 *
 *   1. UNIT (strict, first real dispatch) — unitEquivalence captures the machine at the
 *      first natural dispatch and diffs full RAM + the whole register file + pc. The first
 *      dispatch is a march step, which exits through loc_3a4c, so even the strict register
 *      gate agrees — a real captured entry on which "same memory AND register state" holds
 *      literally.
 *   2. REALISM (all real dispatches, full RAM) — hook 0x384a through a whole attract run
 *      (it is dispatched in the gameplay demo, ~584 times after frame 4000), clone at each
 *      dispatch, and run oracle vs idiomatic on two fresh clones. Full work RAM identical
 *      on every one — covering the tail-early, march, descend, latch+probe, and floor-idle
 *      arms the demo actually produces.
 *   3. CRAFTED — force the arms the demo underexercises (the floor re-arm when the hold
 *      timer has elapsed, both tile-toggle directions, the latch+probe build) on a real
 *      captured background, poked identically on both sides. Full work RAM identical.
 *   4. TEETH — a twin with the wrong shadow-X trailing offset (32 instead of 16) MUST be
 *      caught. The march step is the first dispatch and a common arm, so both the strict
 *      unit gate and the full-RAM sweep catch it.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-384a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_384a as oracle } from "../../translated/loc_384a.js";
import { loc_384a as idiomatic } from "../loc_384a.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";
import { ACTOR_TIMER, ACTOR_TILE, ACTOR_X, ACTOR_Y } from "../ram.js";

const FLOOR_HOLD = 0x807c; // idles the object at the floor (unnamed in ram.js)
const BIAS = 0x8051; // record-build bias read by the still-oracle callees

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x384a;
const CAPTURE_FRAMES = 8000; // the demo (where the object lives) starts after ~frame 4000
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async,
// so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Run oracle and candidate on two FRESH clones of `entry`; return the first full-RAM
 *  difference (or null). Full work RAM is the contract — the routine replicates every
 *  memory write, so nothing is excluded. */
function ramDiff(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
}

/** Capture a clone at every 0x384a dispatch across an attract run (the wrapper runs the
 *  oracle so the host proceeds normally). */
function captureDispatches() {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => { caps.push(mm.clone()); return oracle(mm); }]]);
  makeMachine(snapshot).runFrames(CAPTURE_FRAMES);
  return caps;
}

/** A crafted entry: a real captured background with the named object bytes poked. */
function craft(base, pokes) {
  const e = base.clone();
  for (const [addr, val] of pokes) e.mem.write8(addr, val);
  return e;
}

// -- 1. UNIT: strict RAM + registers + pc on the first real dispatch ----------

test("UNIT: idiomatic == oracle on full RAM + registers + pc at the first real dispatch", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: 6000 });
  assert.equal(
    res.equal,
    true,
    `strict unit gate reported a diff: ram=${JSON.stringify(res.ram)} ` +
      `regs=${JSON.stringify(res.regs)} pc=${JSON.stringify(res.pc)}`,
  );
  console.log("  UNIT: first real dispatch (a march step, exits via loc_3a4c) — RAM+regs+pc identical");
});

// -- 2. REALISM: full RAM over every real dispatch ----------------------------

test("REALISM: idiomatic == oracle on full work RAM over every real attract dispatch", () => {
  const caps = captureDispatches();
  assert.ok(caps.length >= 100, `expected many real 0x384a dispatches, got ${caps.length}`);

  let checked = 0;
  for (const cap of caps) {
    const ram = ramDiff(cap, idiomatic);
    assert.equal(
      ram,
      null,
      ram && `RAM diverges at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b}) ` +
        `on dispatch ${checked}`,
    );
    checked++;
  }
  console.log(`  REALISM: ${checked} real dispatches — full work RAM identical to the oracle`);
});

// -- 3. CRAFTED: the arms the demo underexercises -----------------------------

test("CRAFTED: floor re-arm, tile toggles, and latch+probe match on real backgrounds", () => {
  const caps = captureDispatches();
  const bg = caps[caps.length - 1];

  // A move tick fires when the post-decrement timer is a multiple of 4; timer=5 gives a
  // clean move tick with no cadence underflow, timer=1 underflows (reload + tile flip).
  const crafted = [
    { tag: "floor re-arm (hold elapsed)", pokes: [[ACTOR_TIMER, 5], [ACTOR_Y, 0], [FLOOR_HOLD, 0]] },
    { tag: "floor idle (hold running)", pokes: [[ACTOR_TIMER, 5], [ACTOR_Y, 0], [FLOOR_HOLD, 0x40]] },
    { tag: "tile toggle A->B", pokes: [[ACTOR_TIMER, 1], [ACTOR_TILE, 46], [ACTOR_Y, 0], [FLOOR_HOLD, 0x40]] },
    { tag: "tile toggle B->A", pokes: [[ACTOR_TIMER, 1], [ACTOR_TILE, 175], [ACTOR_Y, 0], [FLOOR_HOLD, 0x40]] },
    { tag: "tile toggle other->A", pokes: [[ACTOR_TIMER, 1], [ACTOR_TILE, 99], [ACTOR_Y, 0], [FLOOR_HOLD, 0x40]] },
    { tag: "march right", pokes: [[ACTOR_TIMER, 5], [ACTOR_Y, 30], [ACTOR_X, 10]] },
    { tag: "march to far column (X edge)", pokes: [[ACTOR_TIMER, 5], [ACTOR_Y, 30], [ACTOR_X, 35]] },
    { tag: "latch + probe build", pokes: [[ACTOR_TIMER, 5], [ACTOR_Y, 23], [ACTOR_X, 40], [BIAS, 3]] },
    { tag: "descend", pokes: [[ACTOR_TIMER, 5], [ACTOR_Y, 30], [ACTOR_X, 40]] },
    { tag: "tail-early (not a move tick)", pokes: [[ACTOR_TIMER, 4]] },
  ];

  for (const { tag, pokes } of crafted) {
    const ram = ramDiff(craft(bg, pokes), idiomatic);
    assert.equal(ram, null, ram && `crafted "${tag}": RAM diverges at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
  }
  console.log(`  CRAFTED: ${crafted.length} forced arms — full work RAM identical to the oracle`);
});

// -- 4. TEETH: a deliberately-broken twin MUST be caught ----------------------

/**
 * A twin of the idiomatic routine with ONE wrong constant: the shadow sprite trails the
 * object by 32 columns instead of 16. A real logic error on the march arm.
 */
function brokenShadowOffset(m) {
  const { mem } = m;
  mem.write8(ACTOR_TIMER, mem.read8(ACTOR_TIMER) - 1);
  let timer = mem.read8(ACTOR_TIMER);
  if (timer === 0) {
    timer = 8;
    mem.write8(ACTOR_TIMER, 8);
    const next = mem.read8(ACTOR_TILE) === 46 ? 175 : 46;
    mem.write8(ACTOR_TILE, next);
    mem.write8(0x811c, next ^ 1);
  }
  if (timer % 4 !== 0) return m.call(0x3a4c);
  const y = mem.read8(ACTOR_Y);
  if (y >= 23) {
    const x = mem.read8(ACTOR_X);
    if (x < 36) {
      mem.write8(ACTOR_X, x + 1);
      mem.write8(0x811b, mem.read8(ACTOR_X) + 32); // BUG: shadow-X offset should be 16
      return m.call(0x3a4c);
    }
    if (y === 23) {
      mem.write8(0x8079, 0);
      mem.write8(0x8068, 0);
      mem.write8(0x807d, 1);
      m.push16(0x3897);
      m.call(0x1b5b);
    }
  }
  const row = mem.read8(ACTOR_Y);
  if (row !== 0) {
    const nextRow = row - 1;
    mem.write8(ACTOR_Y, nextRow);
    mem.write8(0x811e, nextRow);
    return m.call(0x3a4c);
  }
  if (mem.read8(FLOOR_HOLD) !== 0) return;
  mem.write8(FLOOR_HOLD, 120);
  mem.write8(ACTOR_TILE, 9);
  mem.write8(0x811c, 9);
  return m.call(0x3a4c);
}

test("TEETH: the wrong-shadow-offset twin is CAUGHT (full RAM has teeth)", () => {
  // On a march arm the twin writes the wrong shadow X — caught by the RAM diff.
  const caps = captureDispatches();
  const bg = caps[caps.length - 1];
  const marchEntry = craft(bg, [[ACTOR_TIMER, 5], [ACTOR_Y, 30], [ACTOR_X, 10]]);
  const ram = ramDiff(marchEntry, brokenShadowOffset);
  assert.ok(ram, "the wrong-shadow-offset twin must be caught by the full-RAM diff on a march arm");

  // And the strict unit gate catches it at the first real dispatch (also a march step).
  const res = unitEquivalence(makeMachine, TARGET, oracle, brokenShadowOffset, { maxFrames: 6000 });
  assert.equal(res.equal, false, "the strict unit gate must also catch the broken twin");
  assert.notEqual(res.ram, null, "the twin's defect must surface as a RAM difference");
  console.log(
    `  TEETH: caught at ${hx(ram.addr ?? 0)} (oracle=${ram.a} twin=${ram.b}); ` +
      `unit gate caught it at ${hx(res.ram.addr ?? 0)}`,
  );
});

// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_191a -- seat a fixed sprite-id list (count 0x1c, source loc_1ae4, screen slot
// loc_241e) and tail-delegate to the sprite-list driver drawSpriteList (the tail-jump is DISSOLVED into a direct
// call). Live-out: the blitted cells (RAM) plus HL (advanced 0x100 per sprite), DE (past the id list) and
// C (= 0). The oracle push/pops through the stack scratch below the entry SP; the module keeps its walk in
// locals. Run: node --test games/invaders/idiomatic/test/equivalence-191a.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_191a as oracle } from "../../translated/loc_191a.js";
import { loc_191a } from "../loc_191a.js";
import { drawSpriteList } from "../drawSpriteList.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";
import { u16 } from "../../../../core/int.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x191a;
const CALLER_RET = 0xabcd;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1500) : [];

test("CAPTURE: real 0x191a dispatches -- loc_191a == oracle in RAM (-stack), HL, DE and C", () => {
  for (const cap of CAPS) {
    const sp = cap.regs.sp; // the oracle's driver push residue sits just below the entry SP
    const capDiff = (ma, mb) => firstStateDiff(ma.dumpState(), mb.dumpState(),
      (off) => ma.stateOffsetToAddr(off), (a) => a != null && a >= sp - 0x10 && a < sp);
    const o = cap.clone(), c = cap.clone();
    o.io.setInte(false); c.io.setInte(false);
    oracle(o); loc_191a(c);
    assert.equal(capDiff(o, c), null);
    assert.equal(c.regs.hl, o.regs.hl, "HL live-out matches the oracle");
    assert.equal(c.regs.de, o.regs.de, "DE walked past the id list matches the oracle");
    assert.equal(c.regs.c, o.regs.c, "C drained to 0 matches the oracle");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Seat a fresh Machine with a caller return on the stack; loc_191a supplies its own count/source/slot.
function seat(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); m.io.setInte(false); }

test("CRAFTED: the preset 0x1c-sprite list is blitted; HL += 0x1c00, DE past the list, C := 0", () => {
  const o = new Machine(ROM); seat(o);
  const c = new Machine(ROM); seat(c);
  oracle(o); loc_191a(c);

  assert.equal(ramDiff(o, c), null, "oracle and module leave identical RAM (-stack)");
  assert.equal(c.regs.hl, u16(0x241e + 0x100 * 0x1c), "HL advanced 0x100 per sprite");
  assert.equal(c.regs.hl, o.regs.hl, "HL matches the oracle");
  assert.equal(c.regs.de, u16(0x1ae4 + 0x1c), "DE walked past the id list");
  assert.equal(c.regs.de, o.regs.de, "DE matches the oracle");
  assert.equal(c.regs.c, 0, "C drained to 0");
  assert.equal(c.regs.c, o.regs.c, "C matches the oracle");
});

test("TEETH: a twin that seats the wrong screen slot blits to the wrong place and is caught", () => {
  // Broken twin of loc_191a: real delegation, one mutated constant -- the screen slot is shifted a column.
  const loc_191a_broken = (m) => drawSpriteList(m, 0x1ae4, 0x1c, (0x241e + 0x20) & 0xffff);
  const o = new Machine(ROM); seat(o);
  const c = new Machine(ROM); seat(c);
  oracle(o); loc_191a_broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch a shifted screen slot");
});

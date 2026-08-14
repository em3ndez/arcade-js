// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter + mutation test for loc_02a3 (Frogger COLD-BOOT init, ROM 0x02A3-0x0340; entered from
// reset with SP=0x8800). Clears latches + work RAM + OBJRAM, seeds boot state from the dips,
// delays, enables the NMI, clears the screen, programs both i8255 PPIs (0x9B/0x88), primes the
// sound, and tail-delegates to the main loop 0x0341. Callees stubbed as balanced pop-returns;
// 50,754 T of its own instructions.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_02a3 } from "../loc_02a3.js";

function mk() {
  const routines = new Map();
  for (const a of [0x1048, 0x0038, 0x0794]) routines.set(a, (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  routines.set(0x0341, () => "TAIL"); // main-loop delegation sentinel
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.af = 0x0040; m.regs.sp = 0x8800; // entry state left by the reset vector
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

function collect(m, ret) {
  return {
    cycles: m.cycles, calls: m.calls, ret, sp: m.regs.sp,
    irq: m.io.irqEnable, flipX: m.io.flipX, flipY: m.io.flipY,
    ppi0: m.io.ppi0.control, ppi1: m.io.ppi1.control,
    unmapped: m.mem.unmappedWrites,
    r: (a) => m.mem.workRam[a - 0x8000],
    ramCleared: [...m.mem.workRam.subarray(0x000, 0x300)].every((b) => b === 0), // 0x8000-0x82FF clean
    objCleared: [...m.mem.objRam.subarray(0x04)].every((b) => b === 0), // 0xB004..0xB0FF clean
  };
}

function checkSpec(res) {
  assert.equal(res.cycles, 50754, "T-state total of loc_02a3's own instructions");
  assert.deepEqual(res.calls, [0x1048, 0x0038, 0x0794, 0x0794, 0x0341],
    "delay, screen-clear (rst 38), 2 sound primes, then tail-delegate to the main loop");
  assert.equal(res.ret, "TAIL", "falls through into 0x0341 via `return m.call` (tail delegation)");
  assert.equal(res.sp, 0x8800, "every call push balanced (SP back to the reset top)");
  assert.equal(res.irq, 1, "NMI enabled (0xB808 D0=1) at the end of init");
  assert.equal(res.flipX, 0, "flip_x cleared");
  assert.equal(res.flipY, 0, "flip_y cleared");
  assert.equal(res.ppi0, 0x9b, "PPI0 control = 0x9B (mode0, all ports input)");
  assert.equal(res.ppi1, 0x88, "PPI1 control = 0x88 (A/B outputs for sound)");
  assert.equal(res.unmapped, 1, "the one dropped 0x8805 watchdog-region write");
  assert.equal(res.ramCleared, true, "work RAM 0x8000-0x82FF zeroed");
  assert.equal(res.objCleared, true, "OBJRAM 0xB004-0xB0FF zeroed");
  assert.equal(res.r(0x8370), 0x01, "0x8370 = 1");
  assert.equal(res.r(0x8381), 0x15, "0x8381 = 0x15");
  assert.equal(res.r(0x83c7), 0x00, "0x83c7 low byte of 0x0100");
  assert.equal(res.r(0x83c8), 0x01, "0x83c8 high byte of 0x0100");
  assert.equal(res.r(0x83d9), 0x08, "0x83d9 = 0x18 & 0xEF (unmuted)");
}

test("loc_02a3: cold-boot init programs the PPIs, enables NMI, delegates to 0x0341; 50,754 T", () => {
  const m = mk();
  const ret = loc_02a3(m);
  checkSpec(collect(m, ret));
});

// MUTATION-PATCH  file: games/frogger/translated/loc_02a3.js
//   find: mem.write8(regs.hl, 0x9b, 7);
//   repl: mem.write8(regs.hl, 0x9a, 7);
//   expect: FAIL  (PPI0 programmed with the wrong control word -> ppi0.control != 0x9B)
//   verified-anchor: count == 1  (the sole PPI0 control write in loc_02a3.js)
test("loc_02a3: the contract catches a wrong PPI0 control word", () => {
  // Proxy for the source edit: corrupt the 0xE006 (PPI0 control) write value 0x9B->0x9A.
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, bo) => ow(a, a === 0xe006 && v === 0x9b ? 0x9a : v, bo);
  const ret = loc_02a3(m);
  assert.throws(() => checkSpec(collect(m, ret)), /PPI0 control/);
});

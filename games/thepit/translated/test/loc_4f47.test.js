// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4f47 (ROM 0x4f47-0x4f86, The Pit): a colour-cycle screen
// effect gated on two bits of the mode byte 0x8018. It sets (0x8001)=0x09, calls
// loc_4b44, reads (0x8018) and -- unless BOTH bit 3 AND bit 4 are set -- bails via a
// tail-jump to loc_4b55. When both are set it runs a 128-pass flood: each pass floods
// VIDEO RAM 0x9000-0x93FF with the running index pattern 0,1,..,0xFF (C wraps every
// 256 bytes) and COLOUR RAM 0x8800-0x8BFF with the pass value A (4 blocks of 256 via
// B=4 djnz = 1024 bytes), calls 0x4bff (A=0x78), reloads the pass value from 0x8012,
// `inc a`, and loops while non-zero. A runs 0x80..0xFF (128 passes); on the 0xFF pass
// `inc a` wraps to 0 and it tail-jumps into loc_03ac. Every exit is a TAIL-jump, so
// loc_4f47 has NO ret of its own.
//
// Three paths are pinned against the disassembly:
//   * BAIL-3  (0x8018 bit3 clear): bit 3,a -> jp z TAKEN -> tail loc_4b55        = 68 T
//   * BAIL-4  (0x8018 bit3 set, bit4 clear): first jp z not taken, second TAKEN  = 86 T
//   * FLOOD   (0x8018 = 0x18, both set): full 128-pass flood -> tail loc_03ac    (formula)
// The two BAIL paths assert the exact step trace / call+push lists; the FLOOD path
// asserts an INDEPENDENTLY-COMPUTED cycle total + step count (from the loop trip
// counts, not by re-running the routine) plus the video/colour RAM contents, the final
// registers, and the full control-flow shape (131 calls, 130 pushes, tail to 0x03ac).
//
// The mocked `call` records the target WITHOUT running the callee (its cycles are the
// callee's), so all totals are loc_4f47-local -- and it proves the routine reloads A
// from (0x8018)/(0x8012) rather than depending on leftover callee state.
//
// TEETH: a faithful twin whose ONLY break is the VRAM source `ld (hl),c` -> `ld (hl),a`
// (0x71 -> 0x77; both 7 T, control flow unchanged). Cycle-IDENTICAL on the FLOOD path,
// so only the VRAM-content contract can reject it -- the mutant floods VRAM with the
// colour value (0xFF) instead of the 0,1,2,.. index pattern.
//
// Run: node --test games/thepit/translated/test/loc_4f47.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace, ROM_END } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4f47 } from "../loc_4f47.js";

const CALL_4B44 = 0x4b44;
const CALL_4BFF = 0x4bff;
const TAIL_4B55 = 0x4b55; // the bail-out tail-jump target
const TAIL_03AC = 0x03ac; // the flood-complete tail-jump target

// Real Regs (genuine bit/inc8/djnz flag model) + real thepit AddressSpace (so the
// video/colour RAM writes and the 0x8018/0x8012/0x8001 work-RAM accesses behave
// exactly). step/call/ret/push16 are recorders; `call` does NOT run the callee.
function makeMachine({ gate = 0x18, recordSteps = true } = {}) {
  const rom = new Uint8Array(ROM_END + 1); // 20KB, all zero -- the routine reads no ROM
  const mem = new AddressSpace(rom, new Io());
  mem.write8(0x8018, gate & 0xff); // the gate byte read at 0x4f4f
  const regs = new Regs();
  const m = {
    regs,
    mem,
    cycles: 0,
    stepCount: 0,
    lastStep: 0x4f47,
    steps: recordSteps ? [] : null,
    calls: [],
    pushes: [],
    returned: false,
    step(addr, c) {
      this.cycles += c;
      this.stepCount++;
      this.lastStep = addr;
      if (this.steps !== null) this.steps.push(addr);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee not run -- keeps totals loc_4f47-local
    },
    push16(v) {
      this.pushes.push(v);
    },
    ret(c = 10) {
      this.cycles += c;
      this.returned = true;
    },
  };
  return m;
}

// ---------------------------------------------------------------------------
// BAIL-3: bit 3 of (0x8018) is clear -> first `jp z,0x4b55` taken.
// ---------------------------------------------------------------------------
const BAIL3_STEPS = [0x4f49, 0x4f4c, 0x4b44, 0x4f52, 0x4f54, 0x4b55];
const BAIL3_CYCLES = 7 + 13 + 17 + 13 + 8 + 10; // = 68

test("bail-3: (0x8018) bit3 clear -> tail-jump loc_4b55 (68 T), (0x8001)=9 already set", () => {
  const m = makeMachine({ gate: 0x00 });
  loc_4f47(m);
  assert.deepEqual(m.steps, BAIL3_STEPS, "step targets");
  assert.deepEqual(m.calls, [CALL_4B44, TAIL_4B55], "call targets (incl the tail-jump)");
  assert.deepEqual(m.pushes, [0x4f4f], "only call 0x4b44 pushes a return address");
  assert.equal(m.returned, false, "tail-jump exit: loc_4f47 issues NO ret of its own");
  assert.equal(m.cycles, BAIL3_CYCLES, "T-state total");
  assert.equal(m.cycles, 68, "bail-3 is 68 T");
  assert.equal(m.mem.read8(0x8001), 0x09, "(0x8001) set to 9 before the gate");
  assert.equal(m.lastStep, TAIL_4B55, "final step lands on the tail-jump target");
  console.log("  loc_4f47 bail-3: 68 T, tail loc_4b55, calls [0x4b44,0x4b55]");
});

// ---------------------------------------------------------------------------
// BAIL-4: bit 3 set, bit 4 clear -> first jp z NOT taken, second `jp z,0x4b55` taken.
// ---------------------------------------------------------------------------
const BAIL4_STEPS = [0x4f49, 0x4f4c, 0x4b44, 0x4f52, 0x4f54, 0x4f57, 0x4f59, 0x4b55];
const BAIL4_CYCLES = 7 + 13 + 17 + 13 + 8 + 10 + 8 + 10; // = 86

test("bail-4: (0x8018) bit3 set, bit4 clear -> second jp z tail-jumps loc_4b55 (86 T)", () => {
  const m = makeMachine({ gate: 0x08 });
  loc_4f47(m);
  assert.deepEqual(m.steps, BAIL4_STEPS, "step targets");
  assert.deepEqual(m.calls, [CALL_4B44, TAIL_4B55], "call targets");
  assert.deepEqual(m.pushes, [0x4f4f], "pushes");
  assert.equal(m.returned, false, "still a tail-jump exit");
  assert.equal(m.cycles, BAIL4_CYCLES, "T-state total");
  assert.equal(m.cycles, 86, "bail-4 is 86 T");
});

// A single set bit is NOT enough -- the gate needs bit3 AND bit4. bit4-only bails at
// the FIRST jp z (bit3 clear), like bail-3.
test("gate: bit4 set but bit3 clear still bails at the first jp z (68 T)", () => {
  const m = makeMachine({ gate: 0x10 });
  loc_4f47(m);
  assert.deepEqual(m.calls, [CALL_4B44, TAIL_4B55], "bails to loc_4b55");
  assert.equal(m.cycles, 68, "took the first-jp-z path (bit3 clear)");
});

// ---------------------------------------------------------------------------
// FLOOD: both bits set -> the full 128-pass flood, then tail-jump loc_03ac.
// Cycle total derived INDEPENDENTLY from the loop trip counts (not by re-running).
// ---------------------------------------------------------------------------
// inner C sweep: 256 iters, body (excl jr) = 7+7+6+6+4 = 30; jr nz 255x12 + 1x7
const CSWEEP = 256 * 30 + 255 * 12 + 7; // = 10747
// djnz block loop: 4 sweeps; djnz 3x13 (taken) + 1x8 (not)
const FILL = 4 * CSWEEP + 3 * 13 + 8; // = 43035
// one outer pass, excluding its own jr nz: setup 47 + FILL + tail 41
const PASS_SETUP = 13 + 7 + 7 + 10 + 10; // = 47
const PASS_TAIL = 7 + 17 + 13 + 4; // = 41  (ld a,0x78; call; ld a,(0x8012); inc a)
const PASS = PASS_SETUP + FILL + PASS_TAIL; // = 43123
// outer loop: 128 passes; jr nz 127x12 (taken) + 1x7 (not)
const OUTER = 128 * PASS + 127 * 12 + 7; // = 5521275
const PROLOGUE = 7 + 13 + 17 + 13 + 8 + 10 + 8 + 10 + 7 + 17 + 7; // = 117
const FLOOD_CYCLES = PROLOGUE + OUTER + 10; // + final jp 0x03ac = 5521402

// step count: prologue 11 ; per pass 5 setup + (4*256*6 + 4 djnz) + 5 tail = 6158 ; 128
// passes + 1 final jp
const FLOOD_STEPS = 11 + 128 * (5 + (4 * 256 * 6 + 4) + 5) + 1; // = 788236

test("flood: both gate bits set runs 128 passes then tail-jumps loc_03ac", () => {
  assert.equal(CSWEEP, 10747);
  assert.equal(FILL, 43035);
  assert.equal(PASS, 43123);
  assert.equal(FLOOD_CYCLES, 5521402, "independent cycle formula");
  assert.equal(FLOOD_STEPS, 788236, "independent step-count formula");

  const m = makeMachine({ gate: 0x18, recordSteps: false });
  loc_4f47(m);

  // -- timing / control flow ----------------------------------------------
  assert.equal(m.cycles, FLOOD_CYCLES, "T-state total matches the trip-count formula");
  assert.equal(m.stepCount, FLOOD_STEPS, "instruction count matches the trip-count formula");
  assert.equal(m.returned, false, "tail-jump exit: no ret");
  assert.equal(m.lastStep, TAIL_03AC, "final step lands on loc_03ac");
  assert.equal(m.calls.length, 131, "1x4b44 + 129x4bff + 1x03ac");
  assert.equal(m.calls[0], CALL_4B44, "first call is loc_4b44");
  assert.equal(m.calls[m.calls.length - 1], TAIL_03AC, "last transfer is the loc_03ac tail-jump");
  assert.equal(m.calls.filter((a) => a === CALL_4BFF).length, 129, "1 (A=0x01) + 128 (A=0x78)");
  assert.equal(m.pushes.length, 130, "0x4f4f + 0x4f61 + 128x 0x4f7e");
  assert.equal(m.pushes.filter((a) => a === 0x4f7e).length, 128, "one 0x4bff-return per pass");

  // -- final registers -----------------------------------------------------
  assert.equal(m.regs.a, 0x00, "A wrapped 0xFF->0x00 on the last pass's inc a");
  assert.equal(m.regs.b, 0x00, "B drained by the last djnz");
  assert.equal(m.regs.c, 0x00, "C wrapped back to 0x00");

  // -- work RAM ------------------------------------------------------------
  assert.equal(m.mem.read8(0x8001), 0x09, "(0x8001) = mode 9");
  assert.equal(m.mem.read8(0x8012), 0xff, "(0x8012) = 0xFF (last pass value)");

  // -- VIDEO RAM: the 0,1,..,0xFF running-index pattern (offset & 0xff) -----
  assert.equal(m.mem.read8(0x9000), 0x00, "VRAM[0] = 0");
  assert.equal(m.mem.read8(0x9001), 0x01, "VRAM[1] = 1");
  assert.equal(m.mem.read8(0x90ff), 0xff, "VRAM[0xFF] = 0xFF");
  assert.equal(m.mem.read8(0x9100), 0x00, "VRAM[0x100] wraps to 0");
  assert.equal(m.mem.read8(0x93ff), 0xff, "VRAM[0x3FF] = 0xFF (last byte)");

  // -- COLOUR RAM: flooded with the final pass value 0xFF ------------------
  assert.equal(m.mem.read8(0x8800), 0xff, "colour[0] = 0xFF");
  assert.equal(m.mem.read8(0x8a00), 0xff, "colour[mid] = 0xFF");
  assert.equal(m.mem.read8(0x8bff), 0xff, "colour[last] = 0xFF");

  console.log(`  loc_4f47 flood: ${FLOOD_CYCLES} T, ${FLOOD_STEPS} steps, 128 passes, tail loc_03ac`);
});

// ---------------------------------------------------------------------------
// TEETH: `ld (hl),c` (0x71) -> `ld (hl),a` (0x77). Both 7 T, control flow unchanged,
// so cycle/step totals are IDENTICAL on the flood path -- only the VRAM contents differ.
// The mutant floods VRAM with the colour value A (0xFF at the end) instead of the
// running index, so VRAM[1] is 0xFF, not 0x01.
// ---------------------------------------------------------------------------
function loc_4f47_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x09; m.step(0x4f49, 7);
  mem.write8(0x8001, regs.a); m.step(0x4f4c, 13);
  m.push16(0x4f4f); m.step(0x4b44, 17); m.call(0x4b44);
  regs.a = mem.read8(0x8018); m.step(0x4f52, 13);
  regs.bit(3, regs.a); m.step(0x4f54, 8);
  if (regs.fZ) { m.step(0x4b55, 10); return m.call(0x4b55); }
  m.step(0x4f57, 10);
  regs.bit(4, regs.a); m.step(0x4f59, 8);
  if (regs.fZ) { m.step(0x4b55, 10); return m.call(0x4b55); }
  m.step(0x4f5c, 10);
  regs.a = 0x01; m.step(0x4f5e, 7);
  m.push16(0x4f61); m.step(0x4bff, 17); m.call(0x4bff);
  regs.a = 0x80; m.step(0x4f63, 7);
  for (;;) {
    mem.write8(0x8012, regs.a); m.step(0x4f66, 13);
    regs.b = 0x04; m.step(0x4f68, 7);
    regs.c = 0x00; m.step(0x4f6a, 7);
    regs.hl = 0x9000; m.step(0x4f6d, 10);
    regs.de = 0x8800; m.step(0x4f70, 10);
    for (;;) {
      mem.write8(regs.hl, regs.a); m.step(0x4f71, 7); // BUG: ld (hl),c -> ld (hl),a
      mem.write8(regs.de, regs.a); m.step(0x4f72, 7);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x4f73, 6);
      regs.de = (regs.de + 1) & 0xffff; m.step(0x4f74, 6);
      regs.c = regs.inc8(regs.c); m.step(0x4f75, 4);
      if (regs.fNZ) { m.step(0x4f70, 12); continue; }
      m.step(0x4f77, 7);
      if (regs.djnz() !== 0) { m.step(0x4f70, 13); continue; }
      m.step(0x4f79, 8); break;
    }
    regs.a = 0x78; m.step(0x4f7b, 7);
    m.push16(0x4f7e); m.step(0x4bff, 17); m.call(0x4bff);
    regs.a = mem.read8(0x8012); m.step(0x4f81, 13);
    regs.a = regs.inc8(regs.a); m.step(0x4f82, 4);
    if (regs.fNZ) { m.step(0x4f63, 12); continue; }
    m.step(0x4f84, 7); break;
  }
  m.step(0x03ac, 10); return m.call(0x03ac);
}

test("TEETH: ld (hl),c -> ld (hl),a is cycle-identical but caught by the VRAM contract", () => {
  // The real routine floods VRAM with the running index.
  {
    const good = makeMachine({ gate: 0x18, recordSteps: false });
    loc_4f47(good);
    assert.equal(good.mem.read8(0x9001), 0x01, "real: VRAM[1] = 1 (index pattern)");
  }
  const m = makeMachine({ gate: 0x18, recordSteps: false });
  loc_4f47_mutant(m);
  assert.equal(m.cycles, FLOOD_CYCLES, "mutation preserves the T-state total (cycles can't catch it)");
  assert.equal(m.stepCount, FLOOD_STEPS, "mutation preserves the step count too");
  // Only a VRAM-content assertion rejects the mutant.
  assert.equal(m.mem.read8(0x9001), 0xff, "mutant: VRAM[1] = 0xFF (colour value, not the index)");
  assert.throws(
    () => assert.equal(m.mem.read8(0x9001), 0x01, "VRAM[1] = 1"),
    /VRAM\[1\] = 1/,
    "a cycle-only test would MISS this -- the video-content contract is what has teeth",
  );
});

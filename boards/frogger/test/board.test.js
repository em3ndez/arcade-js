// SPDX-License-Identifier: GPL-3.0-only
/**
 * Frogger board-hardware tests (NEW Galaxian/Scramble-family board, no ROM needed).
 *
 * Subject: boards/frogger/{memory,io}.js -- the frogger_map decode (regions / mirror MASKS /
 * unmap_value_high=0xFF / watchdog / standalone D0 latches), the two-8255 PPI window decode
 * (A13->PPI0, A12->PPI1, port=(off>>1)&3), and the i8255 mode-0 direction/routing model that is
 * the #1 boot-killer. Pure logic, validated against galaxian.cpp / i8255.cpp before any ROM boots.
 * Run: node --test boards/frogger/test/board.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AddressSpace, UnmappedAccess, STATE_DUMP_SIZE, ROM_END,
  WORK_RAM_BASE, VIDEO_RAM_BASE, OBJ_RAM_BASE, WORK_RAM_SIZE, VIDEO_RAM_SIZE, OBJ_RAM_SIZE,
} from "../memory.js";
import {
  Io, I8255, CONTROL_RESET, NotImplemented,
  IDLE_IN0, IDLE_IN1, IDLE_IN2, IDLE_IN3, PORT_IN0, PORT_IN1, PORT_IN2,
} from "../io.js";

const rom = () => new Uint8Array(ROM_END + 1); // 16KB dummy program (0x0000-0x3FFF)
const space = (io = new Io()) => new AddressSpace(rom(), io);

/* ------------------------------------------------------------------ memory: sizes + state layout */

test("ROM must be exactly 16KB (0x0000-0x3FFF window)", () => {
  assert.equal(ROM_END, 0x3fff);
  assert.throws(() => new AddressSpace(new Uint8Array(0x3000), new Io()), /16384-byte ROM/);
  assert.doesNotThrow(() => new AddressSpace(new Uint8Array(0x4000), new Io()));
});

test("state dump is 3328 bytes: work 2048 + video 1024 + objram 256", () => {
  assert.equal(STATE_DUMP_SIZE, WORK_RAM_SIZE + VIDEO_RAM_SIZE + OBJ_RAM_SIZE);
  assert.equal(STATE_DUMP_SIZE, 3328);
  assert.equal(space().dumpState().length, 3328);
});

test("dumpState / stateOffsetToAddr are inverse across every region boundary", () => {
  const m = space();
  const checks = [
    [0, WORK_RAM_BASE], [2047, WORK_RAM_BASE + 2047],
    [2048, VIDEO_RAM_BASE], [3071, VIDEO_RAM_BASE + 1023],
    [3072, OBJ_RAM_BASE], [3327, OBJ_RAM_BASE + 255],
  ];
  for (const [off, addr] of checks) assert.equal(m.stateOffsetToAddr(off), addr, `offset ${off}`);
});

test("RAM read/write round-trips at real addresses; state lives where it lives", () => {
  const m = space();
  m.write8(0x8000, 0x11); // work
  m.write8(0xa800, 0x22); // video
  m.write8(0xb000, 0x33); // objram
  assert.equal(m.read8(0x8000), 0x11);
  assert.equal(m.read8(0xa800), 0x22);
  assert.equal(m.read8(0xb000), 0x33);
  assert.equal(m.workRam[0], 0x11);
  assert.equal(m.videoRam[0], 0x22);
  assert.equal(m.objRam[0], 0x33);
  const dump = m.dumpState();
  assert.equal(dump[0], 0x11);
  assert.equal(dump[WORK_RAM_SIZE], 0x22);
  assert.equal(dump[WORK_RAM_SIZE + VIDEO_RAM_SIZE], 0x33);
});

/* ---------------------------------------------------------------- memory: mirror MASK decoding */

test("VIDEORAM mirror 0x0400 is a don't-care bit: 0xA800 and 0xAC00 are the same cell", () => {
  const m = space();
  m.write8(0xa800, 0x5a);
  assert.equal(m.read8(0xac00), 0x5a, "0xAC00 mirrors videoram[0]");
  m.write8(0xabff, 0x7e);
  assert.equal(m.videoRam[0x3ff], 0x7e);
  m.write8(0xaffe, 0x33); // (0xAFFE & 0x3FF) = 0x3FE
  assert.equal(m.videoRam[0x3fe], 0x33, "high mirror bit 0x0400 folds");
});

test("OBJRAM mirror 0x0700 folds 0xB000-0xB7FF onto 256 bytes; latches live above at 0xB800", () => {
  const m = space();
  m.write8(0xb000, 0xa0);
  m.write8(0xb0ff, 0xb0);
  assert.equal(m.objRam[0], 0xa0);
  assert.equal(m.objRam[0xff], 0xb0);
  // mirror bits 0x0700 are don't-care: 0xB100/0xB400/0xB700 all fold to objram[0].
  m.write8(0xb700, 0xc0);
  assert.equal(m.objRam[0], 0xc0, "0xB700 mirrors objram[0]");
  // 0xB800+ is NOT objram (it is the latch page); a write there does not touch objram.
  m.write8(0xb800, 0xee);
  assert.equal(m.objRam[0], 0xc0, "0xB800 is not objram");
});

test("watchdog: 0x8800 (mirror 0x07FF) READS return 0xFF and pet the dog", () => {
  const m = space();
  assert.equal(m.read8(0x8800), 0xff, "reset_r returns unmap_value_high");
  assert.equal(m.watchdogReads, 1);
  assert.equal(m.read8(0x8fff), 0xff, "0x8FFF mirrors the watchdog");
  assert.equal(m.watchdogReads, 2);
  // a WRITE to 0x8800 is not a device (watchdog is read-only here) -> dropped + counted.
  m.write8(0x8800, 0x00);
  assert.equal(m.unmappedWrites, 1);
});

test("★ unmapped reads FLOAT HIGH (0xFF), they do NOT throw (unmap_value_high)", () => {
  const m = space();
  assert.equal(m.read8(0x4000), 0xff, "gap below RAM");
  assert.equal(m.read8(0x9000), 0xff, "gap between watchdog and VRAM");
  assert.equal(m.read8(0xa000), 0xff, "gap below VRAM");
  assert.equal(m.read8(0xb800), 0xff, "latch page reads float high (write-only latches)");
});

test("write to ROM throws; other unmapped writes are dropped + counted", () => {
  const m = space();
  assert.throws(() => m.write8(0x0000, 0x00), UnmappedAccess, "write to ROM throws");
  assert.throws(() => m.write8(0x3fff, 0x00), UnmappedAccess);
  m.write8(0x9000, 0x00); // gap -> dropped
  m.write8(0xb804, 0x00); // 0xB800 page non-latch -> dropped
  assert.equal(m.unmappedWrites, 2);
});

/* --------------------------------------------------------------- memory: standalone D0 latches */

test("standalone latches decode via mask 0xF81C (mirror 0x07E3) to the five D0 registers", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0xb808, 0x01); assert.equal(io.irqEnable, 1, "0xB808 -> irq_enable");
  m.write8(0xb80c, 0x01); assert.equal(io.flipY, 1, "0xB80C -> flip_y");
  m.write8(0xb810, 0x01); assert.equal(io.flipX, 1, "0xB810 -> flip_x");
  m.write8(0xb818, 0x01); assert.equal(io.coinCounters[0], 1, "0xB818 -> coin0");
  m.write8(0xb81c, 0x01); assert.equal(io.coinCounters[1], 1, "0xB81C -> coin1");
});

test("latches are D0-only and honour the mirror don't-care bits", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0xb808, 0xfe); assert.equal(io.irqEnable, 0, "even value -> D0=0 clears NMI enable");
  m.write8(0xb808, 0xff); assert.equal(io.irqEnable, 1, "odd value -> D0=1");
  // mirror: 0xBCE8 has the same (addr & 0xF81C) == 0xB808 signature as 0xB808.
  assert.equal(0xbce8 & 0xf81c, 0xb808);
  m.write8(0xbce8, 0x00); assert.equal(io.irqEnable, 0, "0xBCE8 mirrors irq_enable");
  // 0xB814 matches NO latch (bit pattern 0x14) -> unmapped drop, not a latch.
  const before = m.unmappedWrites;
  m.write8(0xb814, 0x01);
  assert.equal(m.unmappedWrites, before + 1, "0xB814 is unmapped");
});

test("isHardwareWrite: PPI window + standalone latches only (not RAM/VRAM/OBJRAM/ROM)", () => {
  assert.equal(AddressSpace.isHardwareWrite(0xb808), true, "irq latch");
  assert.equal(AddressSpace.isHardwareWrite(0xb81c), true, "coin1 latch");
  assert.equal(AddressSpace.isHardwareWrite(0xd000), true, "PPI sound latch");
  assert.equal(AddressSpace.isHardwareWrite(0xe000), true, "PPI window (input side)");
  assert.equal(AddressSpace.isHardwareWrite(0x8000), false, "work RAM");
  assert.equal(AddressSpace.isHardwareWrite(0xa800), false, "VRAM");
  assert.equal(AddressSpace.isHardwareWrite(0xb000), false, "OBJRAM");
  assert.equal(AddressSpace.isHardwareWrite(0x0000), false, "ROM");
});

test("writeTrace records hardware writes (latches + PPI) with bus-cycle offset", () => {
  const io = new Io();
  const m = space(io);
  m.writeTrace = [];
  m.clock = () => 1000;
  m.write8(0xb808, 0x01, 10); // latch, ld (nn),a offset
  m.write8(0x8000, 0x22, 10); // RAM -> NOT traced
  m.write8(0xd000, 0x5a, 10); // PPI window
  assert.deepEqual(m.writeTrace.map((w) => w.addr), [0xb808, 0xd000]);
  assert.equal(m.writeTrace[0].cycle, 1010);
});

/* --------------------------------------------------- the i8255 device model (io.js, standalone) */

test("i8255 resets to control 0x9B (mode 0, all ports INPUT); read(CONTROL) returns it", () => {
  const p = new I8255();
  assert.equal(p.control, CONTROL_RESET);
  assert.equal(p.control, 0x9b);
  assert.equal(p.read(3), 0x9b);
  assert.ok(p.portAIsInput() && p.portBIsInput() && p.portCUpperIsInput() && p.portCLowerIsInput());
});

test("i8255 mode 0: input ports read the pin callback; the control word sets direction", () => {
  const pins = [0xa0, 0xb1, 0xc2];
  const p = new I8255({ readPort: (port) => pins[port] });
  // at reset all input -> reads return pins
  assert.equal(p.read(0), 0xa0);
  assert.equal(p.read(1), 0xb1);
  assert.equal(p.read(2), 0xc2);
  // program A + B as OUTPUT, C input: control = 0x80|C_upper_in(0x08)|C_lower_in(0x01) = 0x89
  p.write(3, 0x89);
  assert.ok(!p.portAIsInput() && !p.portBIsInput(), "A,B now output");
  assert.ok(p.portCUpperIsInput() && p.portCLowerIsInput(), "C still input");
});

test("i8255 mode 0: OUTPUT ports latch+fire on write and read back the latch; INPUT-port writes drop", () => {
  const fired = [];
  const p = new I8255({ readPort: () => 0xff, writePort: (port, v) => fired.push([port, v]) });
  p.write(3, 0x89); // A,B output, C input. set_mode fires A=0,B=0,C=0.
  fired.length = 0;
  p.write(0, 0x5a); // A output -> latch + fire
  assert.equal(p.read(0), 0x5a, "output A reads back its latch, not the pin");
  p.write(1, 0x3c);
  assert.equal(p.read(1), 0x3c);
  assert.deepEqual(fired, [[0, 0x5a], [1, 0x3c]]);
  // Now make A an INPUT and write it: the write is dropped (no latch change, no fire).
  p.write(3, 0x99); // 0x80 | A_in(0x10) | C_upper(0x08) | C_lower(0x01) = 0x99 -> A input, B output
  fired.length = 0;
  p.write(0, 0xee); // A input -> dropped
  assert.equal(p.read(0), 0xff, "A input reads the pin (0xFF), not the dropped write");
  assert.deepEqual(fired, [], "no output fired for an input-port write");
});

test("i8255 set_mode CLEARS output latches and fires now-OUTPUT ports with 0", () => {
  const fired = [];
  const p = new I8255({ readPort: () => 0, writePort: (port, v) => fired.push([port, v]) });
  p.write(3, 0x89); // A,B output, C input
  // set_mode fires A=0, B=0, and output_pc for C=0.
  assert.deepEqual(fired, [[0, 0], [1, 0], [2, 0]]);
  p.write(0, 0x77);
  assert.equal(p.output[0], 0x77);
  fired.length = 0;
  p.write(3, 0x89); // reprogram -> latches cleared again
  assert.equal(p.output[0], 0, "output latch cleared by set_mode");
});

test("i8255 port C read mixes per NIBBLE by direction; bit set/reset (control bit7=0) drives C", () => {
  // control 0x88 = 0x80 | C_upper_in(0x08): C upper INPUT, C lower OUTPUT; A,B output.
  const p = new I8255({ readPort: (port) => (port === 2 ? 0xa5 : 0), writePort: () => {} });
  p.write(3, 0x88);
  p.write(2, 0x0f); // store to C output latch
  // upper nibble = pin (0xa5 & 0xf0 = 0xa0); lower nibble = latch (0x0f & 0x0f = 0x0f)
  assert.equal(p.read(2), 0xa0 | 0x0f, "C read: upper from pin, lower from latch");
  // BSR: set bit 1 of port C (data = 0x03 -> bit=(3>>1)&7=1, state=1)
  p.write(3, 0x03);
  assert.equal(p.output[2] & 0x02, 0x02, "BSR set C bit1");
  p.write(3, 0x02); // reset bit1 (state 0)
  assert.equal(p.output[2] & 0x02, 0, "BSR reset C bit1");
});

/* -------------------------------------------- the PPI WINDOW decode through the memory bus (io+mem) */

test("★ PPI window: IN0=0xE000, IN1=0xE002, IN2=0xE004 (PPI0 via A13); IN3=0xD004 (PPI1.C via A12)", () => {
  const io = new Io();
  io.in0 = 0xa0; io.in1 = 0xa1; io.in2 = 0xa2; io.in3 = 0x00;
  const m = space(io);
  assert.equal(m.read8(0xe000), 0xa0, "IN0 = PPI0.A");
  assert.equal(m.read8(0xe002), 0xa1, "IN1 = PPI0.B");
  assert.equal(m.read8(0xe004), 0xa2, "IN2 = PPI0.C");
  assert.equal(m.read8(0xd004), 0x00, "IN3 = PPI1.C");
});

test("PPI window: (off>>1)&3 selects the port; A13 picks PPI0, A12 picks PPI1", () => {
  const io = new Io();
  io.in0 = 0x11; io.in1 = 0x22; io.in2 = 0x33;
  const m = space(io);
  // 0xE006 = PPI0 control port (port 3) -> read returns the control word (0x9B at reset).
  assert.equal(m.read8(0xe006), 0x9b, "0xE006 = PPI0 control read");
  // Addressing BOTH at once (A13|A12): result is ANDed. 0xF000 -> port A of both.
  // PPI1.A is input at reset -> pin 0xFF; PPI0.A -> in0. 0xFF & in0 = in0.
  assert.equal(m.read8(0xf000), 0x11 & 0xff, "0xF000 addresses both PPIs, results ANDed");
});

test("★ sound path routes through PPI1 ONLY after directions are programmed (the boot-killer)", () => {
  const io = new Io();
  const m = space(io);
  // Before programming: PPI1.A is INPUT at reset -> a write to 0xD000 is DROPPED.
  m.write8(0xd000, 0x5a);
  assert.equal(io.soundData, 0, "unprogrammed PPI1.A drops the write (input direction)");

  // Program PPI1: A,B output, C input. Control port = 0xD006.
  m.write8(0xd006, 0x89);
  assert.equal(io.ppi1.control, 0x89);
  // Now the sound command latch routes.
  m.write8(0xd000, 0x5a);
  assert.equal(io.soundData, 0x5a, "PPI1.A -> sound command latch");
  assert.equal(m.read8(0xd000), 0x5a, "output A reads back the latch");
});

test("sound control (PPI1.B, 0xD002): bit-3 FALLING edge triggers audio /INT; bit 4 = mute", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0xd006, 0x89); // A,B output, C input
  assert.equal(io.soundTriggers, 0, "set_mode fired B=0 with old=0 -> no trigger");
  m.write8(0xd002, 0x08); // bit3 high (rising) -> no trigger
  assert.equal(io.soundTriggers, 0);
  m.write8(0xd002, 0x00); // bit3 high->low -> FALLING edge -> trigger
  assert.equal(io.soundTriggers, 1);
  m.write8(0xd002, 0x10); // bit4 set -> mute on (bit3 was 0->0, no trigger)
  assert.equal(io.mute, 1);
  assert.equal(io.soundTriggers, 1);
});

test("onSoundWrite records BOTH the PPI1.A latch (0xD000) and PPI1.B control (0xD002)", () => {
  const io = new Io();
  const m = space(io);
  m.write8(0xd006, 0x89);
  const seen = [];
  io.onSoundWrite = (addr, v) => seen.push([addr, v]);
  m.write8(0xd000, 0x2a);
  m.write8(0xd002, 0x08);
  assert.deepEqual(seen, [[0xd000, 0x2a], [0xd002, 0x08]]);
});

/* ---------------------------------------------------------------------- inputs + latch semantics */

test("nmiMask reflects irq_enable (0xB808 D0); flipX/flipY are DIRECT (not inverted)", () => {
  const io = new Io();
  assert.equal(io.nmiMask, false, "NMI disabled at reset");
  io.setIrqEnable(1);
  assert.equal(io.nmiMask, true);
  io.setIrqEnable(0);
  assert.equal(io.nmiMask, false);
  // galaxian flip is D0 direct: bit 0 -> flipped (unlike konami's inverted latch).
  assert.equal(io.flipScreenX, false, "reset: not flipped");
  io.setFlipX(1); assert.equal(io.flipScreenX, true);
  io.setFlipY(1); assert.equal(io.flipScreenY, true);
});

test("idle input values: IN0=0xFF, IN1=0xFC (Lives dip), IN2=0xF1 (Coinage/Cabinet dip), IN3=0x00", () => {
  assert.equal(IDLE_IN0, 0xff);
  assert.equal(IDLE_IN1, 0xfc, "b0-1 Lives dip default 0x00 (3 lives) clear; rest active-low high");
  assert.equal(IDLE_IN2, 0xf1, "b1-2 Coinage 0x00, b3 Cabinet 0x00 clear; rest high");
  assert.equal(IDLE_IN3, 0x00);
  const io = new Io();
  assert.equal(io.in0, 0xff);
  assert.equal(io.in1, 0xfc);
  assert.equal(io.in2, 0xf1);
});

test("inputs are ACTIVE LOW: a pressed bit clears in the read; unknown port key throws", () => {
  const io = new Io();
  // COIN1 is IN0 bit 7 (0x80). Pressing clears it.
  io.inputAssert = { [PORT_IN0]: 0x80 };
  assert.equal(io.readIn0(), 0xff & ~0x80, "COIN1 pressed reads low");
  io.inputAssert = { [PORT_IN1]: 0x80 }; // START1 is IN1 bit7
  assert.equal(io.readIn1(), 0xfc & ~0x80);
  io.inputAssert = null;
  assert.equal(io.readIn0(), 0xff, "released reads idle high");
  // a key that is not an input port is an error, not a no-op.
  io.inputAssert = { 0xdead: 0x01 };
  assert.throws(() => io.readIn0(), NotImplemented);
});

test("loadStateFrom copies value-state AND both PPI direction/latch words", () => {
  const a = new Io();
  const m = space(a);
  m.write8(0xd006, 0x89); // program PPI1
  m.write8(0xd000, 0x5a); // sound latch
  a.setIrqEnable(1); a.setFlipX(1); a.setCoinCounter(1, 1);
  a.in2 = 0x77;
  const b = new Io();
  b.loadStateFrom(a);
  assert.equal(b.irqEnable, 1);
  assert.equal(b.flipX, 1);
  assert.equal(b.coinCounters[1], 1);
  assert.equal(b.in2, 0x77);
  assert.equal(b.soundData, 0x5a);
  assert.equal(b.ppi1.control, 0x89, "PPI1 direction word copied");
  assert.equal(b.ppi1.output[0], 0x5a, "PPI1.A latch copied");
});

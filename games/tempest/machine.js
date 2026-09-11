// SPDX-License-Identifier: GPL-3.0-only
// Tempest machine — Atari tempest board + MOS 6502. SKELETON (§2): translated/ is empty, so reset()
// dispatches the 6502 reset vector (0xFFFC -> 0xD93F) and the first m.call throws NotImplemented -- the
// boot-gap crawl (§3) worklist. The interrupt is a FREE-RUNNING periodic IRQ at CLOCK_3KHZ/12 = 246.09Hz
// (tempest.cpp:644), i.e. one IRQ every 1512000/246.09 = 6144 CPU cycles (NOT vblank-tied, NOT frame-aligned;
// acked by write 0x5000). There is no vblank NMI and no CPU-polled vblank bit -- the game syncs to drawing
// via the AVG done_r poll (IN0 bit6). The §4 clock-free yield model keys on that poll; nothing runs yet, so
// only the seam wiring + reset dispatch are load-bearing now. Video is the byte-exact vector pipeline
// (boards/tempest/{avg.js,vector-raster.js} via video.js).

import { AddressSpace } from "../../boards/tempest/memory.js";
import { Io, NotImplemented } from "../../boards/tempest/io.js";
import { renderFrameRGB } from "../../boards/tempest/video.js";
import { Regs, F_B, F_U } from "../../core/cpu/6502.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { buildRoutines } from "./routines.js";

export const CYCLES_PER_FRAME = 25200; // 1.512MHz / 60
export const RESET_VECTOR = 0xfffc; // 6502 reset/IRQ vectors live at the top of the 0xF000 ROM reload
export const IRQ_VECTOR = 0xfffe;
export const IRQ_PERIOD = 6144; // CLOCK_3KHZ/12 = 246.09Hz -> 1512000/246.09 = 6144 cycles/IRQ (free-running)

// Assemble the 64K maincpu image MAME builds: program at 0x9000-0xDFFF, then a RELOAD of the last 4K
// (-237, offset 0x4000 of the concat) at 0xF000-0xFFFF for the reset/IRQ vectors (tempest.cpp:704-709).
function assembleMaincpu(maincpu) {
  const img = new Uint8Array(0x10000);
  img.set(maincpu.subarray(0, 0x5000), 0x9000);
  img.set(maincpu.subarray(0x4000, 0x5000), 0xf000);
  return img;
}

export class FramesComplete extends Error {
  constructor() {
    super("frame budget exhausted");
    this.name = "FramesComplete";
  }
}

export class Machine {
  constructor(maincpu, routines, opts = {}) {
    // (maincpu, routinesMap, opts) internally; (maincpu, opts) from the browser worker.
    if (!(routines instanceof Map)) {
      opts = routines || {};
      routines = buildRoutines();
      if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    }
    this.io = new Io({ avgprom: opts.avgprom });
    this.mem = new AddressSpace(assembleMaincpu(maincpu), opts.vectorrom, this.io);
    this.regs = new Regs(); // 6502 post-reset defaults: s=0xfd, I set (core/cpu/6502.js)
    this.routines = routines;
    this.rom = maincpu;
    this.assets = opts;

    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    this.cycles = 0;
    this.pc = 0;
    this.pcKnown = true;
    this.booted = false;
    this.frames = [];
    this.stoppedBy = null;
    this.inputTape = null;
    this.maxFrames = opts.maxFrames ?? Infinity;
    this.maxCycles = opts.maxCycles ?? Infinity;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextIrqCycle = Infinity; // armed by runFrames; Infinity = quiescent (clone / boot-gap crawl)
    this.irqLine = false; // the periodic IRQ line: asserted every IRQ_PERIOD, cleared by wdclr (0x5000)

    this.captureVideo = false;
    this.videoFrames = [];
    this._lastVectorList = null;

    this.io.onAckIrq = () => { this.irqLine = false; }; // wdclr_w -> CLEAR_LINE (tempest.cpp:378)
    this.mem.clock = () => this.cycles;
  }

  static async create(maincpu, opts = {}) {
    const routines = buildRoutines();
    if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    return new Machine(maincpu, routines, opts);
  }

  reset() {
    // PC <- [0xFFFC]. The reset target (0xD93F) is the first routine to translate (§3 boot-gap crawl).
    const target = this.mem.read16(RESET_VECTOR);
    this.step(target, 0);
    this.booted = true;
    return this.call(target);
  }

  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.pcKnown = true;
    this.mem.pc = nextAddr;
    this.tick(cycles);
  }

  tick(n) {
    this.cycles += n;
    // Free-running 246Hz IRQ: assert the line every IRQ_PERIOD cycles, then fire if unmasked. ⚠ §3/§4
    // GROUNDING ITEM: MAME's line stays asserted until wdclr acks it, so an IRQ that arrives while I is set
    // is PENDING and fires when I next clears (CLI/RTI/PLP). This skeleton fires only at the period tick
    // (drops a masked IRQ); refine to pending-until-ack + re-check on I-clear once §3 reaches the IRQ path
    // (ground vs MAME). Irrelevant to the first boot gap (reset does SEI then hits its first m.call).
    while (this.cycles >= this.nextIrqCycle) {
      this.nextIrqCycle += IRQ_PERIOD;
      this.irqLine = true; // asserts; stays asserted until wdclr (0x5000) acks it -- MAME's periodic_int
    }
    // Take a pending IRQ at THIS instruction boundary if unmasked; an IRQ asserted while I is set is PENDING
    // and fires at the boundary after I next clears (CLI/RTI/PLP) -- not dropped. This matches MAME and keeps
    // the IRQ COUNT (and $53, the main-loop frame counter) in lockstep with the reference.
    if (this.irqLine && !this.regs.fI && this.pcKnown) this.fireIrq();
    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      this.applyInputs(this.frames.length);
      this.frames.push(this.mem.dumpState());
      this.nextBoundary += CYCLES_PER_FRAME;
    }
    if (this.cycles >= this.maxCycles) throw new FramesComplete();
    this.pcKnown = false;
  }

  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      throw new NotImplemented(`m.call: no routine registered at 0x${addr.toString(16).padStart(4, "0")}`);
    }
    return fn(this, ...args);
  }

  // ---- 6502 stack: page 1 (0x0100|S), 8-bit S wrap, high byte pushed first ---------------
  push8(v) {
    this.mem.write8(0x0100 | this.regs.s, v & 0xff);
    this.regs.s = (this.regs.s - 1) & 0xff;
  }
  pull8() {
    this.regs.s = (this.regs.s + 1) & 0xff;
    return this.mem.read8(0x0100 | this.regs.s);
  }
  push16(v) {
    this.push8((v >> 8) & 0xff);
    this.push8(v & 0xff);
  }
  pull16() {
    const lo = this.pull8();
    const hi = this.pull8();
    return lo | (hi << 8);
  }

  ret(cycles = 6) {
    this.step((this.pull16() + 1) & 0xffff, cycles);
  }
  rti(cycles = 6) {
    this.regs.p = this.pull8();
    this.step(this.pull16() & 0xffff, cycles);
  }

  fireIrq() {
    if (this.regs.fI) return false;
    if (!this.pcKnown) throw new Error("IRQ with unknown PC: a routine used tick() rather than step()");
    this.push16(this.pc);
    this.push8((this.regs.p & ~F_B) | F_U);
    this.regs.fI = true;
    const target = this.mem.read16(IRQ_VECTOR);
    this.step(target, 7);
    return this.call(target);
  }

  applyInputs(frameIndex) {
    if (!this.inputTape) return;
    const assert = {};
    for (const t of this.inputTape) {
      const due = frameIndex >= t.frame && (t.dur == null || frameIndex < t.frame + t.dur);
      if (due) assert[t.port] = (assert[t.port] || 0) | t.bits;
    }
    this.io.inputAssert = assert;
  }

  /** Bounded run for the boot-gap crawl: boot never returns, so NotImplemented localises the next gap. */
  runFrames(count) {
    this.io.inputAssert = null;
    this.frames = [this.mem.dumpState()];
    this.maxFrames = count;
    this.maxCycles = count * CYCLES_PER_FRAME + CYCLES_PER_FRAME;
    this.cycles = 0;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextIrqCycle = IRQ_PERIOD;
    if (count <= 1) return this.frames;
    try {
      this.reset();
      this.stoppedBy = "returned";
    } catch (e) {
      if (e instanceof FramesComplete) this.stoppedBy = null;
      else if (e instanceof NotImplemented) this.stoppedBy = e;
      else throw e;
    } finally {
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
      this.nextIrqCycle = Infinity;
    }
    return this.frames;
  }

  renderFrame() {
    return renderFrameRGB(this);
  }
  dumpState() {
    return this.mem.dumpState();
  }
  stateOffsetToAddr(off) {
    return this.mem.stateOffsetToAddr(off);
  }

  clone() {
    const c = new Machine(this.rom, this.routines, this.assets);
    c.mem.workRam.set(this.mem.workRam);
    c.mem.vectorRam.set(this.mem.vectorRam);
    c.io.colorram.set(this.io.colorram);
    c.io.flipX = this.io.flipX;
    c.io.flipY = this.io.flipY;
    c.io.earom = this.io.earom.clone();
    c.io.mathbox = this.io.mathbox.clone();
    c.io.pokeys = this.io.pokeys.map((p) => p.clone());
    if (c.io.avg) { c.io.avg.flipX = this.io.flipX; c.io.avg.flipY = this.io.flipY; }
    c.regs.copyFrom(this.regs);
    c.cycles = this.cycles;
    c.pc = this.pc;
    c.pcKnown = this.pcKnown;
    c.nextBoundary = Infinity;
    c.maxFrames = Infinity;
    c.maxCycles = Infinity;
    return c;
  }
}

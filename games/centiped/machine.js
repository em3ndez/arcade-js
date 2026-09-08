// SPDX-License-Identifier: GPL-3.0-only
// Centipede machine — Atari centiped board + MOS 6502. SKELETON (§2): translated/ is empty, so reset()
// dispatches the 6502 reset vector (0x3FFC) and the first m.call throws NotImplemented — the boot-gap
// crawl (§3) worklist. ⚠ The FRAME/IRQ model is NEW ground and a FIRST DRAFT pending MAME (§3, blocked on
// the missing sync PROM): centiped has a 32V scanline IRQ (a few/frame, acked at 0x1800) AND a CPU-POLLED
// vblank (IN0 bit6), NO vblank NMI. The §4 generator yield is that vblank poll. Nothing runs yet, so the
// cadence below is not exercised — only the seam wiring and reset dispatch are load-bearing now.

import { AddressSpace } from "../../boards/centiped/memory.js";
import { Io, NotImplemented } from "../../boards/centiped/io.js";
import { decodeGraphics, renderFrameRGB } from "../../boards/centiped/video.js";
import { Regs, F_B, F_U } from "../../core/cpu/6502.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { buildRoutines } from "./routines.js";

export const CYCLES_PER_FRAME = 25200; // 1.512MHz/60 nominal; bus contention unmodeled (hardware.json)
export const RESET_VECTOR = 0x3ffc; // 6502 vectors fold under global_mask(0x3fff) to the top of ROM
export const IRQ_VECTOR = 0x3ffe;

// 32V scanline IRQ. TIMER "32v" configure_scanline(generate_interrupt, screen, 0, 16) (centiped.cpp:1794)
// runs every 16V; generate_interrupt (centiped.cpp:434) sets IRQ=((scanline-1)&32), so the line ASSERTS at
// scanlines 48/112/176/240. Screen VTOTAL=256, visarea 0-239 (centiped.cpp:1799-1800): vblank=240-255. One
// 16V step = 25200/256*16 = 1575 cycles, so the assert scanlines land on exact cycle offsets:
export const IRQ_CYCLES = [4725, 11025, 17325, 23625]; // scanlines {48,112,176,240} * 1575/16
export const VBLANK_START = 23625; // scanline 240 * (25200/256); IN0 bit6 high for cycles [23625,25200)

export class FramesComplete extends Error {
  constructor() {
    super("frame budget exhausted");
    this.name = "FramesComplete";
  }
}

export class Machine {
  constructor(rom, routines, opts = {}) {
    // (rom, routinesMap, opts) internally; (rom, opts) from the browser worker.
    if (!(routines instanceof Map)) {
      opts = routines || {};
      routines = buildRoutines();
      if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    }
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs(); // 6502 post-reset defaults: s=0xfd, I set (core/cpu/6502.js)
    this.routines = routines;
    this.rom = rom;
    this.assets = opts;

    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    this.cycles = 0;
    this.pc = 0;
    this.pcKnown = true;
    this.frames = [];
    this.stoppedBy = null;
    this.inputTape = null;
    this.maxFrames = opts.maxFrames ?? Infinity;
    this.maxCycles = opts.maxCycles ?? Infinity;
    this.nextBoundary = CYCLES_PER_FRAME;

    // 32V IRQ schedule (armed by runFrames; Infinity = quiescent, e.g. a clone/boot-gap crawl).
    this.nextIrqCycle = Infinity;
    this.irqSlot = 0;
    this.irqFrameBase = 0;

    // gfx1 is the sole graphics region (tiles + sprites decode from it). No colour PROM.
    const gfx1 = opts.gfx1 ?? opts.gfx;
    this.video = gfx1 ? decodeGraphics(gfx1) : null;

    this.captureVideo = false;
    this.videoFrames = [];

    this.mem.clock = () => this.cycles;
  }

  static async create(rom, opts = {}) {
    const routines = buildRoutines();
    if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    return new Machine(rom, routines, opts);
  }

  reset() {
    // PC <- [0x3FFC/D]. The reset target is the first routine to translate (§3 boot-gap crawl).
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
    // IN0 bit6 = screen vblank (centiped.cpp:1054), driven by raster position within the frame.
    this.io.vblank = this.cycles % CYCLES_PER_FRAME >= VBLANK_START ? 1 : 0;
    // 32V IRQ: assert the 6502 IRQ line at the four grounded cycle offsets each frame. fireIrq is a no-op
    // while I is set (masked → dropped, as MAME auto-clears the line at the next 16V edge); the handler
    // (0x3FFE→loc_3871) acks by writing 0x1800. Advance the slot BEFORE firing (the handler re-enters tick).
    while (this.cycles >= this.nextIrqCycle) {
      this.irqSlot = (this.irqSlot + 1) % IRQ_CYCLES.length;
      if (this.irqSlot === 0) this.irqFrameBase += CYCLES_PER_FRAME;
      this.nextIrqCycle = this.irqFrameBase + IRQ_CYCLES[this.irqSlot];
      this.io.setIrq(true);
      this.fireIrq();
    }
    // Frame boundary: sample state once per frame.
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

  /** RTS: the pushed value is (return-1); resume at +1. The popped PC cannot be a JS return. */
  ret(cycles = 6) {
    this.step((this.pull16() + 1) & 0xffff, cycles);
  }

  /** RTI: pull P then PC (fireIrq's push order). Unlike RTS the PC resumes directly, no +1. */
  rti(cycles = 6) {
    this.regs.p = this.pull8();
    this.step(this.pull16() & 0xffff, cycles);
  }

  /**
   * IRQ service (masked while I set). Push PC then P (B clear, U set), set I, vector through 0x3FFE; the
   * handler restores A/X/Y and ACKs by writing 0x1800, then RTIs. The 32V firing cadence is scheduled in
   * tick(). NOTE: a faithful handler self-restores via the stack, which needs the guest stack maintained —
   * see the return-address-push gap flagged for the translated JSR sites.
   */
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
      if (!due) continue;
      // {track:[axis,delta]} feeds one frame of analog trackball motion (read_trackball); else a digital port.
      if (t.track) this.io.applyTrackball(t.track[0], t.track[1]);
      else assert[t.port] = (assert[t.port] || 0) | t.bits;
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
    this.irqFrameBase = 0; // arm the 32V IRQ schedule at the first assert offset
    this.irqSlot = 0;
    this.nextIrqCycle = IRQ_CYCLES[0];
    if (count <= 1) return this.frames;
    try {
      this.reset();
      this.stoppedBy = "returned"; // boot fell off the end — it should not
    } catch (e) {
      if (e instanceof FramesComplete) this.stoppedBy = null;
      else if (e instanceof NotImplemented) this.stoppedBy = e; // translation gap — keep sampled frames
      else throw e; // UnmappedAccess or a real JS bug
    } finally {
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
      this.nextIrqCycle = Infinity;
    }
    return this.frames;
  }

  renderFrame() {
    if (!this.video) throw new Error("renderFrame needs the gfx1 image");
    return renderFrameRGB(this.mem, this.video, { flipScreen: this.io.flipScreen });
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
    c.mem.videoRam.set(this.mem.videoRam);
    c.mem.objRam.set(this.mem.objRam);
    c.mem.paletteRam.set(this.mem.paletteRam);
    c.mem.watchdogKicks = this.mem.watchdogKicks;
    c.regs.copyFrom(this.regs);
    c.io.loadStateFrom(this.io);
    c.cycles = this.cycles;
    c.pc = this.pc;
    c.pcKnown = this.pcKnown;
    c.nextBoundary = Infinity;
    c.maxFrames = Infinity;
    c.maxCycles = Infinity;
    return c;
  }
}

/** §4 idiomatic override table — empty until the decompile pass starts. */
export async function resolveAllIdiomatic() {
  return new Map();
}

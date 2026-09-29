// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test-only instruments for the boot and foreground spine, whose rewrites hand on by DIRECT call
 * (a plain import, or `yield*` into a generator) rather than through the routine map.
 *
 * recordHardwareWrites(m) — the ordered device writes, address and value, on either side. The
 *   rewrites store to a latch through the indexed view, which carries no bus-cycle offset, so the
 *   board's own write trace (which demands one) cannot be armed on the rewrite's side. Order and
 *   value are the contract; the cycle stamp was never compared.
 *
 * severAtDirectCall(m, name, probe, onReach) — stop a rewrite at the moment it enters the routine
 *   called `name` by a direct call. The routine map cannot see such a transfer, so this watches the
 *   memory accesses `probe` names (the entered routine's first access) and, when one is made from
 *   inside a frame of that name, records the hand-over through `onReach` and throws `Severed`. The
 *   frame check runs only on the probed addresses, so the cost is a stack walk per probed access.
 *   The frozen oracle is severed as before, through the routine map; both arms stop at the same
 *   hand-over after the same work. A rewrite that never enters `name` is never severed, which is
 *   what makes "reached it once" a real observation. `after` lets that many in-frame probed
 *   accesses through first — a loop severed on its SECOND look at its cursor has run one pass.
 */

import { AddressSpace } from "../../../../boards/timeplt/memory.js";

export class Severed extends Error {
  constructor(name) {
    super(`severed on entry to ${name}`);
    this.name = "Severed";
  }
}

export function recordHardwareWrites(m) {
  const log = [];
  const real = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value, ...rest) => {
    const a = addr & 0xffff;
    if (AddressSpace.isHardwareWrite(a)) log.push({ addr: a, value: value & 0xff });
    return real(addr, value, ...rest);
  };
  return log;
}

const inFrame = (name) => {
  const saved = Error.stackTraceLimit;
  Error.stackTraceLimit = 16;
  const stack = new Error().stack;
  Error.stackTraceLimit = saved;
  return stack.includes(`at ${name} (`);
};

export function severAtDirectCall(m, name, { reads = [], writes = [], after = 0 }, onReach) {
  const readSet = new Set(reads);
  const writeSet = new Set(writes);
  const realRead = m.mem.read8.bind(m.mem);
  const realWrite = m.mem.write8.bind(m.mem);
  let passed = 0;
  const check = () => {
    if (!inFrame(name)) return;
    if (passed++ < after) return;
    onReach(m);
    throw new Severed(name);
  };
  m.mem.read8 = (addr) => {
    if (readSet.has(addr & 0xffff)) check();
    return realRead(addr);
  };
  m.mem.write8 = (addr, value, ...rest) => {
    if (writeSet.has(addr & 0xffff)) check();
    return realWrite(addr, value, ...rest);
  };
  return m;
}

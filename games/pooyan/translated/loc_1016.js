// SPDX-License-Identifier: GPL-3.0-only

// loc_1016  (ROM 0x1016-0x1034) -- main-loop sub-state 1 handler (per the 0x0fe3 dispatch table:
// state 1 -> 0x1016). A straight-line sequence of ten subsystem updates, then `ret` to the caller.
// Each `call` pushes its own return (the next instruction) and the engine seats it; the callee's
// own `ret` recovers SP, so the routine is SP-balanced across the block.
const CALL_1583 = "0x1583";
const CALL_1042 = "0x1042 -- clear/seed sprite-0 control byte (ix+0x07)";
const CALL_107D = "0x107d -- advance sub-state + enqueue display cmd, gated on (0x8901)";
const CALL_20D4 = "0x20d4";
const CALL_511B = "0x511b";
const CALL_1219 = "0x1219";
const CALL_40BD = "0x40bd";
const CALL_02EF = "0x02ef";
const CALL_5AE4 = "0x5ae4";
const CALL_0E64 = "0x0e64";

export function loc_1016(m) {
  const { regs, mem } = m; // eslint-disable-line no-unused-vars

  m.push16(0x1019);
  m.step(0x1583, 17); // 1016  call 0x1583
  m.call(0x1583, CALL_1583);

  m.push16(0x101c);
  m.step(0x1042, 17); // 1019  call 0x1042
  m.call(0x1042, CALL_1042);

  m.push16(0x101f);
  m.step(0x107d, 17); // 101c  call 0x107d
  m.call(0x107d, CALL_107D);

  m.push16(0x1022);
  m.step(0x20d4, 17); // 101f  call 0x20d4
  m.call(0x20d4, CALL_20D4);

  m.push16(0x1025);
  m.step(0x511b, 17); // 1022  call 0x511b
  m.call(0x511b, CALL_511B);

  m.push16(0x1028);
  m.step(0x1219, 17); // 1025  call 0x1219
  m.call(0x1219, CALL_1219);

  m.push16(0x102b);
  m.step(0x40bd, 17); // 1028  call 0x40bd
  m.call(0x40bd, CALL_40BD);

  m.push16(0x102e);
  m.step(0x02ef, 17); // 102b  call 0x02ef
  m.call(0x02ef, CALL_02EF);

  m.push16(0x1031);
  m.step(0x5ae4, 17); // 102e  call 0x5ae4
  m.call(0x5ae4, CALL_5AE4);

  m.push16(0x1034);
  m.step(0x0e64, 17); // 1031  call 0x0e64
  m.call(0x0e64, CALL_0E64);

  m.ret(); // 1034  ret
}

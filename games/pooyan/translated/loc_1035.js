// SPDX-License-Identifier: GPL-3.0-only

// loc_1035  (ROM 0x1035-0x1041) -- main-loop sub-state handler tail. This is the return address
// pushed by loc_0fd5 for sub-states >= 2: after the selected sub-state handler `ret`s, control
// lands here and it runs the four post-handler routines in sequence, then `ret`s to the caller.
export function loc_1035(m) {
  const { regs, mem } = m;

  m.push16(0x1038);
  m.step(0x2157, 17); // 1035  call 0x2157
  m.call(0x2157, "post-handler step 1");

  m.push16(0x103b);
  m.step(0x1219, 17); // 1038  call 0x1219
  m.call(0x1219, "post-handler step 2");

  m.push16(0x103e);
  m.step(0x40bd, 17); // 103b  call 0x40bd
  m.call(0x40bd, "post-handler step 3");

  m.push16(0x1041);
  m.step(0x02ef, 17); // 103e  call 0x02ef
  m.call(0x02ef, "post-handler step 4");

  m.ret(); // 1041  ret
}

// SPDX-License-Identifier: GPL-3.0-only

// loc_1b8c  (ROM 0x1b8c-0x1baa) -- a 0x15a8-dispatch state handler (sibling of loc_1b43). Runs
// 0x02c9 (bails via `ret nz` if it reported not-done), runs 0x075d (BC=0x0819), enqueues two
// display commands (rst 0x38: DE=0x0600 then E=0x03), runs 0x7960, then sets (0x880a)=0x0c and
// (0x8808)=0x60 and returns. rst 0x38 = loc_0038 display enqueue.
export function loc_1b8c(m) {
  const { regs, mem } = m;

  m.push16(0x1b8f);
  m.step(0x02c9, 17);              // 1b8c  call 0x02c9 (pattern A -> 0x1b8f)
  m.call(0x02c9);
  if (regs.fNZ) { m.ret(11); return; } // 1b8f  ret nz -- 0x02c9 not done
  m.step(0x1b90, 5);              // ret nz not taken

  regs.bc = 0x0819;               m.step(0x1b93, 10);
  m.push16(0x1b96);
  m.step(0x075d, 17);             // 1b93  call 0x075d (pattern A -> 0x1b96)
  m.call(0x075d);
  regs.de = 0x0600;               m.step(0x1b99, 10);
  m.push16(0x1b9a);
  m.step(0x0038, 11);             // 1b99  rst 0x38 (loc_0038 display enqueue, DE)
  m.call(0x0038);
  regs.e = 0x03;                  m.step(0x1b9c, 7);
  m.push16(0x1b9d);
  m.step(0x0038, 11);             // 1b9c  rst 0x38 (loc_0038 display enqueue, DE)
  m.call(0x0038);
  m.push16(0x1ba0);
  m.step(0x7960, 17);             // 1b9d  call 0x7960 (pattern A -> 0x1ba0)
  m.call(0x7960);
  regs.a = 0x0c;                  m.step(0x1ba2, 7);
  mem.write8(0x880a, regs.a);     m.step(0x1ba5, 13);
  regs.a = 0x60;                  m.step(0x1ba7, 7);
  mem.write8(0x8808, regs.a);     m.step(0x1baa, 13);

  m.ret(); // 1baa  ret
}

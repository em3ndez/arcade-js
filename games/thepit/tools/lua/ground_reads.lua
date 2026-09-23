-- SPDX-License-Identifier: GPL-3.0-only
-- Grounding read-tap (The Pit): record DISTINCT (pc,addr) reads into program ROM 0x0000-0x4FFF, so a
-- ROM constant/table's role reader can be observed (stage-B [code]->[seen] for ROM cells the write-tap
-- can never ground) AND the set of executing PCs gives reachability (opcode fetches read ROM at PC) to
-- tell a reached register-compute helper from a genuinely-deep routine. ROM span is the 20KB program
-- image (games/thepit/rom/maincpu.bin is 0x5000 bytes: p38b/p39b/p40b/p41b/p33b, mapped 0x0000-0x4FFF;
-- 0x5000-0x7FFF is unmapped, RAM starts at 0x8000). Deduped in-lua (a full read log is tens of millions
-- of rows); one line per first sighting. CURPC is the NEXT instruction. Output CSV: pc,addr. Env: GROUND_OUT.
-- ⚠ The ROM-checksum / anti-tamper sweep PC (one PC that reads hundreds of ROM addresses) grounds nothing
-- role-specific and must be EXCLUDED downstream at triage -- measure reachability from the pc (curpc)
-- column, NEVER the addr column (the boot sweep reads every ROM byte, so an addr appears as "read" even for
-- code that never executed).
local out = io.open(os.getenv("GROUND_OUT") or "ground_reads.csv", "w")
out:setvbuf("no"); out:write("pc,addr\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local seen = {}
_G.__ground_rtap = prog:install_read_tap(0x0000, 0x4fff, "groundr", function(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  local k = pc * 0x10000 + offset
  if not seen[k] then seen[k] = true; out:write(string.format("%04x,%04x\n", pc, offset)) end
end)

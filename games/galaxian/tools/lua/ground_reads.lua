-- SPDX-License-Identifier: GPL-3.0-only
-- Grounding read-tap: record DISTINCT (pc,addr) reads into ROM 0x0000-0x3fff, so a ROM constant/table's
-- role reader can be observed (stage-B [code]->[seen] for ROM cells the write-tap can never ground) AND
-- the set of executing PCs gives reachability (opcode fetches read ROM at PC) to tell a reached
-- register-compute helper from a genuinely-deep routine. Deduped in-lua (a full read log is tens of
-- millions of rows); one line per first sighting. CURPC is the NEXT instruction. Output CSV: pc,addr.
-- Env: GROUND_OUT.
local out = io.open(os.getenv("GROUND_OUT") or "ground_reads.csv", "w")
out:setvbuf("no"); out:write("pc,addr\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local seen = {}
_G.__ground_rtap = prog:install_read_tap(0x0000, 0x3fff, "groundr", function(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  local k = pc * 0x10000 + offset
  if not seen[k] then seen[k] = true; out:write(string.format("%04x,%04x\n", pc, offset)) end
end)

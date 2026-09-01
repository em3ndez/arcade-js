-- SPDX-License-Identifier: GPL-3.0-only
-- Space Invaders (8080): dump the main_ram state region (0x2000-0x3FFF) each time the CPU reaches a
-- target PC (env DUMP_PC). Used by grounding (§5), NOT the frame golden. ★ MINIMAL until §5: mirrors
-- dump_state's region; a PC tap via a debugger/PC watch is added when grounding needs it.
local out = assert(io.open(os.getenv("STATE_OUT") or "state_at_pc.bin", "wb"))
out:setvbuf("no")
local mem = manager.machine.devices[":maincpu"].spaces["program"]
local PC = tonumber(os.getenv("DUMP_PC") or "0") or 0
local function sample()
  local parts = {}
  for a = 0x2000, 0x3FFF do parts[#parts + 1] = string.char(mem:read_u8(a)) end
  out:write(table.concat(parts))
end
-- ★ §5: gate on PC==DUMP_PC via a proper PC watch; for now sample once per frame as a safe default.
_G.__atpc_sub = emu.add_machine_frame_notifier(function() if PC == 0 then return end; sample() end)

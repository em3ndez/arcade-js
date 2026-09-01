-- SPDX-License-Identifier: GPL-3.0-only
-- Space Invaders (8080) per-frame RAM dump: the single main_ram region 0x2000-0x3FFF (8192 bytes/frame:
-- work RAM 0x2000-0x23FF + 1bpp video framebuffer 0x2400-0x3FFF). Base mirrors hardware.json "stateRegions"
-- AND boards/invaders/memory.js, so a golden frame memcmps the JS renderer's state. SAMPLING matches the
-- Z80 games: state[0] is power-on (at load, before the CPU runs), state[N] after frames 0..N-1; the
-- notifier fires at a frame's END, hence the extra load-time dump. Retain the subscription or GC drops it.

local out = assert(io.open(os.getenv("STATE_OUT") or "state.bin", "wb"))
out:setvbuf("no")

local mem = manager.machine.devices[":maincpu"].spaces["program"]

-- CONFIGURATION certification. No memory-mapped DSW here (8080 dips are on the IN ports); prove the program
-- ROM loaded via distinctive ROM bytes (0x0000=00 nop, 0x0003=C3 jmp, 0x18D4=31 lxi sp -- the init), and
-- record the 8080 reset registers. A stray MAME cfg silently corrupts every golden, so this is the guard.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("rom0000=0x%02X\nrom0003=0x%02X\nrom18d4=0x%02X\n",
    mem:read_u8(0x0000), mem:read_u8(0x0003), mem:read_u8(0x18D4)))
  local cpu = manager.machine.devices[":maincpu"]
  for _, rn in ipairs({ "AF", "BC", "DE", "HL", "SP", "PC" }) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

if os.getenv("STATE_ENABLED") == "0" then return end

local REGIONS = {
  { 0x2000, 0x3FFF, "main_ram" },
}

local function sample()
  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(mem:read_u8(a))
    end
  end
  out:write(table.concat(parts))
end

sample()

_G.__frame_count = 1
_G.__state_sub = emu.add_machine_frame_notifier(function()
  sample()
  _G.__frame_count = _G.__frame_count + 1
end)

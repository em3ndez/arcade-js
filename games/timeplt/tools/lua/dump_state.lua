-- SPDX-License-Identifier: GPL-3.0-only
-- Per-frame RAM state dump: colour, video, work, sprite0, sprite1, in that fixed
-- order, 4608 bytes per frame. Region bases live in hardware.json.
--
-- SAMPLING: state[0] is power-on, state[N] is after frames 0..N-1. The notifier fires
-- at the END of a frame, hence the extra dump at script load. That off-by-one is
-- INVISIBLE to the obvious check: the boot RAM clear writes zeros over zeros.
-- Retain the subscription or it unsubscribes when collected, leaving a plausible
-- truncated file. Unbuffered, so readers must truncate to whole frames.

local out = assert(io.open(os.getenv("STATE_OUT") or "state.bin", "wb"))
out:setvbuf("no")

local mem = manager.machine.devices[":maincpu"].spaces["program"]

-- The CONFIGURATION this capture ran under: MAME persists dipswitch changes to a cfg
-- file, and a stray one silently changes every golden frame. BOTH BANKS -- DSW0 is
-- coinage only here, while DSW1 holds lives, bonus, difficulty and cabinet. The ROM
-- byte is a control: unmapped reads are 0xFF on this board, which is also DSW0's
-- expected value, so DSW0 alone cannot tell a real read from no read at all.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ndsw1=0x%02X\ncontrol_rom0000=0x%02X\n",
    mem:read_u8(0xC360), mem:read_u8(0xC200), mem:read_u8(0x0000)))
  local cpu = manager.machine.devices[":maincpu"]
  for _, rn in ipairs({"AF","BC","DE","HL","IX","IY","SP"}) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

-- STATE_ENABLED=0 certifies configuration only, so a frames-only golden still records
-- its dipswitches -- the Cabinet bit flips the whole screen and lives in DSW1.
if os.getenv("STATE_ENABLED") == "0" then return end

-- Mirrors hardware.json "stateRegions"; keep consistent with it.
local REGIONS = {
  { 0xA000, 0xA3FF, "color" },
  { 0xA400, 0xA7FF, "video" },
  { 0xA800, 0xAFFF, "work" },
  { 0xB000, 0xB0FF, "sprite0" },
  { 0xB400, 0xB4FF, "sprite1" }
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

-- state[0]: true power-on state, sampled at script load before the CPU runs.
sample()

_G.__frame_count = 1
_G.__state_sub = emu.add_machine_frame_notifier(function()
  -- Fires at the END of frame N, so this writes state[N+1].
  sample()
  _G.__frame_count = _G.__frame_count + 1
end)

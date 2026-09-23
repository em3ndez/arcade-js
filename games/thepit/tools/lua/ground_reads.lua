-- Full-span read-tap: dedup (pc,addr,value) over 0x0000-0xBFFF so VRAM/RAM role reads and MMIO
-- (DSW/watchdog/ports) reads are witnessed (the committed ground_reads.lua stops at ROM 0x4FFF).
-- Excludes nothing here; the checksum-sweep PCs are filtered downstream in triage.
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local OUT = os.getenv("FULLREAD_OUT") or "fullread.csv"
local f = assert(io.open(OUT,"w")); f:setvbuf("no"); f:write("pc,addr,v\n")
local seen = {}
_G.__frtap = prog:install_read_tap(0x0000, 0xbfff, "fullr", function(off, data, mask)
  local pc = cpu.state["CURPC"].value
  local k = pc*0x1000000 + off*0x100 + (data & 0xff)
  if not seen[k] then seen[k]=true; f:write(string.format("%04x,%04x,%02x\n", pc, off, data & 0xff)) end
end)
assert(_G.__frtap, "read tap not installed")

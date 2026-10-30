-- Additive upgrade: preserve existing employees and the checksum of the RH baseline.
-- Run only through db:migrate, after the normal deployment backup.
ALTER TABLE nex_hr.employees ADD COLUMN IF NOT EXISTS termination_on date;

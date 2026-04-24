-- Add serial_no column to pre_registrations table
ALTER TABLE "public"."pre_registrations" ADD COLUMN "serial_no" integer;

COMMENT ON COLUMN "public"."pre_registrations"."serial_no" IS 'serial number of the student, optional';

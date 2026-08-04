-- Fix discovered by the live Scenario A cleanup: the FK
-- audit_logs.organization_id → organizations(id) ON DELETE SET NULL tries to
-- rewrite audit rows when an organization is deleted, and the immutability
-- trigger correctly blocks that — making organization deletion impossible.
-- An audit log must keep the ORIGINAL identifiers as immutable history, so
-- the FK is dropped: organization_id stays a plain uuid. RLS is unaffected
-- (owners of a deleted org simply resolve to zero rows; admins/service see all).

begin;

alter table public.audit_logs drop constraint if exists audit_logs_organization_id_fkey;

commit;

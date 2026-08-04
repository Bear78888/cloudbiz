-- Hardening (Supabase advisor 0028): Supabase default privileges grant
-- EXECUTE on new functions directly to anon/authenticated/service_role;
-- `revoke ... from public` does not remove those direct grants.
-- create_organization already fails closed for anonymous callers
-- (auth.uid() is null → exception), but the anon grant should not exist.
-- The remaining authenticated grant on create_organization is intentional —
-- signed-in users create their organization through this RPC.

begin;

revoke execute on function public.create_organization(text, text, text, text) from anon;
revoke all on function app_private.is_member_of(uuid) from anon;
revoke all on function app_private.member_role(uuid) from anon;
revoke all on function app_private.is_org_owner(uuid) from anon;
revoke all on function app_private.is_admin() from anon;
revoke all on function app_private.slugify(text) from anon;

commit;

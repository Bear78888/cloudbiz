-- Hardening (Supabase advisor 0028), same trap as 20260804000200:
-- Supabase default privileges grant EXECUTE on every new function directly to
-- anon / authenticated / service_role. `revoke ... from public` does not touch
-- those direct grants, so `import_jobs` shipped callable by anon.
--
-- The function already fails closed for an anonymous caller (`auth.uid() is
-- null` → exception, before any read), so nothing was exposed — but an RPC
-- that can only ever succeed for a signed-in member has no business being
-- listed in the anonymous API surface.
--
-- Convention for every future SECURITY DEFINER function: revoke from `public`
-- *and* from `anon`, then grant to exactly the roles that need it.

begin;

revoke execute on function public.import_jobs(uuid, jsonb) from anon;

commit;

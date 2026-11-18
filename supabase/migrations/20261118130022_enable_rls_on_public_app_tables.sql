-- Block direct anon/authenticated access to application data tables.
-- The web app reaches these tables through the Edge Function, which uses the
-- server-side service_role key and therefore continues to bypass RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_docs ENABLE ROW LEVEL SECURITY;

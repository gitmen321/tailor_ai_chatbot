-- Connect new PWA accounts to Supabase Auth without reassigning any legacy
-- WhatsApp or demo rows. Existing rows remain private until their owner is
-- explicitly mapped by an operator.
ALTER TABLE public.users
  ALTER COLUMN whatsapp_number DROP NOT NULL,
  ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_per_user_idx
  ON public.conversations (user_id);

ALTER TABLE public.conversations
  DROP CONSTRAINT conversations_user_id_fkey,
  ADD CONSTRAINT conversations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

ALTER TABLE public.messages
  DROP CONSTRAINT messages_conversation_id_fkey,
  ADD CONSTRAINT messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx
  ON public.messages (conversation_id, created_at DESC);

ALTER TABLE public.machine_docs
  ADD COLUMN owner_auth_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS machine_docs_owner_model_idx
  ON public.machine_docs (owner_auth_user_id, machine_model)
  WHERE source = 'learned';

-- Pin the existing manual-search function's path, then add a user-scoped search
-- path for learned answers so one account's chat-derived knowledge stays private.
ALTER FUNCTION public.match_machine_docs(public.vector, text, integer)
  SET search_path = public;

CREATE OR REPLACE FUNCTION public.match_machine_docs_for_account(
  query_embedding public.vector,
  match_machine_model text,
  match_count integer DEFAULT 4,
  requesting_user_id uuid DEFAULT NULL
)
RETURNS TABLE(id bigint, content text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT
    md.id,
    md.content,
    1 - (md.embedding <=> query_embedding) AS similarity
  FROM public.machine_docs AS md
  WHERE md.machine_model = match_machine_model
    AND (
      md.source = 'manual'
      OR (md.source = 'learned' AND md.owner_auth_user_id = requesting_user_id)
    )
  ORDER BY md.embedding <=> query_embedding
  LIMIT match_count;
$function$;

REVOKE ALL ON FUNCTION public.match_machine_docs_for_account(public.vector, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_machine_docs_for_account(public.vector, text, integer, uuid)
  TO service_role;

-- Private profile/machine fields are kept on the existing user record. The
-- service-role API writes them after validating the caller's Auth JWT.
CREATE POLICY users_select_own_account
  ON public.users FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

CREATE POLICY conversations_select_own_account
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users AS account
      WHERE account.id = conversations.user_id
        AND account.auth_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY messages_select_own_account
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations AS conversation
      JOIN public.users AS account ON account.id = conversation.user_id
      WHERE conversation.id = messages.conversation_id
        AND account.auth_user_id = (SELECT auth.uid())
    )
  );

-- machine_docs intentionally keeps RLS enabled with no direct user policy.
-- The Edge API reads shared manual chunks with its server-only service key.

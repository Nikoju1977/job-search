-- Niko Emploi v6 | migration additive du suivi des candidatures.
-- A EXECUTER UNE FOIS sur la base Neon avant d'activer la synchronisation v6.
-- Aucune donnée existante n'est supprimée. PostgreSQL 15+.
BEGIN;

ALTER TABLE public.niko_applications
  ALTER COLUMN job_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS recruiter_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes_ciphertext text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_format text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interview_place text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cv_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS submission_proof text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS application_channel text NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS first_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.niko_applications DROP CONSTRAINT IF EXISTS niko_applications_status_check;
ALTER TABLE public.niko_applications ADD CONSTRAINT niko_applications_status_check
 CHECK (status IN ('draft','sent','reply','interview','offer','hired','rejected','withdrawn','failed'));
ALTER TABLE public.niko_applications DROP CONSTRAINT IF EXISTS niko_applications_submission_proof_check;
ALTER TABLE public.niko_applications ADD CONSTRAINT niko_applications_submission_proof_check
 CHECK (submission_proof IN ('legacy','self_reported','gmail_verified','not_sent'));

UPDATE public.niko_applications SET submission_proof='not_sent' WHERE status='draft' AND submission_proof='legacy';
UPDATE public.niko_applications SET submission_proof='gmail_verified'
 WHERE gmail_message_id IS NOT NULL AND gmail_thread_id IS NOT NULL AND status<>'draft' AND submission_proof='legacy';

CREATE INDEX IF NOT EXISTS niko_apps_due_active ON public.niko_applications(user_id,next_action_at)
  WHERE archived_at IS NULL AND next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS niko_apps_last_status ON public.niko_applications(user_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS public.niko_application_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.niko_users(id) ON DELETE CASCADE,
 application_id uuid NOT NULL REFERENCES public.niko_applications(id) ON DELETE CASCADE,
 kind text NOT NULL,
 previous_status text,
 next_status text,
 message_ciphertext text,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS niko_app_events_owner_app ON public.niko_application_events(user_id,application_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.niko_tracker_settings (
 user_id uuid PRIMARY KEY REFERENCES public.niko_users(id) ON DELETE CASCADE,
 email_reminders boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.niko_tracker_digest_log (
 user_id uuid NOT NULL REFERENCES public.niko_users(id) ON DELETE CASCADE,
 reminder_date date NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 PRIMARY KEY(user_id,reminder_date)
);
COMMIT;

-- Les anciens statuts restent compatibles. Les statuts Gmail vérifiés ne sont
-- jamais inférés depuis une déclaration utilisateur.
-- Les notes des candidatures et du journal sont chiffrées côté serveur AES-GCM.
-- Pour les utilisateurs sans compte, l'application peut fonctionner localement,
-- sans aucune synchronisation de ces données avec cette base.

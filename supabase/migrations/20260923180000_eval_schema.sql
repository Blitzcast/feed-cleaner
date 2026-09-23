-- Eval data for the spec's success criteria. One session = one scroll through ~100 posts,
-- one row per post. eval_session_metrics computes precision, recall, volume, thread
-- preservation, signal coverage and the kill condition from those rows.
--
-- Privacy: rows store the X status id only, never handles or post text.
-- RLS is on with no policies, so only the secret key (server side) can read or write.

create table public.eval_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  extension_version text not null,
  -- Snapshot of the thresholds this session ran with. These are guesses, not tuned.
  thresholds jsonb not null,
  notes text
);

create table public.eval_posts (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.eval_sessions (id) on delete cascade,
  position integer not null check (position > 0), -- scroll order, 1-based
  status_id text not null check (status_id ~ '^[0-9]+$'),
  seen_at timestamptz not null default now(),

  -- Signals as read from the DOM. null = not readable on this post.
  posts_per_day numeric check (posts_per_day >= 0),
  account_origin text,
  account_age_days integer check (account_age_days >= 0),
  consistency numeric check (consistency between 0 and 1),

  score numeric check (score between 0 and 1), -- null if no signal was readable
  collapsed boolean not null,

  -- Filled in by hand after the session. null = not labeled / no replies to check.
  verdict text check (verdict in ('bot', 'human')),
  replies_intact boolean,

  unique (session_id, status_id),
  unique (session_id, position)
);

alter table public.eval_sessions enable row level security;
alter table public.eval_posts enable row level security;

create view public.eval_session_metrics
with (security_invoker = true) as
with counts as (
  select
    s.id as session_id,
    s.started_at,
    s.extension_version,
    count(p.id) as posts_scrolled,
    count(p.verdict) as posts_labeled,
    count(*) filter (where p.collapsed) as collapsed,
    count(*) filter (where p.collapsed and p.verdict is not null) as collapsed_labeled,
    count(*) filter (where p.collapsed and p.verdict = 'bot') as collapsed_bots,
    count(*) filter (where p.verdict = 'bot') as bots_seen,
    count(p.replies_intact) as threads_checked,
    count(*) filter (where p.replies_intact) as threads_intact,
    count(p.posts_per_day) as posts_per_day_readable,
    count(p.account_origin) as account_origin_readable,
    count(p.account_age_days) as account_age_readable,
    count(p.consistency) as consistency_readable
  from public.eval_sessions s
  left join public.eval_posts p on p.session_id = s.id
  group by s.id
),
rates as (
  select
    *,
    round(collapsed_bots::numeric / nullif(collapsed_labeled, 0), 3) as precision_rate,
    round(collapsed_bots::numeric / nullif(bots_seen, 0), 3) as recall_rate,
    round(100.0 * collapsed / nullif(posts_scrolled, 0), 1) as collapsed_per_100,
    round(threads_intact::numeric / nullif(threads_checked, 0), 3) as thread_preservation,
    (posts_per_day_readable > 0)::int + (account_origin_readable > 0)::int
      + (account_age_readable > 0)::int + (consistency_readable > 0)::int as signals_readable
  from counts
)
select
  *,
  precision_rate >= 0.8 as meets_precision,
  recall_rate >= 0.5 as meets_recall,
  collapsed_per_100 >= 10 as meets_volume,
  threads_checked = threads_intact as meets_thread_preservation,
  precision_rate < 0.5 and collapsed_per_100 > 10 as kill
from rates;

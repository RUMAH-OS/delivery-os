-- Delivery OS — DB-plane dead-man's-switch (M3.2, ADR-005). Idempotent; applied to the Engine DB.
-- Replaces the GitHub-Actions dead-man-switch cron: a pg_cron job (a DIFFERENT failure domain than the Neo
-- compute plane) reads engine_heartbeat freshness and DETECTS a silent engine stall — at zero GitHub minutes.
--
-- DELIVERY IS DEFERRED BY DESIGN (founder, roadmap order): the canonical alert destination is the Delivery OS
-- Slack Control Surface, delivered in Sprint 5.3. Until then this watchdog DETECTS + RECORDS alarms but does
-- NOT deliver them (no temporary webhook / alternative notifier). The endpoint is configurable
-- (engine_config.alert_webhook, declared in the platform secret registry as ENGINE_ALERT_WEBHOOK); when
-- Sprint 5.3 sets it, the same job begins delivering — no code change.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- platform config (key/value). alert_webhook stays NULL until Sprint 5.3 wires the Slack surface.
create table if not exists engine_config (
  key   text primary key,
  value text
);
insert into engine_config(key, value) values ('alert_webhook', null)
  on conflict (key) do nothing;

-- the alarm log (detection record; `delivered` flips true only once a webhook is configured + the POST sent).
create table if not exists engine_heartbeat_alarm (
  id           bigint generated always as identity primary key,
  node_id      text        not null,
  detected_at  timestamptz not null default now(),
  last_beat_at timestamptz not null,
  age_seconds  integer     not null,
  delivered    boolean     not null default false
);
create index if not exists engine_heartbeat_alarm_node_idx on engine_heartbeat_alarm(node_id, detected_at desc);

-- the watchdog. threshold default = 15 min (3 missed 5-min beats; matches the retired GHA design).
-- Dedup: at most one alarm per node per hour (avoid spam). Delivery is gated on a configured webhook.
create or replace function engine_dead_man_check(p_threshold interval default interval '15 minutes')
returns integer language plpgsql as $$
declare
  r          record;
  v_webhook  text;
  v_new      integer := 0;
  v_alarm_id bigint;
begin
  select value into v_webhook from engine_config where key = 'alert_webhook';
  for r in
    select node_id, last_beat_at,
           floor(extract(epoch from now() - last_beat_at))::int as age_seconds
    from engine_heartbeat
    where now() - last_beat_at > p_threshold
  loop
    -- dedup: skip if we already recorded an alarm for this node in the last hour.
    if exists (select 1 from engine_heartbeat_alarm a
               where a.node_id = r.node_id and a.detected_at > now() - interval '1 hour') then
      continue;
    end if;
    insert into engine_heartbeat_alarm(node_id, last_beat_at, age_seconds)
      values (r.node_id, r.last_beat_at, r.age_seconds)
      returning id into v_alarm_id;
    v_new := v_new + 1;
    -- DELIVERY (deferred): only if a canonical webhook is configured (Sprint 5.3). Otherwise detection-only.
    if v_webhook is not null and v_webhook <> '' then
      perform net.http_post(
        url := v_webhook,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('alarm','engine-heartbeat-stale','node_id',r.node_id,
                                   'last_beat_at',r.last_beat_at,'age_seconds',r.age_seconds)
      );
      update engine_heartbeat_alarm set delivered = true where id = v_alarm_id;
    end if;
  end loop;
  return v_new;
end $$;

-- schedule the watchdog every 5 minutes (idempotent: unschedule a prior copy, then schedule).
do $$ begin
  if exists (select 1 from cron.job where jobname = 'engine-dead-man-switch') then
    perform cron.unschedule('engine-dead-man-switch');
  end if;
end $$;
select cron.schedule('engine-dead-man-switch', '*/5 * * * *', 'select engine_dead_man_check()');

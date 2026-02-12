-- Aggregation function: rolls up raw events into daily aggregates
create or replace function analytics.pulse_refresh_aggregates(days_back integer default 7)
returns void
language sql
security definer
as $$
  insert into analytics.pulse_aggregates (date, site_id, path, total_views, unique_visitors)
  select
    date_trunc('day', created_at)::date as date,
    site_id,
    path,
    count(*) as total_views,
    count(distinct session_id) as unique_visitors
  from analytics.pulse_events
  where created_at >= now() - (days_back || ' days')::interval
  group by 1, 2, 3
  on conflict (date, site_id, path) do update
  set
    total_views = excluded.total_views,
    unique_visitors = excluded.unique_visitors;
$$;

-- Allow all roles to execute the aggregation function
-- security definer ensures it runs with the owner's privileges regardless of caller
grant execute on function analytics.pulse_refresh_aggregates(integer) to anon, authenticated, service_role;

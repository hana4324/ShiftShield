-- pglite:skip-file
-- Every PostGIS call in the schema goes through these helpers so the embedded-Postgres test
-- harness (no PostGIS) can swap in a flat-earth stub: supabase/tests/pglite/geo-stub.sql.

create or replace function private.make_point(p_lat double precision, p_lng double precision)
returns public.geo_point
language sql
immutable
as $$
  select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
$$;

create or replace function private.distance_m(a public.geo_point, b public.geo_point)
returns double precision
language sql
immutable
as $$
  select extensions.ST_Distance(a, b);
$$;

create or replace function private.within_m(a public.geo_point, b public.geo_point, p_meters double precision)
returns boolean
language sql
immutable
as $$
  select extensions.ST_DWithin(a, b, p_meters);
$$;

create or replace function private.geo_lat(p public.geo_point)
returns double precision
language sql
immutable
as $$
  select extensions.ST_Y(p::extensions.geometry);
$$;

create or replace function private.geo_lng(p public.geo_point)
returns double precision
language sql
immutable
as $$
  select extensions.ST_X(p::extensions.geometry);
$$;

-- Public, JSON-friendly view of a point for API consumers.
create or replace function public.geo_to_json(p public.geo_point)
returns jsonb
language sql
immutable
as $$
  select case when p is null then null else jsonb_build_object('lat', private.geo_lat(p), 'lng', private.geo_lng(p)) end;
$$;

-- Spatial indexes (GIST) on the point columns.
create index sites_geo_idx on public.sites using gist (geo);
create index officer_profiles_home_geo_idx on public.officer_profiles using gist (home_geo);

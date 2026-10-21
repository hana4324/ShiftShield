-- Test-only replacement for 20261021000110_geo_helpers.sql (PGlite has no PostGIS).
-- geo_point is a jsonb domain here: {"lat": .., "lng": ..}. Distances use the haversine formula.

create or replace function private.make_point(p_lat double precision, p_lng double precision)
returns public.geo_point
language sql
immutable
as $$
  select jsonb_build_object('lat', p_lat, 'lng', p_lng)::public.geo_point;
$$;

create or replace function private.geo_lat(p public.geo_point)
returns double precision
language sql
immutable
as $$
  select (p ->> 'lat')::double precision;
$$;

create or replace function private.geo_lng(p public.geo_point)
returns double precision
language sql
immutable
as $$
  select (p ->> 'lng')::double precision;
$$;

create or replace function private.distance_m(a public.geo_point, b public.geo_point)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000.0 * asin(sqrt(
    pow(sin(radians(private.geo_lat(b) - private.geo_lat(a)) / 2), 2)
    + cos(radians(private.geo_lat(a))) * cos(radians(private.geo_lat(b)))
      * pow(sin(radians(private.geo_lng(b) - private.geo_lng(a)) / 2), 2)
  ));
$$;

create or replace function private.within_m(a public.geo_point, b public.geo_point, p_meters double precision)
returns boolean
language sql
immutable
as $$
  select private.distance_m(a, b) <= p_meters;
$$;

create or replace function public.geo_to_json(p public.geo_point)
returns jsonb
language sql
immutable
as $$
  select case when p is null then null else jsonb_build_object('lat', private.geo_lat(p), 'lng', private.geo_lng(p)) end;
$$;

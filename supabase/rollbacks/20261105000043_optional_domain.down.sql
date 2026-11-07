-- Reverts 20261105000043_optional_domain.sql: the domain is required again (0021's check).
create or replace function private.check_business_input(b jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare
  f text;
begin
  foreach f in array array['name', 'domain', 'city', 'state', 'country'] loop
    if coalesce(btrim(b ->> f), '') = '' then
      raise exception 'business.% is required', f using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if char_length(b ->> 'name') > 200 then
    raise exception 'business.name must be at most 200 characters' using errcode = 'invalid_parameter_value';
  end if;
  if not private.is_hostname(b ->> 'domain') then
    raise exception 'business.domain must be a valid hostname' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'city') > 100 or char_length(b ->> 'state') > 100 or char_length(b ->> 'country') > 100 then
    raise exception 'business.city, state and country must be at most 100 characters' using errcode = 'invalid_parameter_value';
  end if;
  if b ? 'vertical' and jsonb_typeof(b -> 'vertical') <> 'null' and not private.is_vertical(b ->> 'vertical') then
    raise exception 'business.vertical is not a known vertical' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(b ->> 'cuisine') > 60 then
    raise exception 'business.cuisine must be at most 60 characters' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

begin;

alter table public.categories
  add column if not exists company_id uuid references public.companies(id);

alter table public.orders
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists delivered_at timestamptz,
  add column if not exists checkout_request_key uuid,
  add column if not exists checkout_request_hash text;

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if exists (
    select category.id
    from public.categories as category
    left join public.products as product on product.category_id = category.id
    group by category.id
    having count(distinct product.company_id) <> 1
  ) then
    raise exception 'Every existing category must be referenced by products from exactly one company before migration.';
  end if;

  if exists (
    select order_row.id
    from public.orders as order_row
    left join public.customers as customer on customer.id = order_row.customer_id
    where customer.id is null or customer.company_id is null
  ) then
    raise exception 'Every existing order must have a customer assigned to a company before migration.';
  end if;
end
$$;

update public.categories as category
set company_id = owners.company_id
from (
  select product.category_id, min(product.company_id::text)::uuid as company_id
  from public.products as product
  where product.category_id is not null
  group by product.category_id
  having count(distinct product.company_id) = 1
) as owners
where owners.category_id = category.id
  and category.company_id is null;

update public.orders as order_row
set company_id = customer.company_id
from public.customers as customer
where customer.id = order_row.customer_id
  and order_row.company_id is null;

update public.orders as order_row
set delivered_at = coalesce(
  (
    select min(detail.download_expires_at) - interval '30 days'
    from public.order_details as detail
    where detail.order_id = order_row.id
      and detail.download_expires_at is not null
  ),
  order_row.created_at
)
where order_row.status = 'delivered'
  and order_row.delivered_at is null;

alter table public.categories alter column company_id set not null;
alter table public.orders alter column company_id set not null;

create index if not exists categories_company_name_idx
  on public.categories (company_id, name);
create unique index if not exists categories_company_name_unique_idx
  on public.categories (company_id, lower(name));
create unique index if not exists customers_company_email_unique_idx
  on public.customers (company_id, email);
create unique index if not exists customers_company_auth_user_unique_idx
  on public.customers (company_id, auth_user_id)
  where auth_user_id is not null;
create index if not exists orders_company_created_at_idx
  on public.orders (company_id, created_at desc);
create unique index if not exists orders_company_checkout_request_key_idx
  on public.orders (company_id, checkout_request_key)
  where checkout_request_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_allowed'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_status_allowed
      check (status in ('pending', 'paid', 'delivered', 'cancelled', 'refunded'));
  end if;
end
$$;

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid' and new.status in ('delivered', 'refunded'))
    or (old.status = 'delivered' and new.status = 'refunded')
  ) then
    raise exception 'Invalid order status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status = 'delivered' then
    new.delivered_at = coalesce(old.delivered_at, clock_timestamp());
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_status_transition on public.orders;
create trigger orders_enforce_status_transition
before update of status on public.orders
for each row execute function public.enforce_order_status_transition();

create table if not exists public.rate_limit_buckets (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;

create index if not exists rate_limit_buckets_window_started_at_idx
  on public.rate_limit_buckets (window_started_at);

grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
    or p_max_requests < 1
    or p_window_seconds < 5
    or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters.' using errcode = '22023';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets (key_hash, window_started_at, request_count)
  values (p_key_hash, current_window, 1)
  on conflict (key_hash) do update
    set window_started_at = excluded.window_started_at,
        request_count = case
          when public.rate_limit_buckets.window_started_at = excluded.window_started_at
            then public.rate_limit_buckets.request_count + 1
          else 1
        end
  returning request_count into current_count;

  delete from public.rate_limit_buckets
  where window_started_at < clock_timestamp() - interval '1 day';

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create or replace function public.create_checkout_order(
  p_company_id uuid,
  p_full_name text,
  p_email text,
  p_items jsonb,
  p_request_key uuid,
  p_request_hash text
)
returns table (order_id uuid, total numeric, created boolean, order_created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_count integer;
  matched_count integer;
  order_total numeric(12, 2);
  customer_id uuid;
  created_order_id uuid;
  created_order_created_at timestamptz;
  existing_hash text;
begin
  if p_full_name is null or length(btrim(p_full_name)) < 2 or length(p_full_name) > 120
    or p_email is null or length(p_email) > 254
    or p_request_key is null
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 20 then
    raise exception 'Invalid checkout request.' using errcode = '22023';
  end if;

  with requested as (
    select item."productId" as product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item("productId" uuid, quantity integer)
    group by item."productId"
  )
  select count(*)::integer
  into requested_count
  from requested;

  if requested_count < 1 or requested_count > 20 or exists (
    select 1
    from jsonb_to_recordset(p_items) as item("productId" uuid, quantity integer)
    group by item."productId"
    having sum(item.quantity) < 1 or sum(item.quantity) > 10
  ) then
    raise exception 'Invalid product quantity.' using errcode = '22023';
  end if;

  with requested as (
    select item."productId" as product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item("productId" uuid, quantity integer)
    group by item."productId"
  )
  select count(*)::integer, coalesce(sum(product.price * requested.quantity), 0)::numeric(12, 2)
  into matched_count, order_total
  from requested
  join public.products as product
    on product.id = requested.product_id
    and product.company_id = p_company_id
    and product.is_active = true;

  if matched_count <> requested_count then
    raise exception 'One or more products are unavailable.' using errcode = 'P0002';
  end if;

  if order_total < 0 or order_total > 99999999.99 then
    raise exception 'Order total is outside the supported range.' using errcode = '22003';
  end if;

  insert into public.customers (company_id, full_name, email)
  values (p_company_id, btrim(p_full_name), lower(btrim(p_email)))
  on conflict (company_id, email) do update
    set full_name = excluded.full_name
  returning id into customer_id;

  insert into public.orders (
    company_id, customer_id, status, total, checkout_request_key, checkout_request_hash
  )
  values (p_company_id, customer_id, 'pending', order_total, p_request_key, p_request_hash)
  on conflict (company_id, checkout_request_key)
    where checkout_request_key is not null
    do nothing
  returning id, created_at into created_order_id, created_order_created_at;

  if created_order_id is null then
    select existing.id, existing.checkout_request_hash, existing.total, existing.created_at
    into created_order_id, existing_hash, order_total, created_order_created_at
    from public.orders as existing
    where existing.company_id = p_company_id
      and existing.checkout_request_key = p_request_key;

    if existing_hash is distinct from p_request_hash then
      raise exception 'Idempotency key was already used for a different request.' using errcode = '23505';
    end if;

    return query select created_order_id, order_total, false, created_order_created_at;
    return;
  end if;

  insert into public.order_details (order_id, product_id, quantity, unit_price)
  select created_order_id, product.id, requested.quantity, product.price
  from (
    select item."productId" as product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item("productId" uuid, quantity integer)
    group by item."productId"
  ) as requested
  join public.products as product
    on product.id = requested.product_id
    and product.company_id = p_company_id
    and product.is_active = true;

  return query select created_order_id, order_total, true, created_order_created_at;
end;
$$;

revoke all on function public.create_checkout_order(uuid, text, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.create_checkout_order(uuid, text, text, jsonb, uuid, text) to service_role;

create or replace function public.update_order_with_details(
  p_company_id uuid,
  p_order_id uuid,
  p_status text,
  p_license_keys jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  previous_status text;
  delivery_time timestamptz;
  updated_detail_count integer;
begin
  select order_row.status, order_row.delivered_at
  into previous_status, delivery_time
  from public.orders as order_row
  where order_row.id = p_order_id
    and order_row.company_id = p_company_id
  for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  if p_status not in ('pending', 'paid', 'delivered', 'cancelled', 'refunded') then
    raise exception 'Invalid order status.' using errcode = '22023';
  end if;

  if not (
    previous_status = p_status
    or (previous_status = 'pending' and p_status in ('paid', 'cancelled'))
    or (previous_status = 'paid' and p_status in ('delivered', 'refunded'))
    or (previous_status = 'delivered' and p_status = 'refunded')
  ) then
    raise exception 'Invalid order status transition.' using errcode = '23514';
  end if;

  if p_license_keys is null or jsonb_typeof(p_license_keys) <> 'array' or jsonb_array_length(p_license_keys) > 20 then
    raise exception 'Invalid license keys.' using errcode = '22023';
  end if;

  update public.orders as order_row
  set status = p_status,
      delivered_at = case
        when p_status = 'delivered' then coalesce(delivery_time, clock_timestamp())
        else delivery_time
      end
  where order_row.id = p_order_id
    and order_row.company_id = p_company_id
  returning order_row.delivered_at into delivery_time;

  update public.order_details as detail
  set license_key = nullif(left(btrim(coalesce(item."licenseKey", '')), 500), '')
  from jsonb_to_recordset(p_license_keys) as item("detailId" uuid, "licenseKey" text)
  where detail.id = item."detailId"
    and detail.order_id = p_order_id;
  get diagnostics updated_detail_count = row_count;

  if updated_detail_count <> jsonb_array_length(p_license_keys) then
    raise exception 'One or more order details were not found.' using errcode = 'P0002';
  end if;

  if p_status = 'delivered' and previous_status <> 'delivered' then
    update public.order_details as detail
    set download_expires_at = delivery_time + interval '30 days'
    where detail.order_id = p_order_id;
  end if;
end;
$$;

revoke all on function public.update_order_with_details(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_order_with_details(uuid, uuid, text, jsonb) to service_role;

create or replace function public.register_staff_member(
  p_company_id uuid,
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assigned_role_id public.roles.id%type;
begin
  perform 1 from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;

  if p_full_name is null or length(btrim(p_full_name)) < 2 or length(p_full_name) > 120
    or p_email is null or length(p_email) > 254 then
    raise exception 'Invalid staff details.' using errcode = '22023';
  end if;

  select id into assigned_role_id from public.roles where name = p_role_name;
  if assigned_role_id is null or p_role_name not in ('admin', 'seller', 'support') then
    raise exception 'Invalid staff role.' using errcode = '22023';
  end if;

  insert into public.users (id, company_id, full_name, email, is_active)
  values (p_user_id, p_company_id, btrim(p_full_name), lower(btrim(p_email)), true);

  insert into public.user_roles (user_id, role_id)
  values (p_user_id, assigned_role_id);
end;
$$;

revoke all on function public.register_staff_member(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.register_staff_member(uuid, uuid, text, text, text) to service_role;

create or replace function public.update_staff_access(
  p_company_id uuid,
  p_user_id uuid,
  p_role_name text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_is_active boolean;
  target_is_admin boolean;
  admin_role_id public.roles.id%type;
  new_role_id public.roles.id%type;
  active_admin_count integer;
begin
  perform 1 from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;

  select user_row.is_active into target_is_active
  from public.users as user_row
  where user_row.id = p_user_id and user_row.company_id = p_company_id
  for update;
  if not found then
    raise exception 'Staff member not found.' using errcode = 'P0002';
  end if;

  select id into new_role_id from public.roles where name = p_role_name;
  select id into admin_role_id from public.roles where name = 'admin';
  if new_role_id is null or admin_role_id is null or p_role_name not in ('admin', 'seller', 'support') then
    raise exception 'Invalid staff role.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.user_roles where user_id = p_user_id and role_id = admin_role_id
  ) into target_is_admin;

  if target_is_active and target_is_admin and (not p_is_active or p_role_name <> 'admin') then
    select count(distinct user_row.id)::integer into active_admin_count
    from public.users as user_row
    join public.user_roles as assignment on assignment.user_id = user_row.id
    where user_row.company_id = p_company_id
      and user_row.is_active = true
      and assignment.role_id = admin_role_id;

    if active_admin_count <= 1 then
      raise exception 'At least one active admin must remain.' using errcode = '23514';
    end if;
  end if;

  update public.users set is_active = p_is_active
  where id = p_user_id and company_id = p_company_id;
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role_id) values (p_user_id, new_role_id);
end;
$$;

revoke all on function public.update_staff_access(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.update_staff_access(uuid, uuid, text, boolean) to service_role;

commit;

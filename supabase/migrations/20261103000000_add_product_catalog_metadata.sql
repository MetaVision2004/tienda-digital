begin;

alter table public.products
	add column if not exists image_url text,
	add column if not exists slug text,
	add column if not exists compare_at_price numeric(10, 2),
	add column if not exists is_featured boolean not null default false,
	add column if not exists is_new boolean not null default false;

with slug_bases as (
	select
		id,
		company_id,
		coalesce(
			nullif(
				trim(both '-' from regexp_replace(
					translate(lower(name), 'áéíóúüñ', 'aeiouun'),
					'[^a-z0-9]+',
					'-',
					'g'
				)),
				''
			),
			'producto'
		) as base_slug
	from public.products
),
numbered_slugs as (
	select
		id,
		base_slug,
		row_number() over (partition by company_id, base_slug order by id) as position
	from slug_bases
)
update public.products as product
set slug = case
	when numbered_slugs.position = 1 then numbered_slugs.base_slug
	else numbered_slugs.base_slug || '-' || numbered_slugs.position::text
end
from numbered_slugs
where product.id = numbered_slugs.id
	and product.slug is null;

alter table public.products alter column slug set not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'products_compare_at_price_gt_price'
			and conrelid = 'public.products'::regclass
	) then
		alter table public.products
			add constraint products_compare_at_price_gt_price
			check (compare_at_price is null or compare_at_price > price);
	end if;
end
$$;

create unique index if not exists products_company_slug_key
	on public.products (company_id, slug);

create index if not exists products_company_catalog_order_idx
	on public.products (company_id, is_featured desc, is_new desc, created_at desc);

commit;
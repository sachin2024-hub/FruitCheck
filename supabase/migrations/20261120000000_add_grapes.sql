-- Adds grapes so scans of grapes_ripe / grapes_unripe can be saved. Run once in the Supabase SQL editor.
insert into public.fruit_types (slug, display_name) values ('grapes', 'Grapes')
on conflict (slug) do update set display_name = excluded.display_name;

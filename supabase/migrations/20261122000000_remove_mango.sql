-- Mango is no longer a supported fruit. Hide it from new scans but keep old scan history intact.
update public.fruit_types set is_active = false where slug = 'mango';

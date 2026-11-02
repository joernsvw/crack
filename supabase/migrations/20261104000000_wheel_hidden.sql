-- Rezepte lassen sich aus dem Gluecksrad ausblenden. Das gilt fuer den ganzen Haushalt.
alter table public.recipes add column wheel_hidden boolean not null default false;

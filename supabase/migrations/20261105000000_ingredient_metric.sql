-- Umrechnung neben der Originalangabe, zum Beispiel "1 cup" und daneben "≈ 120 g".
alter table public.recipe_ingredients add column metric text check (metric is null or char_length(metric) <= 40);

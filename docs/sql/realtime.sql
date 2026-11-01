-- Matcha POS · bật Supabase Realtime cho các bảng nghiệp vụ
-- Chạy 1 lần trong Supabase → SQL Editor → New query → Run
do $$
declare t text;
begin
  foreach t in array array[
    'orders','order_items','payments','order_events',
    'deliveries','delivery_events',
    'inventory_stock','inventory_txns','customers','shifts','print_jobs'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;

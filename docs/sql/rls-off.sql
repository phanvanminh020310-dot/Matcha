-- ============================================================================
-- Matcha POS · TẮT siết RLS (quay lại trạng thái mở hoàn toàn)
-- CHỈ dùng khi thử nghiệm / khi mất hết mã thiết bị.
-- Ai có anon key cũng ghi & xoá được dữ liệu ⇒ đừng giữ lâu ở trạng thái này.
-- ============================================================================
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'sync_tokens'
  loop
    execute format('drop policy if exists %I on public.%I', 'matcha_read_' || t.relname, t.relname);
    execute format('drop policy if exists %I on public.%I', 'matcha_ins_' || t.relname, t.relname);
    execute format('drop policy if exists %I on public.%I', 'matcha_upd_' || t.relname, t.relname);
    execute format('drop policy if exists %I on public.%I', 'matcha_del_' || t.relname, t.relname);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
                   'matcha_all_' || t.relname, t.relname);
  end loop;
end $$;

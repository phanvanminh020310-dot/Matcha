-- ============================================================================
-- Matcha POS · SIẾT ROW LEVEL SECURITY (RLS)
-- Mục tiêu: anon key nằm trong bundle JS (ai mở web cũng thấy) nên KHÔNG được
--           phép ghi/xoá dữ liệu. Mọi thao tác ghi phải kèm "mã thiết bị" bí mật
--           (sync token) — gửi qua header HTTP `x-sync-token`.
--
-- Chạy 1 lần trong Supabase → SQL Editor → dán → Run.
-- Chạy lại nhiều lần vẫn an toàn (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Bảng chứa các mã thiết bị (chỉ lưu SHA-256, không lưu mã gốc)
-- ---------------------------------------------------------------------------
create table if not exists public.sync_tokens (
  id         text primary key default substr(encode(sha256(convert_to(clock_timestamp()::text || random()::text, 'utf8')), 'hex'), 1, 12),
  label      text not null default 'Thiết bị',
  token_hash text not null unique,
  branch_id  bigint references public.branches(id) on delete set null,
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.sync_tokens enable row level security;
-- Không tạo policy nào + thu hồi quyền ⇒ anon/authenticated không đọc, không ghi được.
revoke all on public.sync_tokens from anon, authenticated;
revoke all on public.sync_tokens from public;

-- ---------------------------------------------------------------------------
-- 2. Hàm kiểm tra mã thiết bị (SECURITY DEFINER ⇒ đọc được bảng trên)
-- ---------------------------------------------------------------------------
create or replace function public.sync_ok() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sync_tokens t
    where t.active
      and t.token_hash = encode(sha256(convert_to(
            coalesce(current_setting('request.headers', true)::json ->> 'x-sync-token', ''), 'utf8')), 'hex')
  );
$$;

-- Chi nhánh mà mã thiết bị được phép ghi. NULL = toàn chuỗi.
create or replace function public.sync_branch() returns bigint
language sql stable security definer set search_path = public, pg_temp as $$
  select t.branch_id from public.sync_tokens t
  where t.active
    and t.token_hash = encode(sha256(convert_to(
          coalesce(current_setting('request.headers', true)::json ->> 'x-sync-token', ''), 'utf8')), 'hex')
  limit 1;
$$;

grant execute on function public.sync_ok() to anon, authenticated;
grant execute on function public.sync_branch() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Mã CHỈ ĐỌC (can_write = false) — dùng để gửi link cho người ngoài xem
-- ---------------------------------------------------------------------------
alter table public.sync_tokens add column if not exists can_write boolean not null default true;

create or replace function public.sync_write_ok() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sync_tokens t
    where t.active and t.can_write
      and t.token_hash = encode(sha256(convert_to(
            coalesce(current_setting('request.headers', true)::json ->> 'x-sync-token', ''), 'utf8')), 'hex')
  );
$$;
grant execute on function public.sync_write_ok() to anon, authenticated;

-- Cấp mã mới từ app (chỉ máy đang có mã GHI được mới cấp được).
-- p_can_write = false  → mã chỉ đọc (an toàn để chia sẻ link)
create or replace function public.create_share_token(p_label text, p_can_write boolean default false)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_token text;
begin
  if not public.sync_write_ok() then
    raise exception 'Chỉ thiết bị có mã GHI được mới cấp được mã mới';
  end if;
  v_token := 'mk_' || encode(sha256(convert_to(random()::text || clock_timestamp()::text || coalesce(p_label, ''), 'utf8')), 'hex');
  insert into public.sync_tokens (label, token_hash, can_write, note)
  values (coalesce(nullif(p_label, ''), 'Thiết bị chia sẻ'), encode(sha256(convert_to(v_token, 'utf8')), 'hex'), coalesce(p_can_write, false), 'cấp từ app');
  return v_token;
end $$;
grant execute on function public.create_share_token(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policy cho các bảng nghiệp vụ
--    • ĐỌC  : 11 bảng có realtime → mở cho anon (Supabase Realtime cần quyền SELECT
--             để bắn sự kiện). Các bảng còn lại (users, kho, tài chính…) → cần mã.
--    • GHI  : cần mã có quyền GHI (can_write = true); bảng có cột branch_id thì mã phải đúng chi nhánh.
--             Mã chỉ đọc (tạo bằng create_share_token(..., false)) đọc được nhưng ghi bị chặn.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
  has_branch boolean;
  wcheck text;
  rt_tables text[] := array['customers','deliveries','delivery_events','inventory_stock','inventory_txns',
                            'order_events','order_items','orders','payments','print_jobs','shifts'];
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'sync_tokens'
    order by c.relname
  loop
    select exists (
      select 1 from pg_attribute a
      where a.attrelid = format('public.%I', t.relname)::regclass
        and a.attname = 'branch_id' and a.attnum > 0 and not a.attisdropped
    ) into has_branch;

    wcheck := case when has_branch
      then 'public.sync_write_ok() and (public.sync_branch() is null or branch_id = public.sync_branch())'
      else 'public.sync_write_ok()' end;

    execute format('alter table public.%I enable row level security', t.relname);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t.relname);

    -- bỏ policy mở cũ
    execute format('drop policy if exists %I on public.%I', 'matcha_all_' || t.relname, t.relname);

    -- đọc
    execute format('drop policy if exists %I on public.%I', 'matcha_read_' || t.relname, t.relname);
    if t.relname = any(rt_tables) then
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                     'matcha_read_' || t.relname, t.relname);
    else
      execute format('create policy %I on public.%I for select to anon, authenticated using (public.sync_ok())',
                     'matcha_read_' || t.relname, t.relname);
    end if;

    -- ghi: thêm / sửa / xoá
    execute format('drop policy if exists %I on public.%I', 'matcha_ins_' || t.relname, t.relname);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (%s)',
                   'matcha_ins_' || t.relname, t.relname, wcheck);

    execute format('drop policy if exists %I on public.%I', 'matcha_upd_' || t.relname, t.relname);
    execute format('create policy %I on public.%I for update to anon, authenticated using (%s) with check (%s)',
                   'matcha_upd_' || t.relname, t.relname, wcheck, wcheck);

    execute format('drop policy if exists %I on public.%I', 'matcha_del_' || t.relname, t.relname);
    execute format('create policy %I on public.%I for delete to anon, authenticated using (%s)',
                   'matcha_del_' || t.relname, t.relname, wcheck);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tạo mã thiết bị — mẫu (thay chuỗi mk_... bằng mã bạn muốn dùng)
--    Mã gốc PHẢI lưu ở máy/niêm yết riêng; DB chỉ giữ hash.
-- ---------------------------------------------------------------------------
-- insert into public.sync_tokens (label, token_hash, branch_id, note) values (
--   'Máy quản lý chuỗi',
--   encode(sha256(convert_to('mk_THAY_MA_CUA_BAN', 'utf8')), 'hex'),
--   null,                      -- null = toàn chuỗi; 1 = chỉ ghi được chi nhánh id 1
--   'máy chính'
-- );

-- Thu hồi 1 thiết bị bị mất:
-- update public.sync_tokens set active = false where label = 'Máy quản lý chuỗi';

-- ---------------------------------------------------------------------------
-- 5. Kiểm tra
-- ---------------------------------------------------------------------------
select t.tablename,
       t.policyname,
       t.cmd
from pg_policies t
where t.schemaname = 'public'
order by t.tablename, t.cmd, t.policyname;

# Hướng dẫn bật CSDL Postgres thật (Supabase) cho Matcha POS

> Mục tiêu: đưa 33 bảng + ~60.000 dòng dữ liệu từ trình duyệt lên **Postgres thật** (Supabase free tier), sau đó nhiều máy/many người dùng chung một CSDL.
> Thời gian: **10–15 phút**. Chi phí: **0 ₫** (gói Free, không cần thẻ).
> Bạn chỉ cần làm các bước B1–B6, cuối cùng copy 2 giá trị gửi lại cho tôi là xong. B8 (realtime) và B9 (siết quyền ghi) làm sau, mỗi bước ~3 phút.

---

## Checklist nhanh

- [ ] B1. Tạo tài khoản Supabase
- [ ] B2. Tạo project, chọn region **Southeast Asia (Singapore)**
- [ ] B3. Copy **Project URL** + **anon key**
- [ ] B4. Dán vào app → *Kiểm tra kết nối*
- [ ] B5. Tải `schema.sql` → dán vào **SQL Editor** → **Run**
- [ ] B6. Bấm **Đẩy dữ liệu lên** → kiểm tra ~60.854 dòng đã sang Postgres
- [ ] B7. Gửi lại cho tôi `Project URL` + `anon key` để tôi kiểm thử đồng bộ 2 máy
- [ ] B8. Chạy `realtime.sql` → app báo khi máy khác sửa dữ liệu
- [ ] B9. Chạy `rls.sql` + cấp **mã đồng bộ** → chỉ thiết bị có mã mới ghi được

---

## B1. Tạo tài khoản (1 phút)

1. Mở **https://supabase.com** → bấm **Start your project** (góc phải trên).
2. Đăng ký bằng **GitHub** (nhanh nhất) hoặc Google/email + mật khẩu.
3. Nếu đăng ký bằng email: mở hộp thư, bấm link xác nhận.

> Không cần nhập thẻ tín dụng. Gói Free: 2 project, 500 MB database, project tự “ngủ” sau 7 ngày không dùng (vào dashboard bấm *Restore* là tỉnh lại, dữ liệu còn nguyên).

---

## B2. Tạo project (2–3 phút)

1. Trong dashboard bấm **New project**.
2. Điền:
   | Ô | Giá trị nên chọn |
   | --- | --- |
   | Organization | để mặc định (tên tài khoản của bạn) |
   | **Project name** | `matcha-pos` |
   | **Database Password** | bấm **Generate a password** → **copy và lưu lại** (dùng khi cần truy cập DB trực tiếp, không dùng cho app) |
   | **Region** | **Southeast Asia (Singapore)** — gần Việt Nam nhất, độ trễ thấp |
   | Plan | **Free** |
3. Khối **Security** (màn hình mới của Supabase) — chọn như sau:

   | Tuỳ chọn | Chọn | Vì sao |
   | --- | --- | --- |
   | **Enable Data API** | ✅ **giữ tick (bắt buộc)** | App gọi dữ liệu qua REST API (PostgREST). Bỏ tick là app không kết nối được. |
   | **Automatically expose new tables** | ❌ **bỏ tick** | `schema.sql` của Matcha đã `GRANT` tường minh cho `anon`/`authenticated`, nên không cần expose tự động (nguyên tắc quyền tối thiểu). |
   | **Enable automatic RLS** | ✅ tick (khuyến nghị) | Bật RLS tự động cho bảng mới — trùng với phần RLS có sẵn trong `schema.sql`, không xung đột, an toàn hơn. |

   Khối **GitHub (optional)** và **ADVANCED CONFIGURATION**: để trống, không cần.

4. Bấm **Create new project** và đợi thanh *Setting up project…* chạy xong (~2 phút, sẽ tự chuyển vào project).

---

## B3. Lấy Project URL + anon key (1 phút)

Trong project vừa tạo:

1. Bấm biểu tượng **⚙️ Project Settings** (thanh bên trái, dưới cùng) → chọn **API**.
2. Ở khối **Project URL**, bấm **Copy**. Dạng:
   ```
   https://abcdefghijklmnop.supabase.co
   ```
3. Ở khối **Project API keys**, tìm dòng **`anon` / `public`** (chuỗi rất dài bắt đầu bằng `eyJhbGciOiJIUzI1NiIs…`) → bấm **Copy**.
   - Giao diện mới có tab **Publishable and secret API keys**: key `sb_publishable_…` dùng được (app gửi qua header `apikey`). Tab **Legacy anon, service_role API keys** → dòng `anon` `public` (`eyJ…`) là phương án tương thích cao nhất nếu gặp 401.
   - **Tuyệt đối không dùng** `service_role` / `secret` key cho app chạy trên trình duyệt (nó bỏ qua mọi phân quyền).

> 2 giá trị này là thứ duy nhất app cần. Chúng chỉ được lưu trong `localStorage` của máy bạn, không gửi đi đâu khác.

---

## B4. Dán vào app và kiểm tra (1 phút)

1. Mở app: **https://phanvanminh020310-dot.github.io/Matcha/**
2. Đăng nhập: `owner@matcha.vn` / `123456`
3. Menu trái → **Cài đặt** → tab **Cơ sở dữ liệu**
4. Dán **Project URL** vào ô *Project URL*, dán **anon key** vào ô *Anon / service key*
5. Bấm **Kiểm tra kết nối**

Kết quả mong đợi ở bước này:
> ⚠️ Kết nối được, nhưng chưa có bảng — hãy chạy file schema.sql trước

Đó là **bình thường** (project mới chưa có bảng). Nếu thấy *401/403* → key dán sai/thiếu ký tự (xem mục Xử lý sự cố bên dưới).

---

## B5. Tạo 33 bảng trên Postgres (2 phút)

1. Trong app, bấm **schema.sql (33 bảng + RLS)** để tải file. (Hoặc bấm *Copy schema* rồi bỏ qua bước copy dưới.)
2. Sang Supabase → thanh trái chọn **SQL Editor** → **New query**.
3. Mở file `matcha-schema.sql` bằng Notepad/TextEdit → **Ctrl+A, Ctrl+C** toàn bộ → dán vào ô SQL.
4. Bấm **Run** (Ctrl+Enter).

Kết quả mong đợi: dòng chữ xanh **“Success. No rows returned”**.

File này tạo:
- 33 bảng + khoá ngoại + chỉ mục (`orders`, `order_items`, `inventory_txns`, `deliveries`, `print_templates`…)
- Bật **RLS** và policy cho role `anon`, `authenticated` + `GRANT` quyền
- Dùng `CREATE TABLE IF NOT EXISTS` nên **chạy lại nhiều lần không lỗi**

Quay lại app → bấm **Kiểm tra kết nối** lần nữa, mong đợi:
> ✅ Kết nối tốt · bảng branches có 0 dòng mẫu

---

## B6. Đẩy dữ liệu thật lên Postgres (2–5 phút)

1. Trong app (tab *Cơ sở dữ liệu*) bấm **Đẩy dữ liệu lên**.
2. Xem thanh tiến trình chạy qua 33 bảng (ví dụ: `orders 4.127`, `order_items 12.4xx`, `inventory_txns 22.0xx`…).
3. Xong sẽ hiện toast: **“Đã đẩy dữ liệu lên Postgres · 60.854 dòng”** và dòng *Lần đồng bộ cuối*.

Kiểm chứng trên Supabase:
- **Table Editor** → chọn `orders` → số dòng phải ≈ 4.1xx
- `products` ≈ 40–50 · `deliveries` ≈ 48 · `print_templates` = 6 · `bank_accounts` = 3
- **SQL Editor** chạy thử:
  ```sql
  select count(*) as don, sum(total) as doanh_thu from orders where status <> 'cancelled';
  select * from deliveries order by id desc limit 5;
  ```

---

## B7. Dùng nhiều máy (tuỳ chọn nhưng nên làm)

1. Trên máy thứ 2 (hoặc cửa sổ ẩn danh): mở app → đăng nhập → **Cài đặt → Cơ sở dữ liệu** → dán **đúng URL + key** (+ **Mã đồng bộ**, xem B9) → bật **Tự tải dữ liệu từ cloud khi mở app** → bấm **Tải từ cloud**.
2. App sẽ kéo toàn bộ dữ liệu (phân trang 500 dòng/lần) rồi tự tải lại trang — dữ liệu giống hệt máy 1.
3. Từ lần sau, mỗi lần mở app ở máy đã bật công tắc này, dữ liệu mới nhất được tự kéo về.
4. Các máy khác **ghi dữ liệu** thì bấm **Đẩy dữ liệu lên** (UPSERT theo khoá chính — không bao giờ xoá dữ liệu cloud trước khi ghi, đứt mạng giữa chừng vẫn an toàn).

> Cách hoạt động: app ghi vào SQLite trong máy cho nhanh, rồi đẩy/kéo với Postgres. *Đẩy* = UPSERT theo khoá chính; *Xoá & đẩy lại* chỉ dùng khi cloud bị lệch hẳn.

---

## B8. Bật realtime — máy khác sửa là app báo ngay (2 phút)

1. Supabase → **SQL Editor** → **New query** → dán toàn bộ nội dung **`docs/sql/realtime.sql`** (hoặc bấm nút **realtime.sql** trong Cài đặt để tải file) → **Run**.
2. Kiểm tra: câu `select` cuối file phải trả về **11 bảng** (`orders, order_items, payments, order_events, deliveries, delivery_events, inventory_stock, inventory_txns, customers, shifts, print_jobs`).
3. Trong app: **Cài đặt → Cơ sở dữ liệu** → bật **Theo dõi thay đổi realtime** (mặc định đã bật) → badge góc dưới phải hiện `realtime` màu xanh.
4. Thử: mở app ở 2 máy → máy A tạo/sửa 1 đơn → máy B hiện banner **“Có thay đổi mới từ cloud”** kèm nút **Đồng bộ ngay**.

> Realtime chỉ *báo có thay đổi*; dữ liệu vẫn được kéo về khi bấm **Đồng bộ ngay** (hoặc lần mở app kế tiếp). App bỏ qua sự kiện trong 15 giây sau lần tự đồng bộ của chính nó để không báo lung tung.

---

## B9. Siết quyền ghi bằng “Mã đồng bộ” (RLS) — nên làm (3 phút)

Vì sao cần: `anon key` nằm trong mã nguồn web, **ai mở web cũng thấy**. Không có RLS thì người lạ có key có thể xoá sạch dữ liệu. Sau bước này, mọi lệnh ghi phải kèm **mã thiết bị** bí mật.

1. Supabase → **SQL Editor** → dán **`docs/sql/rls.sql`** → **Run**. (Chạy lại nhiều lần vô hại.)
2. Cấp mã cho thiết bị — dán vào SQL Editor, thay `mk_...` bằng mã bạn muốn (tối thiểu 24 ký tự):

   ```sql
   insert into public.sync_tokens (label, token_hash, branch_id, note) values (
     'Máy quản lý chuỗi',
     encode(sha256(convert_to('mk_THAY_MA_CUA_BAN', 'utf8')), 'hex'),
     null,          -- null = ghi được mọi chi nhánh; 1 = chỉ chi nhánh id 1
     'máy chính'
   );
   ```
3. Trong app: **Cài đặt → Cơ sở dữ liệu** → dán mã vào ô **Mã đồng bộ (sync token)** → **Kiểm tra kết nối** → phải thấy `Kết nối tốt … · quyền ghi: OK`.
4. Làm tương tự trên từng máy/trình duyệt (mã có thể dùng chung hoặc cấp riêng từng máy).

| Tình huống | Kết quả sau khi bật RLS |
| --- | --- |
| Đọc `orders`, `customers`, `deliveries`… (11 bảng realtime) | Vẫn đọc được bằng anon key — **bắt buộc**, vì Supabase Realtime cần quyền SELECT để bắn sự kiện |
| Đọc `users`, kho, tài chính… | **Cần mã đồng bộ** |
| Thêm / sửa / xoá bất kỳ bảng nào | **Luôn cần mã**; sai/thiếu mã → `new row violates row-level security policy` |
| Mã có `branch_id = 1` | Chỉ ghi được dòng của chi nhánh 1 (bảng có cột `branch_id`) |
| Mất mã / muốn thu hồi | Cấp mã mới, hoặc `update public.sync_tokens set active = false where label = '...'` |
| Muốn tạm quay lại trạng thái mở | Chạy `docs/sql/rls-off.sql` (chỉ khi thử nghiệm) |

**Nâng cấp tiếp (tuỳ chọn, khi cần chặn cả quyền đọc theo người dùng):** bật **Supabase Auth**, tắt *Confirm email*, tạo bảng `app_members(uid uuid, branch_id bigint, role text)` ánh xạ `auth.uid()`, rồi đổi policy sang `auth.uid()`/`branch_id`. App đã sẵn chỗ nhập token nên chỉ cần thêm bước đăng nhập cloud — nói tôi biết là tôi làm tiếp.

---

## Gửi lại cho tôi

Copy 2 dòng này (che bớt 6 ký tự cuối của key cũng được):

```
PROJECT_URL = https://________________.supabase.co
ANON_KEY    = eyJhbGciOiJIUzI1NiIsInR5cCI6...   (hoặc sb_publishable_...)
```

Tôi sẽ: kiểm tra kết nối từ phía tôi (nếu bạn muốn), chạy kiểm thử đồng bộ 2 máy, rà lại RLS/policy, và thêm phần **Supabase Auth + realtime** nếu bạn muốn nhiều người dùng thật.

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách sửa |
| --- | --- |
| **401 / 403 khi Kiểm tra kết nối** | Key sai/thiếu ký tự (copy bị cắt), hoặc đang dùng `service_role`. Copy lại đúng dòng **anon public**; xoá hết khoảng trắng đầu/cuối (app đã tự cắt khi lưu). |
| **URL không đúng** | Phải có `https://` và kết thúc bằng `.supabase.co` — không thêm `/rest/v1`. |
| **“Bảng branches lỗi HTTP 404”** | Chưa chạy `schema.sql` (B5), hoặc chạy vào project khác. |
| **SQL Editor báo `relation "orders" already exists`** | Bạn đang dùng bản schema cũ; bản hiện tại có `IF NOT EXISTS` nên chạy lại vô hại. Nếu vẫn lỗi, bấm *Copy schema* từ app để lấy bản mới nhất. |
| **`new row violates row-level security policy`** | Policy chưa được tạo — chạy lại schema (phần RLS ở cuối file), hoặc kiểm tra `select tablename, policyname from pg_policies where schemaname='public';` |
| **Đẩy dữ liệu bị dừng giữa chừng** | Xem bảng nào trong thanh tiến trình → thường do khoá ngoại (ví dụ bảng con trước bảng cha): app đẩy đúng thứ tự, chỉ cần bấm lại; mỗi bảng được xoá trước khi ghi nên chạy lại an toàn. |
| **Tải từ cloud chỉ được 1.000 dòng** | Bản app mới đã phân trang 500 dòng/lần; nhớ **Ctrl+F5** để lấy bản mới (bản cũ cache trong trình duyệt). |
| **Project “Paused”** | Gói Free tự ngủ sau 7 ngày không truy cập → vào dashboard bấm **Restore project** (dữ liệu giữ nguyên). |
| **SQL Editor báo file quá lớn khi dán `seed.sql`** | Đừng dán `seed.sql` (6 MB). Dùng nút **Đẩy dữ liệu lên** trong app (nhanh hơn, có tiến trình). `seed.sql` chỉ để backup/khôi phục bằng `psql`. |
| **Mạng công ty chặn `*.supabase.co`** | Thử mạng khác/4G; hoặc dùng Neon (Postgres thuần) — app chỉ cần URL PostgREST, xem ghi chú dưới. |

---

## Ghi chú bảo mật (đọc 30 giây)

- `anon` key **được thiết kế để công khai** trong trình duyệt; thứ bảo vệ dữ liệu là **RLS**.
- Trạng thái hiện tại của project Matcha:
  - Đã chạy **`rls.sql`** ⇒ mọi thao tác **ghi** cần header `x-sync-token` khớp SHA-256 trong bảng `sync_tokens`; thiếu/sai mã bị chặn (`HTTP 401` / 0 dòng bị ảnh hưởng).
  - **Đọc** 11 bảng phục vụ realtime vẫn mở bằng anon key (Supabase Realtime cần quyền SELECT); các bảng còn lại yêu cầu mã.
  - Mã gốc **không lưu trên cloud**, không nằm trong repo — chỉ nằm trong ô *Mã đồng bộ* của từng máy. Mất máy → `update sync_tokens set active=false`.
- Nếu cần chặt hơn nữa (chặn cả quyền đọc, phân quyền theo người/chi nhánh): bật **Supabase Auth** + ánh xạ `auth.uid()` (xem cuối B9), hoặc gọi qua **Edge Function** giữ service key ở server.
- Không commit key vào GitHub, không gửi key vào nhóm chat công khai. Với **mã đồng bộ** cũng vậy.

## Muốn dùng Neon / Postgres khác?

App gọi REST kiểu **PostgREST** nên Supabase là thuận nhất. Với Neon, cần thêm PostgREST phía trước (Neon không tự có REST API) — nếu bạn thích hướng này, tôi có thể viết thêm adapter kết nối trực tiếp qua `pg` + một Edge Function nhỏ.

---

## 10. Máy thứ 2, thứ 3… (thu ngân, laptop quản lý) — quan trọng nhất

Mỗi máy có CSDL riêng dưới trình duyệt. Muốn máy mới **thấy đúng dữ liệu trên cloud**:

1. Mở app trên máy mới → đăng nhập.
2. Vào **Cài đặt → Cơ sở dữ liệu**, dán 3 thứ: `Project URL`, `anon key`, `Mã đồng bộ (mk_…)`.
3. Bấm **“Kết nối & tải toàn bộ dữ liệu”** (nút lớn ở cột phải).
   → App kiểm tra kết nối, tải **toàn bộ** dữ liệu Postgres về máy, rồi **bật tự đồng bộ khi mở app**.
4. Kiểm chứng: bấm **“Đối chiếu máy này ↔ cloud”** → phải hiện *Khớp hoàn toàn*. Nếu còn bảng lệch, bấm lại nút kết nối.

Lưu ý:

- Máy đã cấu hình mà **chưa từng tải** → app tự tải ngay lần mở đầu tiên (không cần bật gì).
- “Kết nối & tải toàn bộ” **không ghi đè** dữ liệu cloud; muốn đẩy từ máy này lên thì bấm **Đẩy dữ liệu lên**.
- Đồng bộ chỉ ghi đè bảng nào **cloud có dữ liệu**; bảng cloud rỗng thì app giữ nguyên dữ liệu trên máy (chống mất dữ liệu).
- Máy tài xế: mở `#/driver` trên điện thoại (HTTPS) → **Bật chia sẻ vị trí** để phát GPS thật lên bảng `driver_positions`.

# Hướng dẫn bật CSDL Postgres thật (Supabase) cho Matcha POS

> Mục tiêu: đưa 33 bảng + ~60.000 dòng dữ liệu từ trình duyệt lên **Postgres thật** (Supabase free tier), sau đó nhiều máy/many người dùng chung một CSDL.
> Thời gian: **10–15 phút**. Chi phí: **0 ₫** (gói Free, không cần thẻ).
> Bạn chỉ cần làm 6 bước dưới đây, cuối cùng copy 2 giá trị gửi lại cho tôi là xong.

---

## Checklist nhanh

- [ ] B1. Tạo tài khoản Supabase
- [ ] B2. Tạo project, chọn region **Southeast Asia (Singapore)**
- [ ] B3. Copy **Project URL** + **anon key**
- [ ] B4. Dán vào app → *Kiểm tra kết nối*
- [ ] B5. Tải `schema.sql` → dán vào **SQL Editor** → **Run**
- [ ] B6. Bấm **Đẩy dữ liệu lên** → kiểm tra ~60.854 dòng đã sang Postgres
- [ ] B7. Gửi lại cho tôi `Project URL` + `anon key` để tôi kiểm thử đồng bộ 2 máy

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

1. Trên máy thứ 2 (hoặc cửa sổ ẩn danh): mở app → đăng nhập → **Cài đặt → Cơ sở dữ liệu** → dán **đúng URL + key** → bật **Tự tải dữ liệu từ cloud khi mở app** → bấm **Tải từ cloud**.
2. App sẽ kéo toàn bộ dữ liệu (phân trang 500 dòng/lần) rồi tự tải lại trang — dữ liệu giống hệt máy 1.
3. Từ lần sau, mỗi lần mở app ở máy đã bật công tắc này, dữ liệu mới nhất được tự kéo về.

> Cách hoạt động (nói rõ để bạn không bất ngờ): app vẫn ghi vào SQLite trong máy cho nhanh, **mỗi lần bấm “Đẩy dữ liệu lên” là ghi đè toàn bộ snapshot lên Postgres**. Vì vậy hãy chọn **một máy làm máy chính** để đẩy; máy khác chỉ *Tải từ cloud*. Muốn nhiều máy cùng ghi realtime thì cần backend + Supabase Auth (tôi làm tiếp được nếu bạn cần).

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

- `anon` key **được thiết kế để công khai** trong trình duyệt; thứ bảo vệ dữ liệu là **RLS**. Bản schema này đặt policy mở (`USING (true)`) để app demo chạy được ngay ⇒ **ai có URL + key đều đọc/ghi được**.
- Khi đưa vào vận hành thật, nên:
  1. Bật **Supabase Auth**, đổi policy sang dạng `auth.uid() = user_id` / theo `branch_id`, hoặc chỉ cho `authenticated`.
  2. Hoặc chuyển sang gọi qua **Edge Function** (service key nằm ở server, không bao giờ xuống trình duyệt).
- Không commit key vào GitHub, không gửi key vào nhóm chat công khai.

## Muốn dùng Neon / Postgres khác?

App gọi REST kiểu **PostgREST** nên Supabase là thuận nhất. Với Neon, cần thêm PostgREST phía trước (Neon không tự có REST API) — nếu bạn thích hướng này, tôi có thể viết thêm adapter kết nối trực tiếp qua `pg` + một Edge Function nhỏ.

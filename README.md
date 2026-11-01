# 🍵 Matcha POS — Hệ thống quản lý bán hàng chuỗi trà sữa & cà phê

Ứng dụng quản lý bán hàng **chuẩn thương mại** cho chuỗi F&B (mô hình KiotViet / iPOS / Sapo FnB / Toast / Odoo POS), lấy cảm hứng vận hành từ Highlands Coffee, Phúc Long, Gong Cha: **POS tại quầy → KDS nhà bếp → màn hình gọi số → kho & mua hàng → CRM → tài chính → 11 loại báo cáo → Data Explorer + ERP Simulator**.

Toàn bộ ứng dụng chạy **hoàn toàn trong trình duyệt**: SQLite biên dịch sang WebAssembly (`sql.js`), dữ liệu lưu bền trong **IndexedDB**. Không server, không cần đăng ký, không cần cài đặt — mở link là dùng được, và dữ liệu demo 90 ngày (~4.100 đơn) được sinh sẵn ngay lần mở đầu tiên.

### 🔗 Bản chạy công khai: **https://phanvanminh020310-dot.github.io/Matcha/**

Bấm là dùng — không đăng nhập, không cài đặt. Màn hình đăng nhập có 5 tài khoản demo, bấm 1 thẻ để vào.

---

## 1. Ảnh chụp màn hình

| POS bán hàng | Màn hình bếp (KDS) |
| --- | --- |
| ![POS](docs/screenshots/02-pos.png) | ![KDS](docs/screenshots/05-kds.png) |

| Dashboard (so kỳ trước) | Data Explorer — ERD quan hệ |
| --- | --- |
| ![Dashboard](docs/screenshots/07-dashboard.png) | ![ERD](docs/screenshots/19-data-explorer-erd.png) |

| ERP Simulator + data diff | Màn hình gọi số cho khách |
| --- | --- |
| ![ERP](docs/screenshots/21-erp-simulator.png) | ![Display](docs/screenshots/06-man-hinh-goi-so.png) |

| Giao hàng & điều phối (bản đồ OSM thật) | Theo dõi shipper trực tuyến |
| --- | --- |
| ![Delivery](docs/screenshots/25-giao-hang-dieu-phoi.png) | ![Map](docs/screenshots/26-ban-do-shipper.png) |

| Studio in ấn (thiết kế mẫu K80/A5) | Trang theo dõi đơn của khách |
| --- | --- |
| ![Print](docs/screenshots/27-studio-in-an.png) | ![Track](docs/screenshots/30-trang-theo-doi-khach.png) |

| Thanh toán VietQR chuẩn EMVCo | Đối soát chuyển khoản |
| --- | --- |
| ![VietQR](docs/screenshots/28-thanh-toan-vietqr.png) | ![Reconcile](docs/screenshots/29-doi-soat-chuyen-khoan.png) |

| Kết nối Postgres thật (Supabase/Neon) | Thiết kế phiếu giao hàng A5 |
| --- | --- |
| ![Cloud](docs/screenshots/34-csdl-postgres.png) | ![A5](docs/screenshots/33-studio-phieu-giao-hang.png) |

| Realtime: máy khác sửa dữ liệu → app báo ngay | Siết quyền ghi bằng mã đồng bộ (RLS) |
| --- | --- |
| ![Realtime](docs/screenshots/45-realtime-bao-thay-doi.png) | ![RLS](docs/screenshots/43-rls-kiem-tra-quyen-ghi.png) |

| Bản đồ 3D điều phối trực tiếp (MapLibre · toà nhà 3D) | Sơ đồ ERP 3D (bàn điều khiển nghiêng) |
| --- | --- |
| ![Map3D](docs/screenshots/48-ban-do-3d-giao-hang.png) | ![ERP3D](docs/screenshots/49-erp-simulator-3d.png) |

| Quản trị dữ liệu (CRUD mọi bảng) | Vai trò & phân quyền (RBAC động) |
| --- | --- |
| ![Admin](docs/screenshots/50-quan-tri-du-lieu.png) | ![Roles](docs/screenshots/51-vai-tro-phan-quyen.png) |

Các ảnh khác trong [`docs/screenshots`](docs/screenshots): đăng nhập, thanh toán, hoá đơn, đơn hàng, thực đơn, công thức, kho, mua hàng, khách hàng, khuyến mãi, nhân sự, tài chính, báo cáo, cài đặt, SQL Console, dark mode, tablet.

---

## 2. Tài khoản demo

Màn hình đăng nhập có sẵn **5 vai trò** — bấm một thẻ là vào ngay (không cần gõ mật khẩu):

| Vai trò | Email | Mật khẩu | Quyền chính |
| --- | --- | --- | --- |
| 👑 Chủ chuỗi | `owner@matcha.vn` | `123456` | Toàn bộ hệ thống, xem cả 3 chi nhánh |
| 🧑‍💼 Quản lý cửa hàng | `quanly.q1@matcha.vn` | `123456` | Bán hàng, kho, CRM, báo cáo, huỷ đơn |
| 🧾 Thu ngân | `thungan.q1@matcha.vn` | `123456` | POS, ca làm việc, đơn hàng |
| 🧑‍🍳 Pha chế / Bếp | `phahe.q1@matcha.vn` | `123456` | KDS, danh sách đơn |
| 📊 Kế toán / Kho | `ketoan@matcha.vn` | `123456` | Kho, mua hàng, tài chính, báo cáo |

Chi nhánh chuyển được ở góc trên phải: **Q1 · TP.HCM**, **Q3 · TP.HCM**, **CG · Hà Nội** (VAT 8% / 8% / 10%).

> Dữ liệu nằm trong IndexedDB của **chính máy bạn**. Bấm **Reset dữ liệu demo** (Cài đặt hoặc Data Explorer) để sinh lại bộ dữ liệu gốc bất cứ lúc nào.

---

## 3. Tính năng

### Bán hàng
- **POS**: lưới món theo danh mục (trà sữa, trà trái cây, cà phê, đá xay, matcha, bánh, combo), tìm kiếm/`F2`, quét mã vạch SKU.
- Tuỳ biến từng ly: **size S/M/L** (giá chênh), **mức đường 0–100%**, **mức đá 0–100%**, **topping** (12 loại, giá riêng), **ghi chú cho pha chế**, số lượng.
- Giỏ hàng: sửa–xoá–nhân đôi, **giảm giá từng món & cả đơn**, **voucher** (mã, đơn tối thiểu, hạng khách, hạn dùng), **CTKM tự động** (giờ vàng, giảm theo hạng thành viên, combo), **VAT**, phí giao hàng, dùng điểm.
- **Sơ đồ bàn** (36 bàn, 3 khu), số thứ tự takeaway, giữ đơn / nhiều đơn, gộp–tách–chuyển bàn, ghi nợ.
- **Thanh toán nhiều phương thức**: tiền mặt (mệnh giá nhanh + tính tiền thừa), **VietQR mô phỏng** (mã QR theo chuẩn EMVCo), thẻ, MoMo, ZaloPay, ghi nợ; tách nhiều lần thanh toán cho một đơn.
- **In hoá đơn K80** + **tem ly** bằng CSS `@media print` (hộp thoại in của trình duyệt).
- Khách hàng theo SĐT: tự tạo hồ sơ, điểm tích luỹ, **4 hạng** (Đồng / Bạc / Vàng / Kim cương) tự nâng hạng.
- **Ca làm việc**: mở ca (tiền đầu ca), nộp/rút tiền mặt, chốt ca, **đối soát & chênh lệch**.
- Huỷ đơn cần quyền quản lý + **lý do bắt buộc** + ghi `audit_logs` + hoàn kho.
- Phím tắt: `F1` thanh toán, `F2` tìm món, `Ctrl/⌘ + K` command palette, `Esc` đóng.

### Nhà bếp & khách hàng
- **KDS Kanban** 3 cột *Đơn mới → Đang pha chế → Sẵn sàng* (+ nút *Đã giao khách*), đồng hồ đếm phút từng phiếu, **cảnh báo quá hạn** (>6 phút, >12 phút với đơn giao hàng), **âm thanh + nhấp nháy** khi có đơn mới, lọc theo kênh, chế độ toàn màn hình.
- **Customer Display** full-screen: số thứ tự đang sẵn sàng, số đơn đang pha, đơn gần nhất, giờ Việt Nam realtime.
- Đồng bộ **giữa các tab** bằng `BroadcastChannel` (POS ↔ KDS ↔ Display) và sự kiện ghi dữ liệu trong cùng tab.

### Back-office (12 nhóm)
1. **Dashboard**: doanh thu/lợi nhuận/số đơn/AOV so kỳ trước, biểu đồ doanh thu–lợi nhuận, giờ cao điểm, kênh bán, top món, theo chi nhánh, phương thức thanh toán, danh mục, cảnh báo tồn kho.
2. **Đơn hàng**: lọc (từ khoá, trạng thái, kênh, ngày), phân trang, chi tiết đơn (dòng món + topping + VAT + điểm + voucher + thanh toán + **timeline sự kiện**), chuyển trạng thái, huỷ có lý do, xuất CSV.
3. **Thực đơn**: CRUD món (giá, emoji, danh mục, bán chạy, đang bán), biên lợi nhuận theo màu, xuất CSV.
4. **Công thức / BOM**: định lượng nguyên liệu theo từng size, giá vốn & lãi theo size, sửa inline, thêm/xoá dòng.
5. **Kho**: tồn kho theo chi nhánh (mức tồn trực quan), nhập/xuất/hao hụt/kiểm kê, chuyển kho giữa chi nhánh, **thẻ kho**, đề xuất nhập khi dưới định mức, xuất CSV.
6. **Mua hàng**: PO (nháp → gửi NCC → nhận hàng), nhận hàng tự cộng tồn kho + tăng **công nợ NCC** + ghi sổ chi, danh sách 15 NCC & công nợ.
7. **CRM**: 220 khách, tìm theo tên/SĐT, lọc theo hạng, hồ sơ chi tiết (điểm, tổng chi, lịch sử đơn, gợi ý chăm sóc).
8. **Khuyến mãi**: voucher (%, số tiền, đơn tối thiểu, giảm tối đa, hạng, lượt dùng, bật/tắt) + CTKM tự động.
9. **Nhân sự**: đội ngũ 10 người, ca làm việc & đối soát, doanh số theo nhân viên, **bảng lương** (lương cơ bản + 0,5% doanh thu).
10. **Tài chính**: sổ thu chi, chi phí cố định theo tháng, **P&L** (doanh thu − COGS − chi phí vận hành), xuất CSV.
11. **Báo cáo**: 7 nhóm báo cáo trong UI (sản phẩm, danh mục, giờ, kênh, nhân viên, khuyến mãi, ca) với biểu đồ + bảng + **xuất CSV**; các chỉ tiêu còn lại (tồn kho, P&L, công nợ) nằm ở trang Kho / Tài chính.
12. **Cài đặt**: thông tin chi nhánh (tên, địa chỉ, hotline, VAT), phương thức thanh toán, **sơ đồ bàn kéo thả**, **ma trận phân quyền** 5 vai trò × 20 quyền, **audit log**, thông tin CSDL + Reset.

### Bản đồ 3D trực tiếp (màn hình *Giao hàng & điều phối → Bản đồ 3D trực tiếp*)

- **MapLibre GL + vector tiles OpenFreeMap** (miễn phí, không API key): toà nhà **đổ khối 3D** (`fill-extrusion` theo chiều cao thật), đường phát sáng, sương chân trời, nghiêng 55–75°, xoay, zoom.
- **Shipper chạy mượt trên tuyến OSRM thật**: nội suy vị trí theo thời gian, mũi tên quay theo hướng lái, vệt đường đã đi, vòng pulse tại điểm đến, camera **bám xe**.
- HUD kiểu app vận tải: số xe đang chạy, còn bao nhiêu km / ETA / tiền thu hộ của xe đang chọn, danh sách đội xe bấm là bay tới.
- Điều khiển: play/pause, chọn tốc độ 0.5×–4×, ẩn/hiện 3D, tự căn toàn tuyến, về kho, xoay trái/phải. Mất mạng → tự chuyển nền raster OSM.

### Giao hàng chuẩn Shopee (màn hình *Giao hàng & điều phối*)

- **Bản đồ trực tuyến thật**: tile OpenStreetMap + Leaflet, marker SVG cho quán / điểm giao / tài xế.
- **Geocode thật**: tìm địa chỉ qua Nominatim (OSM), có fallback điểm mẫu khi offline.
- **Định tuyến thật**: OSRM `router.project-osrm.org` → khoảng cách, thời gian, hình học tuyến đường vẽ trên bản đồ.
- **Phí ship theo km**: 5 bậc (≤2km 12k → >9km 45k), tự tính khi tạo vận đơn.
- **Luồng trạng thái**: chờ tài xế → đã gán → đã lấy hàng → đang giao → đã giao / thất bại, mỗi bước ghi `delivery_events` kèm toạ độ + người thực hiện.
- **Theo dõi realtime**: mô phỏng tài xế chạy dọc tuyến OSRM (tiến trình tính theo giờ thật giữa `picked_at` → `eta_at`), có ETA, cảnh báo trễ, COD, đánh giá sao.
- **Trang cho khách**: `#/track/VD000123` — không cần đăng nhập, bản đồ + timeline + phí + COD (nút *Link theo dõi* trong chi tiết vận đơn).

### Thanh toán thật (VietQR EMVCo) + đối soát

- Sinh payload **VietQR chuẩn NAPAS 247/EMVCo**: TLV, GUID NAPAS, BIN ngân hàng thật (Vietcombank 970436, Techcombank 970407, MB 970422…), amount, memo, **CRC-16/CCITT** → quét được bằng app ngân hàng bất kỳ.
- POS hiển thị QR thật (`qrcode`), nút copy payload / tải PNG, hiện CRC để đối chiếu.
- **Đối soát** (Tài chính → *Đối soát chuyển khoản*): danh sách giao dịch QR/ví chờ xác nhận, nhập mã giao dịch ngân hàng (`FT…`) → ghi `payments.bank_txn_ref`, `verified_at`, `verified_by` + audit log.
- Số tài khoản nhận tiền quản lý trong bảng `bank_accounts` (theo từng chi nhánh).

### Studio in ấn chuyên nghiệp (màn hình *Studio in ấn*)

- **6 mẫu dựng sẵn**: hoá đơn K80, tem ly / phiếu pha chế K57, phiếu giao hàng A5, biên bản kiểm kê, nhãn kệ, báo cáo chốt ca.
- **Trình thiết kế**: thư viện 13 loại khối (chữ, cặp nhãn–giá trị, bảng món, tổng tiền, thanh toán, QR, barcode, ô chữ ký…), đổi thứ tự, cỡ chữ, độ đậm, căn lề, IN HOA, chèn biến `{{order.code}}`, `{{delivery.cod}}`…
- **Xem trước đúng khổ giấy** (80/57/148/210 mm) với QR + barcode Code128 render thật (`jsbarcode`).
- **In thật**: iframe ẩn + `@page { size: <khổ> }` → hộp thoại in của hệ điều hành (máy in hoá đơn, PDF). Lưu mẫu vào bảng `print_templates`, đặt mặc định theo loại.
- **In hàng loạt**: in hoá đơn cho toàn bộ đơn trong ngày hoặc danh sách chọn; mỗi lệnh ghi vào `print_jobs` (mẫu, bản ghi, số bản, máy in, người bấm).

### Cơ sở dữ liệu thật — Postgres (Supabase / Neon)

- **Cài đặt → Cơ sở dữ liệu**: dán `Project URL` + `anon key` của Supabase (hoặc PostgREST bất kỳ) → *Kiểm tra kết nối* → *Đẩy dữ liệu lên* / *Tải từ cloud*.
- Tải **`schema.sql`** (sinh tự động từ `src/lib/schema.ts`): 34 bảng, khoá ngoại, chỉ mục, **RLS + GRANT** cho `anon`/`authenticated` — chạy 1 lần trong SQL Editor là xong.
- Tải **`seed.sql`**: toàn bộ dữ liệu đang chạy (≈60.000 dòng) dưới dạng INSERT, dùng được cho `psql` hoặc SQL Editor.
- Bật *Tự tải dữ liệu từ cloud khi mở app* → nhiều máy dùng chung một CSDL; khi chưa cấu hình, app vẫn chạy offline trên **SQLite WASM + IndexedDB** (không mất tính năng).
- File mẫu: `docs/sql/schema.postgres.sql` (đã kiểm tra cú pháp bằng parser PostgreSQL).
- **Hướng dẫn bật Supabase từng bước (7 bước, kèm xử lý sự cố): [`docs/huong-dan-supabase.md`](docs/huong-dan-supabase.md)**
- **Trạng thái thực tế**: một project Supabase (region Singapore, PostgreSQL 17) đã được tạo và nạp sẵn **60.854 dòng / 34 bảng**, kiểm tra 47 khoá ngoại không có dòng mồ côi. Để dùng, chỉ cần dán `Project URL` + `anon key` vào *Cài đặt → Cơ sở dữ liệu* rồi bấm **Tải từ cloud**.
- **Realtime 2 chiều**: bật *Theo dõi thay đổi realtime* → app nối WebSocket tới Supabase Realtime (tự viết client Phoenix, không thêm thư viện) trên **11 bảng** (`orders`, `order_items`, `payments`, `order_events`, `deliveries`, `delivery_events`, `inventory_stock`, `inventory_txns`, `customers`, `shifts`, `print_jobs`). Máy khác ghi dữ liệu → hiện banner *“Có thay đổi mới từ cloud”* kèm nút **Đồng bộ ngay**; badge hiển thị trạng thái `realtime`. Bật bằng cách chạy **`docs/sql/realtime.sql`** (nút tải trong Cài đặt).
- **Bảo mật ghi (RLS + mã đồng bộ)**: anon key nằm trong bundle nên **không thể** là thứ bảo vệ dữ liệu. Chạy **`docs/sql/rls.sql`** → mọi lệnh INSERT/UPDATE/DELETE yêu cầu header `x-sync-token` khớp SHA-256 trong bảng `sync_tokens` (kiểm tra bằng hàm `sync_ok()`, chạy `security definer`). Mã cấp theo thiết bị, có thể giới hạn theo `branch_id` (mã của Q1 không ghi được dữ liệu Q3). 11 bảng realtime vẫn mở quyền **đọc** (Supabase Realtime cần quyền SELECT để bắn sự kiện); các bảng còn lại (`users`, kho, tài chính…) yêu cầu mã ngay cả khi đọc. Có `docs/sql/rls-off.sql` để quay lại trạng thái mở khi thử nghiệm.
- **Cơ chế đồng bộ**: *Đẩy dữ liệu lên* = UPSERT theo khoá chính (an toàn, không mất dữ liệu nếu đứt mạng); *Xoá & đẩy lại* = xoá sạch cloud rồi nạp lại (dùng khi cloud bị lệch); *Tải từ cloud* = kéo toàn bộ, phân trang 500 dòng/lần theo đúng khoá chính (kể cả bảng khoá ghép như `product_toppings`).

### Quản trị dữ liệu & phân quyền (mới — dùng được ngay, không cần sửa code)

**Quản trị dữ liệu (`#/admin`)** — CRUD tổng quát cho **34 bảng**:
- Tự sinh bảng + form từ metadata schema: nhãn tiếng Việt từng cột, PK/FK/UNIQUE, nullable, kiểu số/ngày/bool.
- **Thêm / Sửa / Nhân bản / Xoá** mọi danh mục (chi nhánh, nhân viên, món, size, topping, công thức, NCC, nguyên liệu, khách, voucher, bàn, mẫu in, vai trò…).
- Khoá ngoại: chọn từ dropdown lấy dữ liệu thật từ bảng cha; **xoá an toàn** — quét 47 quan hệ FK, báo “đang được dùng bởi N dòng ở bảng X” và chỉ xoá dây chuyền khi bạn xác nhận.
- Tìm kiếm/sắp xếp/phân trang, lọc theo chi nhánh, ẩn/hiện cột, xuất CSV, mọi thao tác ghi **audit_logs** (ai sửa, giá trị trước–sau).

**Vai trò & phân quyền (`#/roles`)** — RBAC **động** (lưu ở bảng `roles`, không hard-code):
- 6 vai trò sẵn có (Chủ chuỗi, Quản lý chi nhánh, Thu ngân, Pha chế, Kế toán, Tài xế) + **thêm vai trò tuỳ ý**.
- **Ma trận 24 quyền × vai trò** theo 7 nhóm module: tick là lưu, **hiệu lực ngay** — menu và nút thao tác tự ẩn/hiện, vào thẳng URL không có quyền vẫn bị chặn.
- Gán vai trò cho từng nhân viên ngay trong bảng.
- Schema v5 có **migration tự động**: máy đang có dữ liệu cũ được nâng cấp tại chỗ, không mất dữ liệu.

### Data Explorer (dành cho dân kỹ thuật)
- Danh sách **28 bảng** theo module kèm số dòng & dung lượng CSDL.
- **Grid**: tìm kiếm toàn cột, sắp xếp, phân trang, ẩn/hiện cột, chi tiết từng dòng, **bấm khoá ngoại để nhảy sang bản ghi liên quan**, danh sách bảng con (cha–con), xuất CSV/JSON.
- **Cấu trúc bảng**: kiểu dữ liệu, PK/FK/UNIQUE/INDEX (đọc trực tiếp từ `PRAGMA`), nullable, mô tả tiếng Việt từng cột, quan hệ cha–con.
- **ERD bằng React Flow**: 28 node theo 6 module, 40 cạnh khoá ngoại, zoom/pan, minimap, lọc module, tô sáng quan hệ khi bấm node, **xuất SVG**.
- **SQL Console chỉ đọc** (SELECT/WITH/PRAGMA/EXPLAIN, chặn mọi từ khoá ghi), 7 truy vấn mẫu, kết quả dạng bảng + **chart tự chọn trục X/Y**, đo thời gian chạy.
- **Chế độ chuyên gia**: bật mới được sửa một ô dữ liệu; mỗi lần sửa ghi `audit_logs` (giá trị trước/sau).

### ERP Simulator
- **Sơ đồ 3D**: bàn điều khiển nghiêng 3D (CSS 3D + SVG), module là khối kính nổi, dây dữ liệu có **gói tin chạy liên tục**, module đang xử lý phát sáng; kéo để xoay, Shift+kéo để nghiêng, lăn chuột zoom, tự xoay, thanh nghiêng 20–74°.
- Node hiển thị **số liệu sống** (đơn hôm nay, phiếu KDS, mặt hàng dưới định mức, PO chờ nhận, công nợ, chi phí tháng, khách, voucher…), cạnh động theo module đang xử lý.
- **5 kịch bản chạy trên chính CSDL thật**: một đơn hàng đi qua toàn hệ thống, nhập hàng từ NCC, chạy một ca làm việc, hao hụt & kiểm kê, huỷ đơn & hoàn kho.
- Điều khiển **tốc độ / tạm dừng / từng bước**, mỗi bước hiện **data diff** (bảng · dòng · trước → sau) — chụp 17 bảng trước và sau bước để tính diff nên số liệu không phải "diễn".

---

## 4. Kiến trúc

```
Trình duyệt (SPA, không backend)
├── React 18 + TypeScript + Vite
├── Tailwind CSS (design system riêng, tiếng Việt, tablet-first)
├── Zustand (UI state) + useSyncExternalStore (query đồng bộ)
├── sql.js (SQLite 3 biên dịch WASM) ──► IndexedDB (persist)
├── Recharts (biểu đồ) · @xyflow/react (ERD/ERP) · lucide-react
└── Zod (validate form) · BroadcastChannel (đồng bộ đa tab)
```

```
src/
├── lib/
│   ├── schema.ts      # DDL 28 bảng + metadata cột tiếng Việt + FK_EDGES
│   ├── seed.ts        # sinh dữ liệu 90 ngày, tất định (mulberry32), giờ VN
│   ├── db.ts          # sql.js + IndexedDB, run/all/one/scalar, BroadcastChannel
│   ├── api.ts         # lớp nghiệp vụ: checkout, cancelOrder, receivePO, closeShift…
│   ├── analytics.ts   # KPI, P&L, báo cáo, thống kê bảng
│   ├── simulator.ts   # snapshot/diff 17 bảng + 5 kịch bản ERP
│   ├── rbac.ts        # 5 vai trò × 20 quyền + menu theo vai trò
│   └── format.ts      # VND, dd/MM/yyyy, giờ VN, CSV, download
├── components/ui      # Button, Modal, Tabs, Stat, Toast, ConfirmDialog…
├── components/layout  # AppShell (sidebar, breadcrumb, command palette)
└── pages/             # 18 màn hình (POS, KDS, Display, Dashboard, …)
```

### Một đơn hàng đi qua hệ thống

```
POS checkout()
  → orders, order_items, order_item_toppings
  → inventory_txns (sale) + inventory_stock (trừ theo BOM)
  → payments + order_events + customers (điểm/hạng) + audit_logs
  → KDS (preparing → ready) → Display gọi số
  → analytics (kpis/pnl/reportByProduct) → Dashboard, Báo cáo
  → Data Explorer (thấy dòng mới) & ERP Simulator (diff từng bước)
```

### Cơ sở dữ liệu (34 bảng)

| Module | Bảng |
| --- | --- |
| Bán hàng | `orders`, `order_items`, `order_item_toppings`, `payments`, `order_events`, `dining_tables`, `categories`, `products`, `product_sizes`, `toppings`, `product_toppings` |
| Kho & mua hàng | `ingredients`, `recipes` (BOM), `inventory_stock`, `inventory_txns`, `suppliers`, `purchase_orders`, `purchase_order_items` |
| Khách hàng | `customers`, `vouchers`, `promotions` |
| Nhân sự | `users`, `shifts`, `shift_cash_txns` |
| Tài chính | `finance_entries` |
| Giao hàng | `deliveries`, `delivery_events` |
| Thanh toán & in ấn | `bank_accounts`, `print_templates`, `print_jobs` |
| Hệ thống | `branches`, `audit_logs`, `app_meta` |

ERD trực quan: mở **Data Explorer → ERD** (chụp sẵn ở `docs/screenshots/19-data-explorer-erd.png`, xuất SVG được từ UI).

---

## 5. Chạy local

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript strict, 0 lỗi
npm run build      # build production vào dist/
npm run serve      # serve dist/ bằng Node thuần (port 4173)
```

Yêu cầu: Node 18+. Không cần Postgres, không cần biến môi trường.

> `npm run serve` là static server tự viết (`scripts/serve.mjs`), có SPA fallback + `Content-Type` cho `.wasm`, bind `0.0.0.0` để chạy trong container/preview.

---

## 6. Deploy

Bản build là **static site** (`base: './'`) nên deploy được ở bất kỳ đâu:

| Nơi deploy | Cách làm |
| --- | --- |
| **GitHub Pages** (khuyến nghị) | Repo đã có workflow `.github/workflows/deploy.yml`. Chỉ cần vào **Settings → Pages → Source = "GitHub Actions"** (1 lần), sau đó mỗi lần push `main` sẽ tự build + deploy → `https://<user>.github.io/Matcha/` |
| Vercel / Netlify | import repo, build command `npm run build`, output `dist` (không cần env) |
| Cloudflare Pages | build `npm run build`, output `dist` |
| Bất kỳ static host | upload nội dung `dist/` |

Giới hạn của gói free: băng thông/ưu lượng theo nhà cung cấp — vì app không có backend và mọi truy vấn chạy trong máy người dùng, một lượt xem chỉ tải ~2,1 MB (JS + WASM + font), sau đó **không phát sinh request dữ liệu** nào.

---

## 7. Ghi chú kỹ thuật & giới hạn

- **Lưu trữ**: mặc định SQLite WASM + IndexedDB (riêng từng máy). Muốn dùng chung nhiều máy → cấu hình **Postgres (Supabase/Neon)** ở *Cài đặt → Cơ sở dữ liệu*; app đẩy/kéo toàn bộ 34 bảng qua REST. Chưa cấu hình thì vẫn chạy đầy đủ, offline.
- **Đồng bộ đa tab** trong cùng máy qua `BroadcastChannel`; **đồng bộ đa máy** qua Postgres + Supabase Realtime (banner *Có thay đổi mới từ cloud*).
- **Bảo mật cloud**: quyền ghi do RLS quyết định, dựa trên *mã đồng bộ* (SHA-256 lưu ở bảng `sync_tokens`, mã gốc chỉ nằm trên máy người dùng). Lộ anon key cũng không xoá/sửa được dữ liệu. Mức tiếp theo (chặn cả quyền đọc + phân quyền theo người) là **Supabase Auth + `auth.uid()`**, đã ghi sẵn lộ trình trong `docs/huong-dan-supabase.md`.
- **VietQR**: payload đúng chuẩn EMVCo/NAPAS 247, **quét được thật** bằng app ngân hàng; phần *xác nhận tiền về* là thao tác của thu ngân/kế toán trên màn hình đối soát (webhook ngân hàng cần hợp đồng với cổng thanh toán — nằm ngoài phạm vi bản này). MoMo/ZaloPay: tạo yêu cầu + callback mô phỏng.
- **In**: dùng hộp thoại in của hệ điều hành (máy in nhiệt K80/K57, máy in laser A5/A4, hoặc *Save as PDF*). Trình duyệt không cho web tự gửi lệnh in không qua hộp thoại vì lý do bảo mật.
- **Bản đồ/định tuyến** dùng dịch vụ công cộng miễn phí không cần key (OSM/Nominatim/OSRM) — có giới hạn rate, phù hợp demo & vận hành nhỏ; nếu cần SLA thì thay bằng Mapbox/Google (chỉ đổi 1 file `src/lib/geo.ts`).
- **Sinh dữ liệu** ~3 giây lần đầu (7,7 MB SQLite, ~4.100 đơn, 22.000 dòng thẻ kho), sau đó tải lại tức thì từ IndexedDB.
- **Múi giờ**: mọi phép tính ngày/giờ dùng `Asia/Ho_Chi_Minh` tuyệt đối (không phụ thuộc TZ máy chạy) — đã xử lý riêng vì sandbox build chạy UTC.
- **Font** Be Vietnam Pro được nhúng sẵn (subset latin + vietnamese, 132 KB) để app chạy offline/không CDN.
- **TypeScript strict** + `zod` cho form; toàn bộ luồng đã kiểm thử bằng Chromium headless: 0 lỗi console trên 18 màn hình.

Nếu bị chặn ở đâu (quyền GitHub, dịch vụ deploy…), dự án vẫn ưu tiên: **chạy được, dữ liệu nhất quán, không có chức năng giả** thay vì nhiều tính năng hình thức.

---

## 7b. Link công khai

- **GitHub Pages** (đang chạy): `https://phanvanminh020310-dot.github.io/Matcha/` — deploy tự động từ `main` bằng workflow `.github/workflows/deploy.yml`
- **Bản build tĩnh** nằm trong thư mục `build/` của repo (tiện tải về mở trực tiếp hoặc deploy lên host khác).
- Khi chạy local: `npm run serve` → `http://localhost:4173`.

## 8. Kiểm thử đã chạy

| Luồng | Kết quả |
| --- | --- |
| Đăng nhập nhanh 5 vai trò + lọc menu theo quyền | ✅ (Pha chế chỉ thấy KDS & Đơn hàng) |
| Bán 1 đơn tại quán (size L, topping, thanh toán tiền mặt 200k) | ✅ tiền thừa 150.700 ₫, hoá đơn K80 |
| Bán 1 đơn mang đi (takeaway, số thứ tự) | ✅ đơn `HD20261101-4073` |
| Trừ kho theo công thức | ✅ tổng tồn chi nhánh Q1 giảm 106 đơn vị sau 1 đơn |
| Đơn lên KDS → pha chế → sẵn sàng → đã giao | ✅ 4 phiếu, đếm giờ, đổi trạng thái |
| Dashboard / Báo cáo cập nhật theo đơn mới | ✅ 35 đơn hôm nay, 12 đơn chi nhánh Q1 |
| Data Explorer thấy dòng mới + SQL Console | ✅ `orders` 4.072 → 4.073 |
| Sửa dữ liệu ở chế độ chuyên gia + audit log | ✅ ghi `audit_logs.action = expert_update` |
| ERP Simulator 5 bước + data diff | ✅ 42 thay đổi dữ liệu, 0 lỗi |
| Console errors trên 18 route | ✅ 0 lỗi |
| Giao hàng: bảng điều phối 4 cột trạng thái + gán tài xế + chuyển trạng thái | ✅ vận đơn `VD000034`, 5 mốc hành trình |
| Bản đồ trực tuyến: tile OSM + tuyến OSRM + marker tài xế | ✅ 12 tile tải về, tuyến 1 km / 2 phút |
| Trang theo dõi `#/track/VD…` (không đăng nhập) | ✅ bản đồ + timeline + COD 301.000 ₫ |
| VietQR: sinh QR thật + CRC + copy payload | ✅ `STK 0071000123456`, CRC `E4A9`, ảnh QR render |
| Đối soát chuyển khoản | ✅ 80 giao dịch chờ, xác nhận ghi `bank_txn_ref` |
| POS → kênh *Giao hàng* → chọn địa chỉ trên bản đồ → phí tự tính | ✅ 0,7 km · 2 phút · phí 12.000 ₫ (OSRM) |
| POS tạo đơn giao → **tự sinh vận đơn** trong bảng điều phối | ✅ cột *Chờ điều phối* 1 → 2 |
| Studio in ấn: 6 mẫu, xem trước có QR + barcode SVG | ✅ QR 1 + barcode 1 trên preview K80 |
| Xuất `schema.sql` / `seed.sql` cho Postgres | ✅ 34 bảng + RLS, 6,0 MB INSERT (60.854 dòng), cú pháp hợp lệ |
| Cloud thật: pull 60.854 dòng về máy (production, Pages) | ✅ `auto-pull xong 60854 dòng`, 0 lỗi console |
| Cloud thật: đẩy UPSERT không làm mất dữ liệu | ✅ khớp 100% sau khi đẩy (orders 4.101 · order_items 6.449 · inventory_txns 22.808) |
| Realtime: máy khác UPDATE 1 dòng `customers` trên Postgres | ✅ banner “Có thay đổi mới từ cloud” hiện sau ~2 s (WebSocket `postgres_changes`) |
| Bấm **Đồng bộ ngay** → dữ liệu mới vào app | ✅ kéo 60.855 dòng, tên khách mới hiện trong *Khách hàng & CRM* |
| RLS: ghi khi **không** có mã đồng bộ | ✅ bị chặn (`new row violates row-level security policy`, HTTP 401) |
| RLS: UPDATE/DELETE khi không có mã | ✅ 0 dòng bị ảnh hưởng (RLS lọc im lặng), dữ liệu giữ nguyên |
| RLS: ghi **có** mã đồng bộ | ✅ 201/204, `rpc/sync_ok` trả `true`; đọc `users` chỉ được khi có mã |
| **Tải từ cloud khi thiếu mã** (RLS chặn đọc) | ✅ báo lỗi rõ ràng, **dữ liệu trên máy giữ nguyên** (pull tải đủ rồi mới ghi đè trong 1 transaction), banner cảnh báo + nút *Mở Cài đặt* |
| Bản đồ 3D: WebGL + vector tiles + toà nhà đổ khối | ✅ canvas MapLibre, pitch 55–62°, nghiêng/xoay/zoom, 0 lỗi console (worker tự host) |
| Bản đồ 3D: shipper chạy trên tuyến OSRM | ✅ 4 vận đơn · 2 tài xế · tuyến 0,6–1 km, marker quay theo hướng, camera bám xe |
| ERP Simulator 3D | ✅ 8 module · 10 luồng · gói tin chạy, module đang xử lý phát sáng |
| Quản trị dữ liệu: thêm / sửa / xoá | ✅ topping 12 → 13 dòng, sửa giá 15.000 → 20.000, xoá về 12 |
| Phân quyền động: tick quyền → hiệu lực ngay | ✅ Thu ngân 8 → 9 quyền, vào được `#/reports` sau khi cấp; trước đó bị chặn |
| Menu & trang theo vai trò | ✅ Thu ngân không thấy “Quản trị dữ liệu”, vào thẳng `#/admin` bị chặn |
| Migration schema v4 → v5 (giữ dữ liệu) | ✅ nâng cấp tại chỗ, thêm bảng `roles`, không seed lại |
| Push bảng `roles` lên cloud | ✅ cloud 6 vai trò (owner 24 · manager 22 · cashier 8 · barista 4 · accountant 9 · shipper 2 quyền) |

Ảnh kiểm thử nằm trong `docs/screenshots/`.

---

## 9. Giấy phép

MIT — dùng cho mục đích học tập/demo. Dữ liệu, thương hiệu trong ảnh là hư cấu.

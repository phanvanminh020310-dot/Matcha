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

### Data Explorer (dành cho dân kỹ thuật)
- Danh sách **28 bảng** theo module kèm số dòng & dung lượng CSDL.
- **Grid**: tìm kiếm toàn cột, sắp xếp, phân trang, ẩn/hiện cột, chi tiết từng dòng, **bấm khoá ngoại để nhảy sang bản ghi liên quan**, danh sách bảng con (cha–con), xuất CSV/JSON.
- **Cấu trúc bảng**: kiểu dữ liệu, PK/FK/UNIQUE/INDEX (đọc trực tiếp từ `PRAGMA`), nullable, mô tả tiếng Việt từng cột, quan hệ cha–con.
- **ERD bằng React Flow**: 28 node theo 6 module, 40 cạnh khoá ngoại, zoom/pan, minimap, lọc module, tô sáng quan hệ khi bấm node, **xuất SVG**.
- **SQL Console chỉ đọc** (SELECT/WITH/PRAGMA/EXPLAIN, chặn mọi từ khoá ghi), 7 truy vấn mẫu, kết quả dạng bảng + **chart tự chọn trục X/Y**, đo thời gian chạy.
- **Chế độ chuyên gia**: bật mới được sửa một ô dữ liệu; mỗi lần sửa ghi `audit_logs` (giá trị trước/sau).

### ERP Simulator
- **Bản đồ module** / **Luồng dữ liệu** dạng React Flow, node hiển thị **số liệu sống** (đơn hôm nay, phiếu KDS, mặt hàng dưới định mức, PO chờ nhận, công nợ, chi phí tháng, khách, voucher…), cạnh động theo module đang xử lý.
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

### Cơ sở dữ liệu (28 bảng)

| Module | Bảng |
| --- | --- |
| Bán hàng | `orders`, `order_items`, `order_item_toppings`, `payments`, `order_events`, `dining_tables`, `categories`, `products`, `product_sizes`, `toppings`, `product_toppings` |
| Kho & mua hàng | `ingredients`, `recipes` (BOM), `inventory_stock`, `inventory_txns`, `suppliers`, `purchase_orders`, `purchase_order_items` |
| Khách hàng | `customers`, `vouchers`, `promotions` |
| Nhân sự | `users`, `shifts`, `shift_cash_txns` |
| Tài chính | `finance_entries` |
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

- **Không có backend**: dữ liệu là của riêng từng trình duyệt. Hai máy khác nhau có hai CSDL độc lập; xoá dữ liệu trình duyệt = mất dữ liệu (dùng *Reset* để sinh lại bộ demo).
- **Đồng bộ đa tab** trong cùng máy qua `BroadcastChannel`. Máy khác không thấy thay đổi (bản demo, không phải SaaS nhiều người dùng).
- **VietQR / MoMo / ZaloPay / máy in** là mô phỏng: mã QR sinh theo chuẩn EMVCo nhưng không gọi cổng thanh toán; in dùng hộp thoại in của trình duyệt.
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

Ảnh kiểm thử nằm trong `docs/screenshots/`.

---

## 9. Giấy phép

MIT — dùng cho mục đích học tập/demo. Dữ liệu, thương hiệu trong ảnh là hư cấu.

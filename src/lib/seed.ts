/**
 * Sinh dữ liệu demo cho Matcha POS.
 * Nguyên tắc: mọi con số phải nhất quán — doanh thu = Σ payments = Σ dòng đơn,
 * tồn kho = Σ thẻ kho, COGS = Σ (recipe × giá vốn), điểm khách = f(chi tiêu).
 */
import type { Database } from 'sql.js'
import { DDL } from './schema'

/* ------------------------------- tiện ích -------------------------------- */
export function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261031)
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const chance = (p: number) => rnd() < p

/** Giờ Việt Nam, chuỗi 'YYYY-MM-DD HH:mm:ss' (giờ local) */
export function vnString(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  // "giờ VN giả UTC": mọi phép tính dùng getUTC* để kết quả không phụ thuộc TZ của máy chạy
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}
const dateOnly = (d: Date) => vnString(d).slice(0, 10)

/** Bây giờ theo giờ VN, kẹp về khoảng 10:00–20:30 để ngày hôm nay luôn có dữ liệu bán hàng. */
function currentVN() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const hour = Math.min(20, Math.max(10, g('hour')))
  return new Date(Date.UTC(g('year'), g('month') - 1, g('day'), hour, g('minute') < 30 ? 30 : g('minute'), 0))
}
const NOW = currentVN()
const DAYS = 90

/* -------------------------------- master --------------------------------- */
const BRANCHES = [
  { code: 'Q1', name: 'Matcha House Quận 1', address: '42 Nguyễn Huệ, Phường Bến Nghé', city: 'TP.HCM', phone: '028 3822 1188', vat_rate: 0.08, opened_at: '2023-04-12' },
  { code: 'Q3', name: 'Matcha House Quận 3', address: '189 Võ Văn Tần, Phường 5', city: 'TP.HCM', phone: '028 3930 4477', vat_rate: 0.08, opened_at: '2023-11-02' },
  { code: 'CG', name: 'Matcha House Cầu Giấy', address: '68 Trần Duy Hưng, Cầu Giấy', city: 'Hà Nội', phone: '024 3556 9922', vat_rate: 0.1, opened_at: '2024-06-18' },
]

const USERS = [
  { name: 'Nguyễn Minh Anh', email: 'owner@matcha.vn', role: 'owner', branch: 1, salary: 45000000, emoji: '👑' },
  { name: 'Trần Thu Hà', email: 'quanly.q1@matcha.vn', role: 'manager', branch: 1, salary: 18000000, emoji: '🧑‍💼' },
  { name: 'Lê Quốc Bảo', email: 'quanly.q3@matcha.vn', role: 'manager', branch: 2, salary: 17500000, emoji: '🧑‍💼' },
  { name: 'Phạm Ngọc Diệp', email: 'thungan.q1@matcha.vn', role: 'cashier', branch: 1, salary: 9000000, emoji: '🧾' },
  { name: 'Vũ Hoàng Nam', email: 'thungan.q3@matcha.vn', role: 'cashier', branch: 2, salary: 9000000, emoji: '🧾' },
  { name: 'Đỗ Thị Mai', email: 'thungan.cg@matcha.vn', role: 'cashier', branch: 3, salary: 9500000, emoji: '🧾' },
  { name: 'Hoàng Anh Tuấn', email: 'phahe.q1@matcha.vn', role: 'barista', branch: 1, salary: 8500000, emoji: '🧑‍🍳' },
  { name: 'Nguyễn Thảo Vy', email: 'phahe.q3@matcha.vn', role: 'barista', branch: 2, salary: 8500000, emoji: '🧑‍🍳' },
  { name: 'Bùi Minh Khôi', email: 'phahe.cg@matcha.vn', role: 'barista', branch: 3, salary: 8800000, emoji: '🧑‍🍳' },
  { name: 'Lý Thanh Hương', email: 'ketoan@matcha.vn', role: 'accountant', branch: 1, salary: 14000000, emoji: '📊' },
]

const CATEGORIES = [
  { name: 'Trà sữa', slug: 'tra-sua', emoji: '🧋' },
  { name: 'Trà trái cây', slug: 'tra-trai-cay', emoji: '🍑' },
  { name: 'Cà phê', slug: 'ca-phe', emoji: '☕' },
  { name: 'Đá xay', slug: 'da-xay', emoji: '🥤' },
  { name: 'Matcha', slug: 'matcha', emoji: '🍵' },
  { name: 'Topping', slug: 'topping', emoji: '🍡' },
  { name: 'Bánh & Snack', slug: 'banh-snack', emoji: '🥐' },
  { name: 'Combo', slug: 'combo', emoji: '🎁' },
]

type P = { name: string; cat: number; price: number; emoji: string; best?: boolean; noSize?: boolean; desc?: string }

const PRODUCTS: P[] = [
  { name: 'Trà sữa trân châu đường đen', cat: 0, price: 45000, emoji: '🧋', best: true, desc: 'Trà đen ủ 8h, sữa béo, trân châu đường đen nấu mỗi 2 giờ' },
  { name: 'Trà sữa Oolong', cat: 0, price: 42000, emoji: '🧋', best: true, desc: 'Oolong rang nhẹ, hậu ngọt thanh' },
  { name: 'Hồng trà sữa', cat: 0, price: 39000, emoji: '🧋', desc: 'Hồng trà truyền thống kết hợp sữa tươi' },
  { name: 'Trà sữa khoai môn', cat: 0, price: 48000, emoji: '🍠', desc: 'Khoai môn dẻo quyện sữa' },
  { name: 'Trà sữa Matcha trân châu', cat: 0, price: 52000, emoji: '🍵', best: true, desc: 'Matcha Uji kết hợp trân châu' },
  { name: 'Trà sữa Thái xanh', cat: 0, price: 45000, emoji: '🧋' },
  { name: 'Trà đào cam sả', cat: 1, price: 49000, emoji: '🍑', best: true, desc: 'Đào ngâm, cam vàng, sả tươi' },
  { name: 'Trà vải hạt chia', cat: 1, price: 45000, emoji: '🍒' },
  { name: 'Trà dâu tằm', cat: 1, price: 47000, emoji: '🍓' },
  { name: 'Trà xoài nhiệt đới', cat: 1, price: 49000, emoji: '🥭' },
  { name: 'Trà chanh sả gừng', cat: 1, price: 39000, emoji: '🍋' },
  { name: 'Trà ổi hồng', cat: 1, price: 45000, emoji: '🍈' },
  { name: 'Cà phê đen đá', cat: 2, price: 29000, emoji: '☕', best: true, desc: 'Robusta rang mộc, pha phin' },
  { name: 'Cà phê sữa đá', cat: 2, price: 32000, emoji: '☕', best: true },
  { name: 'Bạc xỉu', cat: 2, price: 35000, emoji: '🥛' },
  { name: 'Cà phê muối', cat: 2, price: 39000, emoji: '🧂', best: true, desc: 'Cream muối biển, espresso' },
  { name: 'Cappuccino', cat: 2, price: 45000, emoji: '☕' },
  { name: 'Latte', cat: 2, price: 45000, emoji: '☕' },
  { name: 'Americano cam', cat: 2, price: 42000, emoji: '🍊' },
  { name: 'Espresso tonic', cat: 2, price: 48000, emoji: '🥃' },
  { name: 'Matcha latte', cat: 4, price: 52000, emoji: '🍵', best: true, desc: 'Matcha ceremonial grade, sữa tươi' },
  { name: 'Matcha đá xay', cat: 4, price: 55000, emoji: '🍵', best: true },
  { name: 'Matcha kem cheese', cat: 4, price: 59000, emoji: '🧁' },
  { name: 'Matcha trái cây', cat: 4, price: 56000, emoji: '🍵' },
  { name: 'Matcha whisk đá', cat: 4, price: 49000, emoji: '🍵' },
  { name: 'Đá xay socola', cat: 3, price: 52000, emoji: '🍫' },
  { name: 'Đá xay cookie', cat: 3, price: 55000, emoji: '🍪' },
  { name: 'Đá xay việt quất', cat: 3, price: 53000, emoji: '🫐' },
  { name: 'Đá xay bơ', cat: 3, price: 54000, emoji: '🥑' },
  { name: 'Sinh tố xoài', cat: 3, price: 49000, emoji: '🥭' },
  { name: 'Soda chanh dây', cat: 1, price: 39000, emoji: '🫧' },
  { name: 'Soda dâu', cat: 1, price: 39000, emoji: '🍓' },
  { name: 'Sữa tươi trân châu đường đen', cat: 0, price: 46000, emoji: '🥛' },
  { name: 'Cacao sữa đá', cat: 3, price: 42000, emoji: '🍫' },
  { name: 'Bánh mì que pate', cat: 6, price: 25000, emoji: '🥖', noSize: true },
  { name: 'Bánh flan cà phê', cat: 6, price: 28000, emoji: '🍮', noSize: true },
  { name: 'Croissant bơ', cat: 6, price: 32000, emoji: '🥐', noSize: true },
  { name: 'Bánh su kem', cat: 6, price: 26000, emoji: '🧁', noSize: true },
  { name: 'Cookie matcha hạnh nhân', cat: 6, price: 30000, emoji: '🍪', noSize: true },
  { name: 'Cheesecake chanh dây', cat: 6, price: 42000, emoji: '🍰', noSize: true },
  { name: 'Trân châu ly riêng', cat: 5, price: 12000, emoji: '🍡', noSize: true },
  { name: 'Kem cheese thêm', cat: 5, price: 15000, emoji: '🧁', noSize: true },
  { name: 'Combo Trà sữa + Bánh', cat: 7, price: 69000, emoji: '🎁', noSize: true, best: true },
  { name: 'Combo Matcha + Croissant', cat: 7, price: 79000, emoji: '🎁', noSize: true },
  { name: 'Combo 2 Trà sữa', cat: 7, price: 79000, emoji: '🎁', noSize: true },
  { name: 'Combo Cà phê + Bánh mì que', cat: 7, price: 49000, emoji: '🎁', noSize: true },
  { name: 'Combo Đá xay + Cookie', cat: 7, price: 75000, emoji: '🎁', noSize: true },
]

const TOPPINGS = [
  ['Trân châu đen', 8000], ['Trân châu trắng', 8000], ['Pudding trứng', 9000], ['Thạch phô mai', 9000],
  ['Kem cheese', 12000], ['Sương sáo', 7000], ['Thạch cà phê', 8000], ['Hạt chia', 6000],
  ['Đào miếng', 10000], ['Vải miếng', 10000], ['Khoai môn dẻo', 10000], ['Bánh flan mini', 11000],
] as [string, number][]

/** [tên, nhóm, đơn vị, giá vốn/đơn vị, định mức tối thiểu, NCC index] */
const INGREDIENTS: [string, string, string, number, number][] = [
  ['Trà đen sợi', 'Trà', 'g', 220, 4000], ['Trà oolong', 'Trà', 'g', 320, 3000], ['Trà xanh Thái Nguyên', 'Trà', 'g', 280, 3000],
  ['Hồng trà', 'Trà', 'g', 200, 2500], ['Trà đào túi lọc', 'Trà', 'g', 350, 1500], ['Trà vải túi lọc', 'Trà', 'g', 340, 1200],
  ['Trà xoài hương', 'Trà', 'g', 330, 1000], ['Trà ổi', 'Trà', 'g', 300, 1000], ['Trà chanh sả', 'Trà', 'g', 260, 1000],
  ['Bột matcha Uji', 'Matcha', 'g', 4200, 800], ['Bột matcha ceremonial', 'Matcha', 'g', 6800, 500], ['Bột trà xanh pha chế', 'Matcha', 'g', 1800, 1200],
  ['Sữa đặc', 'Sữa', 'ml', 95, 3000], ['Sữa tươi thanh trùng', 'Sữa', 'ml', 42, 8000], ['Bột sữa béo', 'Sữa', 'g', 180, 5000],
  ['Kem béo pha chế', 'Sữa', 'g', 210, 3000], ['Sữa chua', 'Sữa', 'g', 130, 1500], ['Whipping cream', 'Sữa', 'ml', 260, 2000],
  ['Cà phê Robusta rang', 'Cà phê', 'g', 480, 3000], ['Cà phê Arabica rang', 'Cà phê', 'g', 720, 2000],
  ['Cà phê hạt Colombia', 'Cà phê', 'g', 680, 1000], ['Espresso cold brew', 'Cà phê', 'ml', 420, 1500],
  ['Đường cát trắng', 'Đường', 'g', 22, 10000], ['Đường đen Hàn', 'Đường', 'g', 48, 4000], ['Syrup đường', 'Đường', 'ml', 55, 3000],
  ['Mật ong', 'Đường', 'ml', 260, 1200], ['Đường phèn', 'Đường', 'g', 65, 1500],
  ['Syrup đào', 'Syrup', 'ml', 130, 3000], ['Syrup vải', 'Syrup', 'ml', 130, 2000], ['Syrup dâu', 'Syrup', 'ml', 120, 2500],
  ['Syrup xoài', 'Syrup', 'ml', 120, 2000], ['Syrup việt quất', 'Syrup', 'ml', 140, 1500], ['Syrup chanh dây', 'Syrup', 'ml', 110, 1800],
  ['Syrup socola', 'Syrup', 'ml', 160, 2000], ['Syrup caramel', 'Syrup', 'ml', 165, 1500], ['Syrup bạc hà', 'Syrup', 'ml', 120, 800],
  ['Trân châu đen', 'Topping NVL', 'g', 68, 5000], ['Trân châu trắng', 'Topping NVL', 'g', 72, 4000], ['Bột pudding', 'Topping NVL', 'g', 150, 2000],
  ['Thạch phô mai', 'Topping NVL', 'g', 140, 2000], ['Sương sáo bột', 'Topping NVL', 'g', 110, 1500], ['Hạt chia', 'Topping NVL', 'g', 380, 800],
  ['Thạch cà phê', 'Topping NVL', 'g', 120, 1200], ['Khoai môn', 'Topping NVL', 'g', 160, 2000], ['Đào ngâm', 'Trái cây', 'g', 210, 2500],
  ['Vải ngâm', 'Trái cây', 'g', 230, 2000], ['Dâu tằm tươi', 'Trái cây', 'g', 280, 1500], ['Xoài tươi', 'Trái cây', 'g', 130, 3000],
  ['Cam vàng', 'Trái cây', 'g', 110, 3000], ['Ổi hồng', 'Trái cây', 'g', 75, 2000], ['Chanh dây', 'Trái cây', 'g', 95, 1500],
  ['Chanh tươi', 'Trái cây', 'g', 60, 2000], ['Sả tươi', 'Trái cây', 'g', 45, 1500], ['Gừng', 'Trái cây', 'g', 85, 1000],
  ['Bơ sáp', 'Trái cây', 'g', 180, 2000], ['Kem tươi whipping', 'Sữa', 'ml', 210, 1500],
  ['Đá viên', 'Khác', 'g', 2, 20000], ['Nước tinh khiết', 'Khác', 'ml', 1, 50000],
  ['Bột cacao', 'Khác', 'g', 320, 1500], ['Sốt socola', 'Khác', 'ml', 170, 1200], ['Cookie vụn', 'Khác', 'g', 240, 1200],
  ['Bánh mì que', 'Bánh', 'cái', 9000, 60], ['Pate gan', 'Bánh', 'g', 160, 800], ['Bánh flan', 'Bánh', 'cái', 7500, 40],
  ['Bột làm flan', 'Bánh', 'g', 130, 1000], ['Croissant bơ', 'Bánh', 'cái', 12500, 40], ['Su kem', 'Bánh', 'cái', 8500, 40],
  ['Cookie matcha', 'Bánh', 'cái', 9500, 40], ['Cheesecake', 'Bánh', 'cái', 21000, 20], ['Hạnh nhân lát', 'Khác', 'g', 420, 600],
  ['Ly nhựa 500ml', 'Bao bì', 'cái', 1450, 500], ['Ly nhựa 700ml', 'Bao bì', 'cái', 1750, 500], ['Ly nhựa 350ml', 'Bao bì', 'cái', 1250, 400],
  ['Nắp ly', 'Bao bì', 'cái', 420, 800], ['Ống hút giấy', 'Bao bì', 'cái', 260, 1000], ['Ống hút nhựa', 'Bao bì', 'cái', 180, 800],
  ['Túi giấy', 'Bao bì', 'cái', 1900, 300], ['Tem dán ly', 'Bao bì', 'cái', 120, 2000], ['Khăn giấy', 'Bao bì', 'cái', 90, 2000],
  ['Cốc giấy', 'Bao bì', 'cái', 850, 400], ['Hộp bánh', 'Bao bì', 'cái', 2400, 150],
]

const SUPPLIERS: [string, string, string][] = [
  ['Công ty Trà Việt Nam', 'Nguyễn Văn Hùng', '0903 121 456'], ['Sữa Vinamilk — CN Miền Nam', 'Trần Thị Lan', '0918 776 221'],
  ['Đại lý Matcha Nhật Bản', 'Phạm Anh Dũng', '0932 445 118'], ['Cà phê Trung Nguyên', 'Lê Hoàng Yến', '0987 332 004'],
  ['Syrup Golden Farm', 'Vũ Minh Quân', '0912 887 334'], ['Trân châu Tân Nhất Hương', 'Đặng Thu Trang', '0977 665 210'],
  ['Nông trại Đà Lạt Xanh', 'Bùi Văn Sơn', '0938 221 774'], ['Bao bì Nhựa Sài Gòn', 'Ngô Thị Hạnh', '0909 553 601'],
  ['Thực phẩm Rich Products', 'Trịnh Quốc Anh', '0918 004 552'], ['Bột Matcha Shizuoka', 'Lý Bảo Châu', '0967 118 336'],
  ['Nước đá tinh khiết Vĩnh An', 'Hồ Minh Tuấn', '0931 447 990'], ['Bánh ngọt Le Petit', 'Phan Thanh Mai', '0902 776 118'],
  ['Hạt chia Úc Nhập khẩu', 'Đinh Văn Lâm', '0945 220 663'], ['Cà phê Arabica Cầu Đất', 'Trần Quốc Việt', '0988 331 220'],
  ['Tổng kho Topping Chợ Lớn', 'Châu Thị Ngọc', '0913 887 556'],
]

/* ------------------------------ danh mục NVL ------------------------------ */
const ingIdx = new Map<string, number>(INGREDIENTS.map((r, i) => [r[0], i]))

type RecipeLine = [string, number] // [ingredient, qty cho size M]

const RECIPES: Record<string, RecipeLine[]> = {
  'Trà sữa trân châu đường đen': [['Trà đen sợi', 9], ['Bột sữa béo', 22], ['Sữa đặc', 25], ['Đường đen Hàn', 18], ['Trân châu đen', 45], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1], ['Đá viên', 150]],
  'Trà sữa Oolong': [['Trà oolong', 8], ['Bột sữa béo', 20], ['Đường cát trắng', 15], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1], ['Đá viên', 150]],
  'Hồng trà sữa': [['Hồng trà', 8], ['Sữa tươi thanh trùng', 60], ['Đường cát trắng', 12], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1], ['Đá viên', 150]],
  'Trà sữa khoai môn': [['Trà đen sợi', 7], ['Bột sữa béo', 18], ['Khoai môn', 40], ['Đường cát trắng', 14], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Trà sữa Matcha trân châu': [['Bột matcha Uji', 6], ['Bột sữa béo', 20], ['Sữa đặc', 20], ['Trân châu đen', 40], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Trà sữa Thái xanh': [['Trà xanh Thái Nguyên', 8], ['Bột sữa béo', 22], ['Sữa đặc', 22], ['Đường cát trắng', 10], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Trà đào cam sả': [['Trà đào túi lọc', 6], ['Đào ngâm', 45], ['Cam vàng', 35], ['Sả tươi', 12], ['Syrup đào', 25], ['Đường phèn', 12], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1], ['Đá viên', 200]],
  'Trà vải hạt chia': [['Trà vải túi lọc', 6], ['Vải ngâm', 50], ['Hạt chia', 6], ['Syrup vải', 20], ['Đường cát trắng', 10], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Trà dâu tằm': [['Trà xanh Thái Nguyên', 6], ['Dâu tằm tươi', 60], ['Syrup dâu', 25], ['Đường cát trắng', 12], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Trà xoài nhiệt đới': [['Trà xoài hương', 6], ['Xoài tươi', 70], ['Syrup xoài', 25], ['Đường cát trắng', 10], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Trà chanh sả gừng': [['Trà chanh sả', 6], ['Chanh tươi', 30], ['Sả tươi', 15], ['Gừng', 8], ['Syrup đường', 25], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Trà ổi hồng': [['Trà ổi', 6], ['Ổi hồng', 65], ['Syrup đường', 22], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Cà phê đen đá': [['Cà phê Robusta rang', 18], ['Đường cát trắng', 8], ['Ly nhựa 350ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1], ['Đá viên', 140]],
  'Cà phê sữa đá': [['Cà phê Robusta rang', 18], ['Sữa đặc', 30], ['Ly nhựa 350ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1], ['Đá viên', 140]],
  'Bạc xỉu': [['Cà phê Robusta rang', 10], ['Sữa tươi thanh trùng', 90], ['Sữa đặc', 15], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Cà phê muối': [['Cà phê Arabica rang', 18], ['Whipping cream', 45], ['Sữa đặc', 12], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Cappuccino': [['Cà phê Arabica rang', 18], ['Sữa tươi thanh trùng', 120], ['Cốc giấy', 1], ['Nắp ly', 1]],
  'Latte': [['Cà phê Arabica rang', 18], ['Sữa tươi thanh trùng', 150], ['Cốc giấy', 1], ['Nắp ly', 1]],
  'Americano cam': [['Cà phê Arabica rang', 18], ['Cam vàng', 40], ['Syrup đường', 15], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Espresso tonic': [['Cà phê hạt Colombia', 18], ['Nước tinh khiết', 150], ['Syrup đường', 20], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Matcha latte': [['Bột matcha ceremonial', 5], ['Sữa tươi thanh trùng', 150], ['Syrup đường', 18], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Matcha đá xay': [['Bột matcha Uji', 7], ['Kem béo pha chế', 40], ['Sữa tươi thanh trùng', 90], ['Đá viên', 200], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Matcha kem cheese': [['Bột matcha ceremonial', 6], ['Sữa tươi thanh trùng', 120], ['Kem béo pha chế', 35], ['Thạch phô mai', 30], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Matcha trái cây': [['Bột matcha Uji', 6], ['Xoài tươi', 45], ['Syrup đường', 15], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Matcha whisk đá': [['Bột matcha ceremonial', 5], ['Nước tinh khiết', 180], ['Đá viên', 160], ['Ly nhựa 350ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Đá xay socola': [['Bột cacao', 18], ['Sữa tươi thanh trùng', 100], ['Kem béo pha chế', 35], ['Sốt socola', 25], ['Đá viên', 220], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Đá xay cookie': [['Cookie vụn', 30], ['Sữa tươi thanh trùng', 110], ['Kem béo pha chế', 40], ['Đá viên', 220], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Đá xay việt quất': [['Syrup việt quất', 45], ['Sữa tươi thanh trùng', 100], ['Kem béo pha chế', 30], ['Đá viên', 220], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Đá xay bơ': [['Bơ sáp', 70], ['Sữa đặc', 25], ['Sữa tươi thanh trùng', 80], ['Đá viên', 220], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Sinh tố xoài': [['Xoài tươi', 120], ['Sữa chua', 40], ['Sữa đặc', 20], ['Đá viên', 180], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Soda chanh dây': [['Chanh dây', 45], ['Syrup chanh dây', 30], ['Nước tinh khiết', 200], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1], ['Đá viên', 180]],
  'Soda dâu': [['Dâu tằm tươi', 50], ['Syrup dâu', 30], ['Nước tinh khiết', 200], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1], ['Đá viên', 180]],
  'Sữa tươi trân châu đường đen': [['Sữa tươi thanh trùng', 180], ['Đường đen Hàn', 25], ['Trân châu đen', 45], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1], ['Đá viên', 120]],
  'Cacao sữa đá': [['Bột cacao', 15], ['Sữa đặc', 25], ['Sữa tươi thanh trùng', 80], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Ống hút giấy', 1]],
  'Bánh mì que pate': [['Bánh mì que', 1], ['Pate gan', 25], ['Túi giấy', 1]],
  'Bánh flan cà phê': [['Bánh flan', 1], ['Bột làm flan', 10], ['Hộp bánh', 1]],
  'Croissant bơ': [['Croissant bơ', 1], ['Túi giấy', 1]],
  'Bánh su kem': [['Su kem', 1], ['Hộp bánh', 1]],
  'Cookie matcha hạnh nhân': [['Cookie matcha', 1], ['Hạnh nhân lát', 5], ['Túi giấy', 1]],
  'Cheesecake chanh dây': [['Cheesecake', 1], ['Chanh dây', 15], ['Hộp bánh', 1]],
  'Trân châu ly riêng': [['Trân châu đen', 60], ['Ly nhựa 350ml', 1], ['Nắp ly', 1], ['Ống hút nhựa', 1]],
  'Kem cheese thêm': [['Kem béo pha chế', 45], ['Thạch phô mai', 25], ['Ly nhựa 350ml', 1]],
  'Combo Trà sữa + Bánh': [['Trà đen sợi', 9], ['Bột sữa béo', 22], ['Sữa đặc', 25], ['Trân châu đen', 45], ['Bánh mì que', 1], ['Pate gan', 20], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Túi giấy', 1]],
  'Combo Matcha + Croissant': [['Bột matcha ceremonial', 5], ['Sữa tươi thanh trùng', 150], ['Croissant bơ', 1], ['Ly nhựa 500ml', 1], ['Nắp ly', 1], ['Túi giấy', 1]],
  'Combo 2 Trà sữa': [['Trà đen sợi', 18], ['Bột sữa béo', 44], ['Sữa đặc', 50], ['Trân châu đen', 90], ['Ly nhựa 500ml', 2], ['Nắp ly', 2], ['Ống hút giấy', 2], ['Túi giấy', 1]],
  'Combo Cà phê + Bánh mì que': [['Cà phê Robusta rang', 18], ['Sữa đặc', 30], ['Bánh mì que', 1], ['Ly nhựa 350ml', 1], ['Nắp ly', 1], ['Túi giấy', 1]],
  'Combo Đá xay + Cookie': [['Bột cacao', 18], ['Sữa tươi thanh trùng', 100], ['Kem béo pha chế', 35], ['Cookie matcha', 1], ['Ly nhựa 700ml', 1], ['Nắp ly', 1], ['Túi giấy', 1]],
}

const CUSTOMER_FIRST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý', 'Trịnh', 'Đinh', 'Phan']
const CUSTOMER_MID = ['Thị', 'Văn', 'Minh', 'Thu', 'Hoàng', 'Quốc', 'Ngọc', 'Thanh', 'Hải', 'Gia', 'Khánh', 'Anh']
const CUSTOMER_LAST = ['An', 'Bình', 'Châu', 'Dũng', 'Hà', 'Hân', 'Huy', 'Khoa', 'Lan', 'Linh', 'Mai', 'Nam', 'Nga', 'Nhung', 'Phúc', 'Quân', 'Quỳnh', 'Sơn', 'Trang', 'Trâm', 'Tú', 'Vy', 'Yến', 'Thảo', 'My']

const CHANNEL_WEIGHT: [string, number, number][] = [
  // [channel, weight, source distribution index]
  ['dine_in', 44, 0], ['takeaway', 41, 0], ['delivery', 15, 0],
]
const SOURCE_BY_CHANNEL: Record<string, [string, number][]> = {
  dine_in: [['pos', 100]],
  takeaway: [['pos', 100]],
  delivery: [['grabfood', 46], ['shopeefood', 28], ['website', 16], ['app', 10]],
}
const PAY_BY_CHANNEL: Record<string, [string, number][]> = {
  dine_in: [['cash', 38], ['qr', 30], ['card', 12], ['momo', 12], ['zalopay', 8]],
  takeaway: [['cash', 41], ['qr', 34], ['momo', 15], ['zalopay', 10]],
  delivery: [['qr', 34], ['momo', 30], ['zalopay', 18], ['cash', 10], ['credit', 8]],
}

function weighted<T extends string>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, p) => s + p[1], 0)
  let r = rnd() * total
  for (const [v, w] of pairs) {
    r -= w
    if (r <= 0) return v
  }
  return pairs[0][0]
}

/** Hệ số giờ cao điểm trong ngày (0..23) */
function hourWeight(h: number) {
  const table: Record<number, number> = {
    6: 0.2, 7: 1.6, 8: 2.2, 9: 1.9, 10: 1.1, 11: 2.6, 12: 2.9, 13: 2.4, 14: 1.5, 15: 1.2,
    16: 1.5, 17: 2.0, 18: 2.8, 19: 3.1, 20: 2.6, 21: 1.6, 22: 0.7,
  }
  return table[h] ?? 0
}

export interface SeedResult {
  counts: Record<string, number>
  seededAt: string
}

/* --------------------------------- seed ---------------------------------- */
export function seedDatabase(db: Database): SeedResult {
  db.run(DDL)
  db.run('BEGIN')
  const counts: Record<string, number> = {}
  const ins = (table: string, row: Record<string, unknown>) => {
    const cols = Object.keys(row)
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    stmt.run(cols.map((c) => row[c] as any))
    stmt.free()
  }

  /* ---- chi nhánh, người dùng, danh mục ---- */
  BRANCHES.forEach((b, i) =>
    ins('branches', { id: i + 1, code: b.code, name: b.name, address: b.address, city: b.city, phone: b.phone, vat_rate: b.vat_rate, is_active: 1, opened_at: b.opened_at }),
  )
  USERS.forEach((u, i) =>
    ins('users', {
      id: i + 1, name: u.name, email: u.email, phone: `09${10 + i}${100000 + i * 7919}`,
      password: '123456', role: u.role, branch_id: u.branch, salary: u.salary, is_active: 1,
      hired_at: `202${3 + (i % 3)}-0${(i % 9) + 1}-1${i % 9}`, avatar_emoji: u.emoji,
    }),
  )
  CATEGORIES.forEach((c, i) => ins('categories', { id: i + 1, name: c.name, slug: c.slug, emoji: c.emoji, sort_order: i + 1, is_active: 1 }))

  /* ---- sản phẩm, size, topping ---- */
  const productIds: number[] = []
  const productCost = new Map<number, number>()
  PRODUCTS.forEach((p, i) => {
    const id = i + 1
    productIds.push(id)
    ins('products', {
      id, sku: `SP${String(id).padStart(3, '0')}`, name: p.name, category_id: p.cat + 1, description: p.desc ?? null,
      base_price: p.price, cost_price: 0, unit: p.noSize ? 'phần' : 'ly', emoji: p.emoji, image_url: null,
      is_active: 1, is_bestseller: p.best ? 1 : 0, has_size: p.noSize ? 0 : 1,
      sugar_option: p.cat === 6 ? 0 : 1, ice_option: p.cat === 6 ? 0 : 1,
      created_at: `2026-0${(i % 8) + 1}-1${i % 9} 09:00:00`,
    })
    if (!p.noSize) {
      ;([['S', 'Size S', -4000], ['M', 'Size M', 0], ['L', 'Size L', 6000]] as [string, string, number][]).forEach(([code, name, delta], si) =>
        ins('product_sizes', { id: id * 10 + si, product_id: id, code, name, price_delta: delta }),
      )
    }
  })
  TOPPINGS.forEach(([name, price], i) => ins('toppings', { id: i + 1, name, price, unit: 'phần', is_active: 1 }))

  // món ↔ topping (trà sữa/trà trái cây/matcha nhận nhiều topping, bánh thì không)
  PRODUCTS.forEach((p, i) => {
    const pid = i + 1
    if (p.cat === 6 || p.cat === 5) return
    const allowed = [1, 2, 3, 4, 5, 6, 7].filter(() => chance(0.78))
    const extra = p.cat === 0 ? [11, 12] : p.cat === 1 ? [9, 10] : []
    ;[...new Set([...allowed, ...extra])].forEach((t) => ins('product_toppings', { product_id: pid, topping_id: t }))
  })

  /* ---- NCC + nguyên liệu ---- */
  SUPPLIERS.forEach(([name, contact, phone], i) =>
    ins('suppliers', {
      id: i + 1, code: `NCC${String(i + 1).padStart(3, '0')}`, name, contact_name: contact, phone,
      email: `lienhe${i + 1}@nhacungcap.vn`, address: `${100 + i * 7} đường số ${i + 2}, TP.HCM`,
      debt: [0, 12500000, 4800000, 0, 7600000, 0, 3100000, 0, 15800000, 2400000, 0, 900000, 0, 5200000, 0][i],
      payment_terms: i % 3 === 0 ? 'Trả ngay' : i % 3 === 1 ? 'Công nợ 15 ngày' : 'Công nợ 30 ngày',
    }),
  )
  INGREDIENTS.forEach(([name, category, unit, unitCost, minStock], i) => {
    const supplierIdx = ['Trà', 'Matcha', 'Cà phê', 'Syrup'].includes(category)
      ? [0, 2, 3, 4, 9, 13][i % 6]
      : category === 'Sữa' ? 1 : category === 'Trái cây' ? 6 : category === 'Bao bì' ? 7 : category === 'Bánh' ? 11 : 5
    ins('ingredients', {
      id: i + 1, sku: `NL${String(i + 1).padStart(3, '0')}`, name, category, unit, unit_cost: unitCost,
      min_stock: minStock, supplier_id: supplierIdx + 1, shelf_life_days: category === 'Bao bì' ? null : ri(14, 240), is_active: 1,
    })
  })

  /* ---- công thức + giá vốn món ---- */
  let recipeId = 1
  PRODUCTS.forEach((p, i) => {
    const pid = i + 1
    const lines = RECIPES[p.name] ?? []
    const sizes: [string, number][] = p.noSize ? [['M', 1]] : [['S', 0.85], ['M', 1], ['L', 1.2]]
    let costM = 0
    sizes.forEach(([code, factor]) => {
      lines.forEach(([ingName, qty]) => {
        const idx = ingIdx.get(ingName)
        if (idx === undefined) throw new Error(`Nguyên liệu không tồn tại: ${ingName}`)
        const q = Math.max(1, Math.round(qty * factor))
        ins('recipes', { id: recipeId++, product_id: pid, size_code: code, ingredient_id: idx + 1, qty: q })
        if (code === 'M') costM += qty * INGREDIENTS[idx][3]
      })
    })
    const cost = Math.round(costM / 100) * 100
    productCost.set(pid, cost)
    db.run(`UPDATE products SET cost_price = ${cost} WHERE id = ${pid}`)
  })

  /* ---- bàn ---- */
  let tableId = 1
  const tablesByBranch: number[][] = []
  BRANCHES.forEach((_, bi) => {
    const ids: number[] = []
    const zones: [string, number][] = [['Tầng trệt', 6], ['Sân vườn', 3], ['Tầng 1', 3]]
    let n = 1
    zones.forEach(([zone, count], zi) => {
      for (let k = 0; k < count; k++) {
        ins('dining_tables', {
          id: tableId, branch_id: bi + 1, code: `B${bi + 1}-${String(n).padStart(2, '0')}`,
          name: `Bàn ${n}`, zone, seats: zone === 'Sân vườn' ? 2 : k % 3 === 0 ? 6 : 4,
          x: 40 + (k % 3) * 150, y: 40 + zi * 150, status: 'empty',
        })
        ids.push(tableId)
        tableId++
        n++
      }
    })
    tablesByBranch.push(ids)
  })

  /* ---- khách hàng ---- */
  const CUSTOMERS = 220
  const usedPhones = new Set<string>()
  const customerIds: number[] = []
  for (let i = 0; i < CUSTOMERS; i++) {
    const id = i + 1
    customerIds.push(id)
    let phone = ''
    do {
      phone = `0${pick(['9', '8', '7', '3', '5'])}${ri(10000000, 99999999)}`
    } while (usedPhones.has(phone))
    usedPhones.add(phone)
    ins('customers', {
      id, code: `KH${String(id).padStart(4, '0')}`,
      name: `${pick(CUSTOMER_FIRST)} ${pick(CUSTOMER_MID)} ${pick(CUSTOMER_LAST)}`,
      phone, email: chance(0.45) ? `khach${id}@gmail.com` : null,
      birthday: `${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`,
      tier: 'bronze', points: 0, total_spent: 0, order_count: 0,
      note: chance(0.12) ? pick(['Khách VIP, thích ít đá', 'Dị ứng sữa bò', 'Thường đặt giao Gia Định', 'Nhân viên văn phòng toà nhà bên cạnh']) : null,
      created_at: `2026-0${ri(1, 8)}-${String(ri(1, 27)).padStart(2, '0')} ${String(ri(8, 20)).padStart(2, '0')}:${String(ri(0, 59)).padStart(2, '0')}:00`,
    })
  }

  /* ---- voucher + CTKM ---- */
  const VOUCHERS: [string, string, string, string, number, number, number | null, number | null, string | null][] = [
    ['MATCHA20', 'Giảm 20% toàn menu', 'Ra mắt chi nhánh Cầu Giấy', 'percent', 20, 100000, 40000, 500, null],
    ['FREESHIP', 'Freeship đơn từ 150k', 'Đẩy mạnh kênh giao hàng', 'fixed', 20000, 150000, null, 300, null],
    ['GOLD50', 'Giảm 50k cho hạng Vàng', 'Tri ân khách thân thiết', 'fixed', 50000, 200000, null, 200, 'gold'],
    ['TRA10', 'Giảm 10% trà trái cây', 'Mùa trái cây hè', 'percent', 10, 80000, 25000, 1000, null],
    ['SINHNHAT', 'Tặng 30k sinh nhật', 'Chúc mừng sinh nhật', 'fixed', 30000, 0, null, null, null],
    ['COMBO15', 'Giảm 15% combo', 'Combo mùa tựu trường', 'percent', 15, 120000, 30000, 400, 'silver'],
  ]
  VOUCHERS.forEach(([code, name, campaign, type, value, minOrder, maxDiscount, usageLimit, tier], i) =>
    ins('vouchers', {
      id: i + 1, code, name, campaign, type, value, min_order: minOrder, max_discount: maxDiscount,
      usage_limit: usageLimit, used_count: 0, tier_required: tier, start_at: '2026-08-01 00:00:00',
      end_at: '2026-12-31 23:59:59', is_active: 1,
    }),
  )
  const PROMOS: [string, string, string][] = [
    ['Giờ vàng 14h–16h giảm 20%', 'happy_hour', JSON.stringify({ from: 14, to: 16, percent: 20, max: 30000 })],
    ['Giảm giá theo hạng thành viên', 'tier_discount', JSON.stringify({ bronze: 0, silver: 3, gold: 5, diamond: 8 })],
    ['Combo tiết kiệm mua 2 tặng 1 bánh', 'bogo', JSON.stringify({ buy: 2, free: 1, categoryIds: [7] })],
    ['Matcha Monday giảm 15%', 'happy_hour', JSON.stringify({ weekday: 1, percent: 15, max: 25000 })],
  ]
  PROMOS.forEach(([name, type, config], i) =>
    ins('promotions', { id: i + 1, name, type, config, branch_id: null, start_at: '2026-08-01 00:00:00', end_at: '2026-12-31 23:59:59', is_active: 1, created_at: '2026-08-01 09:00:00' }),
  )

  /* ---- ca làm việc (60 ngày gần nhất) ---- */
  const cashiers = USERS.map((u, i) => ({ ...u, id: i + 1 })).filter((u) => u.role === 'cashier' || u.role === 'manager')
  let shiftId = 1
  const shiftsByBranchDay = new Map<string, number>()
  for (let d = 59; d >= 0; d--) {
    const day = new Date(NOW)
    day.setUTCDate(day.getUTCDate() - d)
    BRANCHES.forEach((_, bi) => {
      const branchStaff = cashiers.filter((c) => c.branch === bi + 1)
      const cashier = branchStaff.length ? pick(branchStaff) : cashiers[0]
      const open = new Date(day)
      open.setUTCHours(7, 30, 0, 0)
      const close = new Date(day)
      close.setUTCHours(22, 30, 0, 0)
      const isToday = d === 0
      const openingCash = 500000
      const cashIn = ri(0, 3) * 1000000
      const counted = 0
      ins('shifts', {
        id: shiftId, branch_id: bi + 1, user_id: cashier.id, opened_at: vnString(open),
        closed_at: isToday ? null : vnString(close), opening_cash: openingCash, cash_in: cashIn, cash_out: 0,
        counted_cash: isToday ? null : null, expected_cash: null, variance: null,
        status: isToday ? 'open' : 'closed', note: null,
      })
      shiftsByBranchDay.set(`${bi + 1}-${d}`, shiftId)
      shiftId++
    })
  }

  /* ---- đơn hàng 90 ngày ---- */
  const ordersByDay: { branchId: number; hour: number; date: string }[] = []
  let orderId = 1
  let itemId = 1
  let oitId = 1
  let paymentId = 1
  let eventId = 1
  let queueCounter = new Map<string, number>()
  let invTxnId = 1

  const consumption = new Map<string, number>() // `${branch}-${ing}` → qty (tổng 90 ngày)
  // Chi tiết tiêu hao: 30 ngày gần nhất ghi theo từng đơn, cũ hơn ghi gộp theo ngày
  const consumptionEntries: { orderId: number; branchId: number; ingId: number; qty: number; date: string; at: string }[] = []
  let cogsTotal = 0

  const bestsellerIds = PRODUCTS.map((p, i) => ({ id: i + 1, cat: p.cat, best: p.best, noSize: p.noSize }))

  const tierStats = new Map<number, { spent: number; count: number }>()

  for (let d = DAYS - 1; d >= 0; d--) {
    const day = new Date(NOW)
    day.setUTCDate(day.getUTCDate() - d)
    const dow = day.getUTCDay()
    const weekend = dow === 0 || dow === 6
    const dayFactor = (weekend ? 1.38 : 1) * (d < 2 ? 0.55 : 1)
    BRANCHES.forEach((_, bi) => {
      const branchShare = [0.42, 0.33, 0.25][bi]
      const baseOrders = 40 * dayFactor * branchShare
      const n = Math.max(3, Math.round(baseOrders + ri(-4, 5)))
      const shiftForDay = shiftsByBranchDay.get(`${bi + 1}-${d}`) ?? shiftId - 1

      for (let k = 0; k < n; k++) {
        // chọn giờ theo trọng số
        let hour = 12
        let guard = 0
        do {
          hour = ri(7, 21)
          guard++
        } while (chance(0.65) && hourWeight(hour) < rnd() * 3.2 && guard < 12)

        // Ngày hôm nay: dồn đơn vào khoảng đã trôi qua (7h → giờ hiện tại) để quầy luôn có đơn
        if (d === 0) {
          const nowHour = Math.max(8, NOW.getUTCHours())
          hour = 7 + ((hour - 7) % Math.max(1, nowHour - 6))
        }
        const minute = hour === NOW.getUTCHours() ? ri(0, Math.max(1, NOW.getUTCMinutes() - 1)) : ri(0, 59)
        const created = new Date(day)
        created.setUTCHours(hour, minute, ri(0, 59), 0)
        if (created > NOW) continue

        const channel = weighted([['dine_in', 44], ['takeaway', 41], ['delivery', 15]] as [string, number][]) as 'dine_in' | 'takeaway' | 'delivery'
        const source = channel === 'delivery' ? weighted(SOURCE_BY_CHANNEL.delivery) : 'pos'
        const staffOfBranch = cashiers.filter((c) => c.branch === bi + 1)
        const cashierId = (staffOfBranch.length ? pick(staffOfBranch) : cashiers[0]).id
        const withCustomer = chance(channel === 'delivery' ? 0.72 : 0.42)
        const regulars = customerIds.slice(0, 44) // ~20% khách quen
        const customerId = withCustomer ? (chance(0.62) ? pick(regulars) : pick(customerIds)) : null
        const status: 'completed' | 'cancelled' | 'pending' | 'preparing' | 'ready' =
          d === 0 && chance(0.3) ? pick(['pending', 'preparing', 'ready'] as const) : chance(0.02) ? 'cancelled' : 'completed'

        const queueKey = `${bi + 1}-${dateOnly(created)}`
        let queueNo = queueCounter.get(queueKey) ?? 0
        if (channel !== 'dine_in') {
          queueNo++
          queueCounter.set(queueKey, queueNo)
        }

        /* chọn món */
        const lineCount = chance(0.58) ? 1 : chance(0.72) ? 2 : chance(0.85) ? 3 : 4
        let subtotal = 0
        let cogs = 0
        const lines: {
          productId: number; name: string; size: string; sugar: number; ice: number; qty: number;
          unitPrice: number; unitCost: number; toppings: { id: number; name: string; qty: number; price: number }[]; note: string | null
        }[] = []

        for (let li = 0; li < lineCount; li++) {
          const weightedPool = bestsellerIds.filter((p) => p.best)
          const prod = chance(0.42) ? pick(weightedPool) : pick(bestsellerIds)
          const p = PRODUCTS[prod.id - 1]
          const qty = chance(0.82) ? 1 : chance(0.9) ? 2 : 3
          const size = p.noSize ? 'M' : (pick(['S', 'M', 'M', 'L']) as 'S' | 'M' | 'L')
          const sizeDelta = size === 'S' ? -4000 : size === 'L' ? 6000 : 0
          const toppings: { id: number; name: string; qty: number; price: number }[] = []
          if (!p.noSize && chance(0.38)) {
            const candidates = TOPPINGS.map((t, i) => ({ ...t, id: i + 1 })).filter(() => chance(0.3)).slice(0, 2)
            candidates.forEach((t) => toppings.push({ id: t.id, name: t[0] as string, qty: 1, price: t[1] as number }))
          }
          const toppingTotal = toppings.reduce((s, t) => s + t.price * t.qty, 0)
          const unitPrice = p.price + sizeDelta + toppingTotal
          const unitCost = productCost.get(prod.id) ?? 0
          subtotal += unitPrice * qty
          cogs += unitCost * qty
          lines.push({
            productId: prod.id, name: p.name, size, sugar: p.cat === 6 ? 100 : pick([0, 30, 50, 50, 70, 70, 100, 100]),
            ice: p.cat === 6 ? 100 : pick([0, 30, 50, 70, 70, 100, 100]), qty, unitPrice, unitCost, toppings,
            note: chance(0.12) ? pick(['Ít ngọt', 'Không đá', 'Nhiều trân châu', 'Cho thêm ống hút', 'Uống tại quán']) : null,
          })
        }

        /* CTKM tự động: giờ vàng 14-16h (20%, tối đa 30k) hoặc thứ 2 matcha 15% */
        let promoDiscount = 0
        if (hour >= 14 && hour < 16) promoDiscount = Math.min(30000, Math.round(subtotal * 0.2))
        else if (dow === 1) promoDiscount = Math.min(25000, Math.round(subtotal * 0.15))
        if (channel === 'delivery') promoDiscount = Math.round(promoDiscount * 0.5)

        /* voucher (10% đơn) */
        let voucherId: number | null = null
        let voucherDiscount = 0
        if (chance(0.12)) {
          const v = ri(1, 6)
          const vc = VOUCHERS[v - 1]
          const minOrder = vc[5]
          const val = vc[4]
          const isPercent = vc[3] === 'percent'
          if (subtotal >= minOrder) {
            voucherId = v
            voucherDiscount = isPercent ? Math.min(vc[6] ?? 999999, Math.round((subtotal * val) / 100)) : val
          }
        }

        const deliveryFee = channel === 'delivery' ? (chance(0.6) ? 15000 : 20000) : 0
        const vatRate = BRANCHES[bi].vat_rate
        const taxed = Math.max(0, subtotal - promoDiscount - voucherDiscount)
        const vatAmount = Math.round((taxed * vatRate) / (1 + vatRate)) // giá đã bao gồm thuế → tách phần thuế
        const total = taxed + deliveryFee
        if (status === 'cancelled') {
          // đơn huỷ không ghi nhận doanh thu/thanh toán, nhưng vẫn giữ dòng đơn để báo cáo
        }

        ins('orders', {
          id: orderId, code: `HD${vnString(created).slice(0, 10).replace(/-/g, '')}-${String(orderId).padStart(4, '0')}`,
          branch_id: bi + 1, channel, source, table_id: channel === 'dine_in' ? pick(tablesByBranch[bi]) : null,
          customer_id: customerId, cashier_id: cashierId, shift_id: shiftForDay,
          queue_no: channel === 'dine_in' ? null : queueNo, status,
          subtotal, item_discount: 0, promotion_discount: promoDiscount, voucher_id: voucherId, voucher_discount: voucherDiscount,
          vat_amount: vatAmount, delivery_fee: deliveryFee, points_used: 0, points_earned: 0,
          total, cogs, note: chance(0.08) ? pick(['Khách hẹn lấy lúc 18h', 'Giao tầng 12 toà nhà', 'Đơn của khách quen']) : null,
          cancel_reason: status === 'cancelled' ? pick(['Khách đổi ý', 'Hết nguyên liệu', 'Nhập nhầm món', 'Khách không nhận máy']) : null,
          created_at: vnString(created), preparing_at: null, ready_at: null, completed_at: null,
        })

        /* dòng đơn */
        lines.forEach((l) => {
          const thisItemId = itemId++
          ins('order_items', {
            id: thisItemId, order_id: orderId, product_id: l.productId, product_name: l.name, size_code: l.size,
            sugar_level: l.sugar, ice_level: l.ice, qty: l.qty, unit_price: l.unitPrice, discount: 0,
            unit_cost: l.unitCost, note: l.note,
          })
          l.toppings.forEach((t) =>
            ins('order_item_toppings', { id: oitId++, order_item_id: thisItemId, topping_id: t.id, topping_name: t.name, qty: t.qty, price: t.price }),
          )
          // trừ kho theo công thức
          const recs = lines.length ? RECIPE_LOOKUP.get(`${l.productId}-${l.size}`) ?? [] : []
          if (status === 'cancelled') return
          recs.forEach(([ingId, qty]) => {
            const key = `${bi + 1}-${ingId}`
            const used = qty * l.qty
            consumption.set(key, (consumption.get(key) ?? 0) + used)
            consumptionEntries.push({ orderId, branchId: bi + 1, ingId, qty: used, date: dateOnly(created), at: vnString(created) })
          })
        })

        /* thanh toán */
        if (status !== 'cancelled') {
          const method = weighted(PAY_BY_CHANNEL[channel])
          const split = total > 300000 && chance(0.08)
          if (split) {
            const first = Math.round(total * 0.6)
            ins('payments', { id: paymentId++, order_id: orderId, method: 'cash', amount: first, paid_at: vnString(created), ref: null })
            ins('payments', { id: paymentId++, order_id: orderId, method: 'qr', amount: total - first, paid_at: vnString(created), ref: `QR${orderId}` })
          } else {
            ins('payments', {
              id: paymentId++, order_id: orderId, method, amount: total, paid_at: vnString(created),
              ref: method === 'cash' ? null : `${method.toUpperCase()}${100000 + orderId}`,
            })
          }
          // điểm + chi tiêu khách
          if (customerId) {
            const st = tierStats.get(customerId) ?? { spent: 0, count: 0 }
            st.spent += total
            st.count += 1
            tierStats.set(customerId, st)
          }
        }

        /* dòng thời gian */
        const t = new Date(created)
        ins('order_events', { id: eventId++, order_id: orderId, status: 'pending', note: 'Tạo đơn tại POS', user_id: cashierId, created_at: vnString(t) })
        if (status !== 'cancelled' && status !== 'pending') {
          t.setUTCMinutes(t.getUTCMinutes() + 1)
          ins('order_events', { id: eventId++, order_id: orderId, status: 'preparing', note: 'Chuyển sang pha chế', user_id: cashierId, created_at: vnString(t) })
          db.run(`UPDATE orders SET preparing_at='${vnString(t)}' WHERE id=${orderId}`)
        }
        if (status === 'ready' || status === 'completed') {
          t.setUTCMinutes(t.getUTCMinutes() + ri(3, 7))
          ins('order_events', { id: eventId++, order_id: orderId, status: 'ready', note: 'Pha chế xong', user_id: cashierId, created_at: vnString(t) })
          db.run(`UPDATE orders SET ready_at='${vnString(t)}' WHERE id=${orderId}`)
        }
        if (status === 'completed') {
          t.setUTCMinutes(t.getUTCMinutes() + ri(1, 4))
          ins('order_events', { id: eventId++, order_id: orderId, status: 'completed', note: channel === 'delivery' ? 'Đã giao cho đối tác' : 'Đã giao khách', user_id: cashierId, created_at: vnString(t) })
          db.run(`UPDATE orders SET completed_at='${vnString(t)}' WHERE id=${orderId}`)
        }
        if (status === 'cancelled') {
          t.setUTCMinutes(t.getUTCMinutes() + 2)
          ins('order_events', { id: eventId++, order_id: orderId, status: 'cancelled', note: 'Huỷ đơn', user_id: 2, created_at: vnString(t) })
        }

        cogsTotal += status === 'cancelled' ? 0 : cogs
        ordersByDay.push({ branchId: bi + 1, hour, date: dateOnly(created) })
        orderId++
      }
    })
  }

  /* ---- chốt ca: tính tiền mặt lý thuyết từ payments ---- */
  db.run(`
    UPDATE shifts SET expected_cash = opening_cash + cash_in - cash_out + COALESCE((
      SELECT SUM(p.amount) FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE o.shift_id = shifts.id AND p.method = 'cash' AND o.status != 'cancelled'
    ), 0)
  `)
  db.run(`UPDATE shifts SET counted_cash = expected_cash + CASE WHEN id % 7 = 0 THEN -20000 WHEN id % 11 = 0 THEN 50000 ELSE 0 END
          WHERE status = 'closed'`)
  db.run(`UPDATE shifts SET variance = counted_cash - expected_cash WHERE status = 'closed'`)
  // thu/chi tiền mặt trong ca (vài ca)
  {
    let id = 1
    for (let s = 1; s < shiftId; s += 5) {
      ins('shift_cash_txns', { id: id++, shift_id: s, type: 'in', amount: 500000, reason: 'Nộp quỹ đầu giờ chiều', user_id: 2, created_at: '2026-10-20 14:00:00' })
      ins('shift_cash_txns', { id: id++, shift_id: s, type: 'out', amount: 200000, reason: 'Mua đá viên bổ sung', user_id: 2, created_at: '2026-10-20 16:30:00' })
    }
  }

  /* ---- cập nhật khách hàng theo đơn ---- */
  tierStats.forEach((st, cid) => {
    const tier = st.spent >= 2200000 ? 'diamond' : st.spent >= 1200000 ? 'gold' : st.spent >= 450000 ? 'silver' : 'bronze'
    const points = Math.floor(st.spent / 10000) * 1
    db.run(`UPDATE customers SET total_spent=${st.spent}, order_count=${st.count}, tier='${tier}', points=${points} WHERE id=${cid}`)
  })
  // vài khách chưa từng mua vẫn có hồ sơ (đăng ký mới)
  db.run(`UPDATE customers SET tier='bronze', points=0 WHERE total_spent = 0`)

  /* ---- thẻ kho: chi tiết 30 ngày gần nhất + gộp theo ngày cho phần cũ hơn ---- */
  const cutoff = new Date(NOW)
  cutoff.setUTCDate(cutoff.getUTCDate() - 30)
  const cutoffDate = dateOnly(cutoff)
  const dailyAgg = new Map<string, { branchId: number; ingId: number; qty: number; date: string }>()
  const invTxnRows: any[] = []

  consumptionEntries.forEach((e) => {
    if (e.date >= cutoffDate) {
      invTxnRows.push({
        branch_id: e.branchId, ingredient_id: e.ingId, txn_type: 'sale', qty: -Math.round(e.qty),
        unit_cost: INGREDIENTS[e.ingId - 1][3], ref_type: 'orders', ref_id: e.orderId,
        note: 'Xuất kho theo công thức khi bán', user_id: 4, created_at: e.at,
      })
    } else {
      const k = `${e.branchId}|${e.date}|${e.ingId}`
      const cur = dailyAgg.get(k)
      if (cur) cur.qty += e.qty
      else dailyAgg.set(k, { branchId: e.branchId, ingId: e.ingId, qty: e.qty, date: e.date })
    }
  })
  dailyAgg.forEach((v) => {
    invTxnRows.push({
      branch_id: v.branchId, ingredient_id: v.ingId, txn_type: 'sale', qty: -Math.round(v.qty),
      unit_cost: INGREDIENTS[v.ingId - 1][3], ref_type: 'orders_daily', ref_id: null,
      note: `Xuất kho bán hàng ngày ${v.date} (gộp)`, user_id: 4, created_at: `${v.date} 22:30:00`,
    })
  })

  /* ---- hao hụt, kiểm kê, chuyển kho ---- */
  const adjustments = new Map<string, number>() // `${branch}|${ing}` → tổng điều chỉnh âm/dương ngoài bán hàng
  const addAdj = (branchId: number, ingId: number, qty: number) => {
    const k = `${branchId}|${ingId}`
    adjustments.set(k, (adjustments.get(k) ?? 0) + qty)
  }

  BRANCHES.forEach((_, bi) => {
    const branchId = bi + 1
    for (let w = 0; w < 10; w++) {
      const ing = ri(1, INGREDIENTS.length)
      const at = new Date(NOW)
      at.setUTCDate(at.getUTCDate() - ri(1, 60))
      const qty = -Math.round(ri(20, 260) * (1 + (ing % 5)) / 3)
      invTxnRows.push({
        branch_id: branchId, ingredient_id: ing, txn_type: 'waste', qty,
        unit_cost: INGREDIENTS[ing - 1][3], ref_type: 'waste_note', ref_id: 1000 + w,
        note: pick(['Hết hạn sử dụng', 'Rơi vỡ', 'Pha lỗi', 'Hàng hỏng do bảo quản', 'Kiểm kê thiếu']),
        user_id: 7, created_at: vnString(at),
      })
      addAdj(branchId, ing, qty)
    }
    for (let a = 0; a < 5; a++) {
      const ing = ri(1, INGREDIENTS.length)
      const at = new Date(NOW)
      at.setDate(at.getDate() - ri(1, 30))
      const qty = chance(0.5) ? ri(10, 120) : -ri(5, 90)
      invTxnRows.push({
        branch_id: branchId, ingredient_id: ing, txn_type: 'adjust', qty,
        unit_cost: INGREDIENTS[ing - 1][3], ref_type: 'stock_check', ref_id: 2000 + a, note: 'Điều chỉnh sau kiểm kê',
        user_id: 10, created_at: vnString(at),
      })
      addAdj(branchId, ing, qty)
    }
  })
  for (let t = 0; t < 4; t++) {
    const ing = ri(1, INGREDIENTS.length)
    const qty = ri(100, 600)
    const from = (t % 2) + 1
    const to = from === 1 ? 2 : 1
    const at = new Date(NOW)
    at.setUTCDate(at.getUTCDate() - ri(5, 40))
    invTxnRows.push({ branch_id: from, ingredient_id: ing, txn_type: 'transfer_out', qty: -qty, unit_cost: INGREDIENTS[ing - 1][3], ref_type: 'transfers', ref_id: 500 + t, note: `Chuyển ${qty}${INGREDIENTS[ing - 1][2]} sang chi nhánh ${to}`, user_id: 10, created_at: vnString(at) })
    invTxnRows.push({ branch_id: to, ingredient_id: ing, txn_type: 'transfer_in', qty, unit_cost: INGREDIENTS[ing - 1][3], ref_type: 'transfers', ref_id: 500 + t, note: `Nhận từ chi nhánh ${from}`, user_id: 10, created_at: vnString(at) })
    addAdj(from, ing, -qty)
    addAdj(to, ing, qty)
  }

  /* ---- PO + nhập kho: tính để tồn cuối luôn dương và có cảnh báo tồn thấp ---- */
  let poId = 1
  let poiId = 1
  const receiptDays = [84, 63, 42, 21, 6]
  BRANCHES.forEach((_, bi) => {
    const branchId = bi + 1
    const allIng = INGREDIENTS.map((_, ii) => ii + 1)
    const needQty = new Map<number, number>()
    allIng.forEach((ing) => {
      const demand = consumption.get(`${branchId}-${ing}`) ?? 0
      const adj = adjustments.get(`${branchId}-${ing}`) ?? 0
      const minStock = INGREDIENTS[ing - 1][4]
      // mục tiêu tồn cuối: 0.35–1.5 lần định mức (một số nguyên liệu sẽ rơi vào cảnh báo tồn thấp)
      const factor = 0.9 + ((ing * 37 + bi * 13) % 110) / 100
      const target = Math.max(1, Math.round(minStock * factor))
      const totalIn = Math.round((demand + adj + target) * 1.03)
      needQty.set(ing, Math.max(0, totalIn))
    })

    receiptDays.forEach((dayBack, idx) => {
      const receiveAt = new Date(NOW)
      receiveAt.setUTCDate(receiveAt.getUTCDate() - dayBack)
      receiveAt.setUTCHours(7, 15, 0, 0)
      const items: { ingId: number; qty: number; cost: number; amount: number }[] = []
      allIng.forEach((ing) => {
        const total = needQty.get(ing) ?? 0
        // chia không đều giữa các lần nhập
        const share = [0.26, 0.22, 0.2, 0.18, 0.14][idx]
        const qty = Math.round(total * share)
        if (qty <= 0) return
        const baseCost = INGREDIENTS[ing - 1][3]
        const cost = Math.max(1, Math.round(baseCost * (0.94 + ((ing + idx) % 9) / 100)))
        items.push({ ingId: ing, qty, cost, amount: qty * cost })
      })
      if (!items.length) return
      const subtotalPO = items.reduce((s, it) => s + it.amount, 0)
      const vatPO = Math.round(subtotalPO * 0.08)
      const code = `PO${String(poId).padStart(4, '0')}`
      ins('purchase_orders', {
        id: poId, code, supplier_id: ((idx * 3 + bi) % 15) + 1, branch_id: branchId, status: 'received',
        subtotal: subtotalPO, vat: vatPO, total: subtotalPO + vatPO, note: `Nhập hàng định kỳ đợt ${idx + 1}`,
        created_by: 1, created_at: vnString(receiveAt), received_at: vnString(receiveAt),
      })
      items.forEach((it) => {
        ins('purchase_order_items', { id: poiId++, po_id: poId, ingredient_id: it.ingId, qty: it.qty, unit_cost: it.cost, amount: it.amount })
        invTxnRows.push({
          branch_id: branchId, ingredient_id: it.ingId, txn_type: 'in', qty: it.qty, unit_cost: it.cost,
          ref_type: 'purchase_orders', ref_id: poId, note: `Nhập kho theo ${code}`, user_id: 10, created_at: vnString(receiveAt),
        })
      })
      poId++
    })

    // đơn đang đặt / nháp cho trang Mua hàng
    const pending: [string, number][] = [['ordered', 2], ['draft', 1], ['ordered', 4]]
    pending.forEach(([st, dayBack], idx2) => {
      const at = new Date(NOW)
      at.setUTCDate(at.getUTCDate() - dayBack)
      const items = INGREDIENTS.slice(idx2 * 6, idx2 * 6 + 6).map((ing, k) => {
        const qty = Math.max(50, Math.round((consumption.get(`${branchId}-${idx2 * 6 + k + 1}`) ?? 500) / 12))
        return { ingId: idx2 * 6 + k + 1, qty, cost: ing[3], amount: qty * ing[3] }
      })
      const sub = items.reduce((s2, it) => s2 + it.amount, 0)
      const code = `PO${String(poId).padStart(4, '0')}`
      ins('purchase_orders', {
        id: poId, code, supplier_id: ((idx2 * 4 + bi * 2) % 15) + 1, branch_id: branchId, status: st,
        subtotal: sub, vat: Math.round(sub * 0.08), total: sub + Math.round(sub * 0.08),
        note: st === 'draft' ? 'Đề xuất từ cảnh báo tồn kho thấp' : 'Chờ nhà cung cấp giao hàng', created_by: 2,
        created_at: vnString(at), received_at: null,
      })
      items.forEach((it) => {
        ins('purchase_order_items', { id: poiId++, po_id: poId, ingredient_id: it.ingId, qty: it.qty, unit_cost: it.cost, amount: it.amount })
      })
      poId++
    })
  })

  invTxnRows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  invTxnRows.forEach((r) => ins('inventory_txns', { id: invTxnId++, ...r }))

  // Bù các nguyên liệu bị âm (do mô phỏng bán > nhập trong kỳ) bằng một phiếu nhập đầu kỳ,
  // để tồn kho luôn dương và vẫn khớp tuyệt đối với tổng thẻ kho.
  const negatives = db.exec(`
    SELECT t.branch_id, t.ingredient_id, ROUND(SUM(t.qty), 2) AS qty, MAX(i.min_stock) AS min_stock, MAX(i.unit_cost) AS unit_cost
    FROM inventory_txns t JOIN ingredients i ON i.id = t.ingredient_id
    GROUP BY t.branch_id, t.ingredient_id HAVING SUM(t.qty) < 1
  `)
  if (negatives.length) {
    const startAt = new Date(NOW)
    startAt.setUTCDate(startAt.getUTCDate() - DAYS - 10)
    negatives[0].values.forEach((row) => {
      const [branchId, ingredientId, qty, minStock, unitCost] = row as number[]
      const target = Math.round(Math.max(Number(minStock) * 1.8, 50))
      const add = Math.round(target - Number(qty))
      if (add <= 0) return
      ins('inventory_txns', {
        id: invTxnId++, branch_id: branchId, ingredient_id: ingredientId, txn_type: 'in',
        qty: add, unit_cost: unitCost, ref_type: 'opening_stock', ref_id: null,
        note: 'Nhập bù tồn đầu kỳ (mô phỏng)', user_id: 2, created_at: vnString(startAt),
      })
    })
  }

  // tồn kho cuối = tổng thẻ kho (nguồn sự thật duy nhất)
  db.run(`
    INSERT INTO inventory_stock (branch_id, ingredient_id, qty, avg_cost, updated_at)
    SELECT branch_id, ingredient_id, ROUND(SUM(qty), 2), MAX(unit_cost), '${vnString(NOW)}'
    FROM inventory_txns GROUP BY branch_id, ingredient_id
  `)

  /* ---- sổ thu chi ---- */
  let finId = 1
  const fixedCosts: [string, number][] = [['rent', 55000000], ['salary', 0], ['utilities', 8500000], ['marketing', 6000000], ['other', 3200000]]
  for (let m = 2; m >= 0; m--) {
    const d = new Date(NOW)
    d.setUTCMonth(d.getUTCMonth() - m, 1)
    const monthLabel = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    BRANCHES.forEach((_, bi) => {
      const scale = [1, 0.82, 0.92][bi]
      fixedCosts.forEach(([cat, base]) => {
        if (cat === 'salary') return
        ins('finance_entries', {
          id: finId++, branch_id: bi + 1, entry_date: `${monthLabel}-05`, type: 'expense', category: cat,
          amount: Math.round(base * scale), ref_type: null, ref_id: null,
          note: cat === 'rent' ? 'Tiền thuê mặt bằng' : cat === 'utilities' ? 'Điện, nước, internet' : cat === 'marketing' ? 'Quảng cáo & POS' : 'Chi phí khác',
          created_by: 10, created_at: `${monthLabel}-05 09:00:00`,
        })
      })
      // lương nhân viên chi nhánh
      const branchSalary = USERS.filter((u) => u.branch === bi + 1).reduce((s, u) => s + u.salary, 0)
      ins('finance_entries', {
        id: finId++, branch_id: bi + 1, entry_date: `${monthLabel}-28`, type: 'expense', category: 'salary',
        amount: branchSalary, note: 'Chi lương nhân sự tháng', created_by: 10, created_at: `${monthLabel}-28 17:00:00`,
      })
    })
  }
  // chi nhập hàng theo PO (ghi nhận vào sổ thu chi)
  const poRows = db.exec(`SELECT id, branch_id, total, received_at FROM purchase_orders WHERE status='received' ORDER BY id`)
  if (poRows[0]) {
    poRows[0].values.forEach(([id, branchId, total, receivedAt]) => {
      ins('finance_entries', {
        id: finId++, branch_id: branchId as number, entry_date: String(receivedAt).slice(0, 10), type: 'expense',
        category: 'purchase', amount: total as number, ref_type: 'purchase_orders', ref_id: id as number,
        note: `Thanh toán nhập hàng PO${String(id).padStart(4, '0')}`, created_by: 10, created_at: String(receivedAt),
      })
    })
  }

  /* ---- audit log mẫu ---- */
  const audits: [string, string, string, string][] = [
    ['update_price', 'products', '1', 'Đổi giá Trà sữa trân châu: 42.000 → 45.000'],
    ['cancel_order', 'orders', '2', 'Huỷ đơn HD20261028-0012, lý do: khách đổi ý'],
    ['stock_adjust', 'inventory_stock', '12', 'Điều chỉnh tồn trân châu đen +120g'],
    ['apply_voucher', 'vouchers', '1', 'Áp voucher MATCHA20 cho đơn 200k'],
    ['create_po', 'purchase_orders', '3', 'Tạo PO từ đề xuất tồn kho thấp'],
  ]
  audits.forEach(([action, entity, entityId, note], i) =>
    ins('audit_logs', {
      id: i + 1, user_id: [2, 2, 10, 4, 1][i], action, entity, entity_id: entityId,
      before_value: null, after_value: JSON.stringify({ note }), created_at: `2026-10-${20 + i} 10:${10 + i * 5}:00`,
    }),
  )

  ins('app_meta', { key: 'schema_version', value: String(3) })
  ins('app_meta', { key: 'seeded_at', value: vnString(NOW) })
  ins('app_meta', { key: 'currency', value: 'VND' })
  ins('app_meta', { key: 'timezone', value: 'Asia/Ho_Chi_Minh' })

  db.run('COMMIT')

  /* ---- thống kê ---- */
  const tableList = ['branches', 'users', 'categories', 'products', 'product_sizes', 'toppings', 'product_toppings', 'orders', 'order_items', 'order_item_toppings', 'payments', 'order_events', 'dining_tables', 'shifts', 'shift_cash_txns', 'ingredients', 'recipes', 'inventory_stock', 'inventory_txns', 'suppliers', 'purchase_orders', 'purchase_order_items', 'customers', 'vouchers', 'promotions', 'finance_entries', 'audit_logs', 'app_meta']
  tableList.forEach((t) => {
    const r = db.exec(`SELECT COUNT(*) FROM ${t}`)
    counts[t] = r[0]?.values[0][0] as number
  })
  return { counts, seededAt: vnString(NOW) }
}

/** Bảng tra công thức [ingredientId, qty] theo `${productId}-${size}` — dựng 1 lần. */
const RECIPE_LOOKUP = new Map<string, [number, number][]>()
PRODUCTS.forEach((p, i) => {
  const lines = RECIPES[p.name] ?? []
  const sizes: [string, number][] = p.noSize ? [['M', 1]] : [['S', 0.85], ['M', 1], ['L', 1.2]]
  sizes.forEach(([code, factor]) => {
    RECIPE_LOOKUP.set(
      `${i + 1}-${code}`,
      lines.map(([ingName, qty]) => [ingIdx.get(ingName)! + 1, Math.max(1, Math.round(qty * factor))] as [number, number]),
    )
  })
})

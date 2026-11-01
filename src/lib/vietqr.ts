/**
 * VietQR theo chuẩn EMVCo / NAPAS 247 — sinh payload THẬT:
 * app ngân hàng Việt Nam đọc được mã (đúng TLV + CRC16-CCITT, MCC 5300, BIN ngân hàng).
 * Không gọi cổng thanh toán: việc xác nhận tiền về nằm ở màn hình "Đối soát chuyển khoản"
 * (nhập mã giao dịch ngân hàng hoặc dùng webhook mô phỏng).
 */

export interface Bank { bin: string; name: string; short: string }

export const BANKS: Bank[] = [
  { bin: '970436', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', short: 'Vietcombank' },
  { bin: '970415', name: 'Ngân hàng TMCP Công thương Việt Nam', short: 'VietinBank' },
  { bin: '970418', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', short: 'BIDV' },
  { bin: '970405', name: 'Ngân hàng Nông nghiệp và PTNT Việt Nam', short: 'Agribank' },
  { bin: '970407', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', short: 'Techcombank' },
  { bin: '970422', name: 'Ngân hàng TMCP Quân đội', short: 'MB Bank' },
  { bin: '970416', name: 'Ngân hàng TMCP Á Châu', short: 'ACB' },
  { bin: '970432', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', short: 'VPBank' },
  { bin: '970423', name: 'Ngân hàng TMCP Tiên Phong', short: 'TPBank' },
  { bin: '970441', name: 'Ngân hàng TMCP Quốc tế Việt Nam', short: 'VIB' },
  { bin: '970403', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', short: 'Sacombank' },
  { bin: '970443', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', short: 'SHB' },
  { bin: '970437', name: 'Ngân hàng TMCP Phát triển TP.HCM', short: 'HDBank' },
  { bin: '970448', name: 'Ngân hàng TMCP Phương Đông', short: 'OCB' },
  { bin: '970454', name: 'Ngân hàng TMCP Bản Việt', short: 'BVBank' },
  { bin: '970452', name: 'Ngân hàng TMCP Kiên Long', short: 'KienLongBank' },
]

export const bankByBin = (bin: string) => BANKS.find((b) => b.bin === bin)

/** CRC16-CCITT (0xFFFF, poly 0x1021) — chuẩn dùng trong EMVCo QR. */
export function crc16ccitt(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** Bỏ dấu tiếng Việt + chỉ giữ A-Z0-9 cho nội dung chuyển khoản (một số bank yêu cầu). */
export function asciiMemo(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (m) => (m === 'đ' ? 'd' : 'D'))
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .toUpperCase()
}

export interface VietQRInput {
  bankBin: string
  accountNo: string
  amount?: number
  memo?: string
  merchantName?: string
  merchantCity?: string
}

/** Sinh chuỗi VietQR (EMVCo Merchant Presented Mode). */
export function buildVietQR({ bankBin, accountNo, amount, memo = '', merchantName = 'MATCHA HOUSE', merchantCity = 'HO CHI MINH' }: VietQRInput) {
  const guid = tlv('00', bankBin)
  const acc = tlv('01', accountNo)
  let consumer = tlv('00', guid) + tlv('01', acc)
  // service code 02 = chuyển khoản nhanh (một số ngân hàng dùng)
  consumer += tlv('02', 'QRIBFTTA')
  let payload =
    tlv('00', '01') +
    tlv('01', '12') + // 12 = QR chuyển khoản (dynamic nếu có amount)
    tlv('38', consumer) +
    tlv('53', '704') + // VND
    (amount && amount > 0 ? tlv('54', String(Math.round(amount))) : '') +
    tlv('58', 'VN') +
    tlv('59', merchantName.slice(0, 25).toUpperCase()) +
    tlv('60', merchantCity.slice(0, 15).toUpperCase())
  if (memo) payload += tlv('62', tlv('08', asciiMemo(memo)))
  payload += '6304'
  return payload + crc16ccitt(payload)
}

/** Đọc lại payload (dùng cho màn hình đối soát / kiểm thử). */
export function parseVietQR(qr: string) {
  const out: Record<string, string> = {}
  let i = 0
  while (i + 4 <= qr.length) {
    const id = qr.slice(i, i + 2)
    const len = Number(qr.slice(i + 2, i + 4))
    if (Number.isNaN(len)) break
    out[id] = qr.slice(i + 4, i + 4 + len)
    i += 4 + len
  }
  const consumer = out['38'] ?? ''
  let bankBin = ''
  let accountNo = ''
  let j = 0
  while (j + 4 <= consumer.length) {
    const id = consumer.slice(j, j + 2)
    const len = Number(consumer.slice(j + 2, j + 4))
    const val = consumer.slice(j + 4, j + 4 + len)
    if (id === '00') {
      let k = 0
      while (k + 4 <= val.length) {
        const cid = val.slice(k, k + 2)
        const clen = Number(val.slice(k + 2, k + 4))
        if (cid === '00') bankBin = val.slice(k + 4, k + 4 + clen)
        k += 4 + clen
      }
    }
    if (id === '01') accountNo = val
    j += 4 + len
  }
  const crcGiven = qr.slice(-4)
  const crcCalc = crc16ccitt(qr.slice(0, -4))
  return {
    bankBin, accountNo,
    amount: out['54'] ? Number(out['54']) : 0,
    memo: out['62'] ? out['62'].slice(4) : '',
    merchant: out['59'] ?? '',
    crcValid: crcGiven === crcCalc,
  }
}

/** Mã tham chiếu giao dịch ngân hàng (mô phỏng đúng format thực tế: FT + 12 ký tự). */
export function makeBankRef(prefix = 'FT') {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return prefix + s
}

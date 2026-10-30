import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportConf, importConf, parseConf } from '../src/core/conf'
import { defaultSettings, newFreeLine, normalizeSettings } from '../src/core/settings'
import { readSettingsFile, writeSettingsFile } from '../src/core/settings-file'

/** File cấu hình mẫu của bản bash cũ (đã bỏ): app vẫn phải nhập được file .conf kiểu này. */
const CONF_EXAMPLE = readFileSync(join(__dirname, 'fixtures/xsmn.conf.example'), 'utf8')

describe('defaultSettings', () => {
  it('đúng mặc định của SPEC', () => {
    const s = defaultSettings()
    expect(s.print).toMatchObject({
      paper: 'A4', format: 'pdf', cardWidthCm: 8, cardGapXCm: 0.6, cardGapYCm: 0.6, cardAlign: 'left',
      numberFontPt: null, font: 'Times New Roman'
    })
    expect(s.print).toMatchObject({
      borderColor: '000000',
      headRow: { labelSize: 12, color: '000000', bold: true },
      prizeLabels: { size: 12, dbSize: 14, color: '000000', bold: true },
      numbers: { color: '000000', bold: true, italic: false, underline: false }
    })
    // ĐB to hơn cỡ số chung 1 pt, các hàng khác theo mức chung
    expect(s.print.rows.db).toEqual({ sizeDeltaPt: 1, numberColor: null, labelColor: null, bold: null, italic: null, underline: null, fill: null })
    expect(s.print.rows['4'].sizeDeltaPt).toBe(0)
    expect(s.header.name).toMatchObject({ color: '000000', bold: true, italic: false })
    expect(s.print.textCell).toEqual({ padXCm: 0.05, padYCm: 0.05, alignX: 'center', alignY: 'top' })
    expect(s.print.numberCell).toEqual({ padXCm: 0.3, padYCm: 0.05, alignX: 'right', alignY: 'center' })
    // Thông tin để trống, đại lý tự nhập; căn giữa, khoảng cách như phiếu bản bash
    expect(Object.keys(s.header)).toEqual(['label', 'name', 'addr', 'contact', 'date', 'addrLabel', 'contactLabel', 'order', 'extra', 'footer'])
    expect(s.header).toMatchObject({ order: ['name', 'addr', 'contact'], extra: [], footer: [], addrLabel: { value: '' }, contactLabel: { value: '' } })
    expect([s.header.label, s.header.name, s.header.addr, s.header.contact].map((h) => h.value)).toEqual(['', '', '', ''])
    expect([s.header.name, s.header.addr, s.header.contact, s.header.date].map((h) => [h.align, h.afterPt])).toEqual([
      ['center', 3], ['center', 0], ['center', 0], ['center', 3]
    ])
    expect(s.version).toBe(4)
    expect(s.stations.mode).toBe('all')
    expect(s.stations.byWeekday[6].map((p) => p.slug)).toEqual(['tp-hcm', 'long-an', 'binh-phuoc', 'hau-giang'])
    expect(Object.keys(s.stations.byWeekday)).toHaveLength(7)
    expect(s.autoRefresh).toBe(true)
  })
})

describe('normalizeSettings', () => {
  it('rác → mặc định', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings())
    expect(normalizeSettings({ print: 'x', header: [] })).toEqual(defaultSettings())
  })

  it('kẹp giá trị, làm tròn cỡ chữ theo bước 0,5, chuẩn hoá màu', () => {
    const s = normalizeSettings({
      version: 2,
      header: { name: { size: 99, value: 'A', align: 'giữa', afterPt: 99 }, addr: { size: 7.3, afterPt: '1,3' }, date: { align: 'right' } },
      print: { paper: 'B5', cardGapXCm: -1, numberFontPt: '13,5', colors: { text: '#ff0000', border: 'xanh' } }
    })
    expect(s.header.name).toEqual({ show: true, size: 30, value: 'A', align: 'center', afterPt: 20, color: 'FF0000', bold: true, italic: false })
    expect(s.header.addr).toMatchObject({ size: 7.5, afterPt: 1.5 })
    expect(s.header.date).toEqual({ size: 13, align: 'right', afterPt: 3, color: 'FF0000', bold: true, italic: false })
    expect(s.print.paper).toBe('A4')
    expect(s.print.cardGapXCm).toBe(0)
    expect(s.print.numberFontPt).toBe(13.5)
    expect(s.print.cardHeightCm).toBeNull()
    // bản cũ: alignText / alignNumber / numberPadRightCm riêng lẻ → chuyển sang textCell / numberCell
    const legacy = normalizeSettings({ print: { alignText: 'left', alignNumber: 'center', numberPadRightCm: 0.5 } }).print
    expect(legacy.textCell).toMatchObject({ alignX: 'left', alignY: 'top' })
    expect(legacy.numberCell).toMatchObject({ alignX: 'center', alignY: 'center', padXCm: 0.5 })
    // bề rộng: null = Auto; thiếu khoá (cài đặt cũ) = 8 cm
    expect(normalizeSettings({ print: { cardWidthCm: null } }).print.cardWidthCm).toBeNull()
    expect(normalizeSettings({ print: {} }).print.cardWidthCm).toBe(8)
    // bản cũ chỉ có một khoảng cách chung → dùng cho cả ngang lẫn dọc
    expect(normalizeSettings({ print: { cardGapCm: 0.4 } }).print).toMatchObject({ cardGapXCm: 0.4, cardGapYCm: 0.4 })
    expect(normalizeSettings({ print: { cardGapCm: 0.4, cardGapYCm: 1 } }).print).toMatchObject({ cardGapXCm: 0.4, cardGapYCm: 1 })
    expect(importConf('CARD_GAP_CM=0,3').settings.print).toMatchObject({ cardGapXCm: 0.3, cardGapYCm: 0.3 })
    expect(normalizeSettings({ print: { cardHeightCm: '12,5' } }).print.cardHeightCm).toBe(12.5)
    expect(normalizeSettings({ print: { cardHeightCm: 1 } }).print.cardHeightCm).toBe(4)
    // màu chung của bản 2: chữ đầu phiếu đỏ, viền sai mã thì về đen
    expect(s.header.label.color).toBe('FF0000')
    expect(s.print.borderColor).toBe('000000')
  })

  it('cài đặt bản 1: thêm "ĐC: " vào địa chỉ, ghép các số thành một dòng, bỏ ẩn dòng thứ ngày', () => {
    const old = {
      version: 1,
      header: {
        name: { show: true, size: 14, value: 'MINH' },
        addr: { show: true, size: 9, value: '  Chợ Lớn ' },
        phones: { show: false, size: 11, values: ['0909 000 111', ' ', '0283 333 444', 7] },
        date: { show: false, size: 12 }
      }
    }
    const s = normalizeSettings(old)
    const ink = { color: '000000', bold: true, italic: false }
    expect(s.version).toBe(4)
    expect(s.header.addr).toEqual({ show: true, size: 9, value: 'ĐC: Chợ Lớn', align: 'center', afterPt: 0, ...ink })
    expect(s.header.contact).toEqual({ show: false, size: 11, value: 'DĐ: 0909 000 111  DĐ: 0283 333 444', align: 'center', afterPt: 0, ...ink })
    expect(s.header.date).toEqual({ size: 12, align: 'center', afterPt: 3, ...ink })
    expect(s.header.name).toMatchObject({ value: 'MINH', align: 'center', afterPt: 3 })
    // địa chỉ rỗng giữ rỗng; chuẩn hoá lại lần nữa không thêm "ĐC: " lần hai
    expect(normalizeSettings({ header: { addr: { value: ' ' } } }).header.addr.value).toBe('')
    expect(normalizeSettings(s)).toEqual(s)
    // bản 2: chữ giữ nguyên văn
    expect(normalizeSettings({ version: 2, header: { addr: { value: 'Chợ Lớn' }, contact: { value: '0909' } } }).header)
      .toMatchObject({ addr: { value: 'Chợ Lớn' }, contact: { value: '0909' } })
  })

  it('bản 2: 4 màu chung đổ sang từng phần, số ĐB lấy màu nhấn; chuẩn hoá lại giữ nguyên', () => {
    const s = normalizeSettings({
      version: 2,
      print: { colors: { text: '1F2A6B', accent: 'E00000', border: '7F8FB5', number: '000000' } }
    })
    expect([s.header.label, s.header.name, s.header.addr, s.header.contact, s.header.date].map((h) => h.color))
      .toEqual(Array(5).fill('1F2A6B'))
    expect(s.print).toMatchObject({
      borderColor: '7F8FB5', headRow: { color: 'E00000' }, prizeLabels: { color: 'E00000' }, numbers: { color: '000000' }
    })
    expect(s.print.rows.db.numberColor).toBe('E00000')
    expect(s.print.rows['1'].numberColor).toBeNull()
    expect(normalizeSettings(s)).toEqual(s)
    // màu nhấn trùng màu số: ĐB theo màu số chung
    expect(normalizeSettings({ version: 2, print: { colors: { accent: '123456', number: '123456' } } }).print.rows.db.numberColor).toBeNull()
  })

  it('hàng giải: kẹp cỡ cộng thêm, màu / kiểu chữ trống là theo mức chung', () => {
    const s = normalizeSettings({
      print: { rows: { db: { sizeDeltaPt: 9, numberColor: '#c00000', fill: 'xám', bold: false }, 4: { sizeDeltaPt: '-1,5', labelColor: '' } } }
    })
    expect(s.print.rows.db).toEqual({ sizeDeltaPt: 6, numberColor: 'C00000', labelColor: null, bold: false, italic: null, underline: null, fill: null })
    expect(s.print.rows['4']).toMatchObject({ sizeDeltaPt: -1.5, labelColor: null })
    expect(normalizeSettings(s)).toEqual(s)
  })

  it('font: nhận mọi tên font máy, bỏ ký tự phá CSS/HTML, rỗng thì về mặc định', () => {
    const font = (v: unknown) => normalizeSettings({ print: { font: v } }).print.font
    expect(font('Segoe UI')).toBe('Segoe UI')
    expect(font('  Tahoma   Bold ')).toBe('Tahoma Bold')
    expect(font('A</style><b>{x};"\\')).toBe('A/stylebx')
    expect(font('')).toBe('Times New Roman')
    expect(font(42)).toBe('Times New Roman')
  })

  it('danh sách đài theo thứ: bỏ trùng và đài không quay, thêm đài thiếu vào cuối', () => {
    const s = normalizeSettings({
      stations: {
        mode: 'pick',
        byWeekday: { 1: [{ slug: 'ca-mau', on: false }, { slug: 'ben-tre', on: true }, { slug: 'ca-mau', on: true }] }
      }
    })
    expect(s.stations.byWeekday[1]).toEqual([
      { slug: 'ca-mau', on: false },
      { slug: 'tp-hcm', on: true },
      { slug: 'dong-thap', on: true }
    ])
  })

  it('tên viết tắt chỉ giữ khi khác mặc định', () => {
    const s = normalizeSettings({ stations: { shortNames: { 'tp-hcm': 'TP.HCM', 'ca-mau': ' Cà Mau ', 'x': '' } } })
    expect(s.stations.shortNames).toEqual({ 'ca-mau': 'Cà Mau' })
  })
})

describe('settings file', () => {
  it('ghi rồi đọc lại; file hỏng → mặc định và giữ bản .bak', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xsmn-set-'))
    try {
      const file = join(dir, 'sub', 'settings.json')
      expect(await readSettingsFile(file)).toEqual(defaultSettings())
      const s = defaultSettings()
      s.header.name.value = 'MINH'
      await writeSettingsFile(file, s)
      expect((await readSettingsFile(file)).header.name.value).toBe('MINH')
      await writeFile(file, '{ hỏng')
      expect(await readSettingsFile(file)).toEqual(defaultSettings())
      expect(await readFile(`${file}.bak`, 'utf8')).toBe('{ hỏng')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('parseConf', () => {
  it('bỏ chú thích, bỏ ngoặc, cắt chú thích cuối dòng khi không có ngoặc', () => {
    const m = parseConf('# x\nA="1 # 2"\r\nB = 3 # chú thích\n; y\nC\nD=\'q\'\n')
    expect([...m]).toEqual([['A', '1 # 2'], ['B', '3'], ['D', 'q']])
  })
})

describe('importConf', () => {
  it('nhập file mẫu của bản bash', () => {
    const { settings: s, imported, ignored } = importConf(CONF_EXAMPLE)
    // app đã bỏ dòng Fax: khoá AGENT_FAX báo bỏ qua
    expect(ignored).toEqual(['AGENT_FAX'])
    expect(imported).toBe(12)
    expect(s.header.label.value).toBe('Đại lý vé số:')
    expect(s.header.name.value).toBe('ĐỨC QUYẾT')
    // file kiểu cũ: phiếu tự thêm "ĐC: " / "DĐ: " → chuyển sang chữ in nguyên văn
    expect(s.header.addr.value).toBe('ĐC: Chợ Tapao - Đ.Kho - T.Linh – B.Thuận')
    expect(s.header.contact.value).toBe('DĐ: 01212 019 343  DĐ: 0983 019 343')
    expect(s.stations.mode).toBe('all')
    expect(s.print).toMatchObject({ paper: 'A4', format: 'pdf', cardWidthCm: 8 })
    expect(s.print.numberCell.padXCm).toBe(0.3)
    expect(s.print.textCell.alignX).toBe('center')
  })

  it('đài theo thứ, tên viết tắt, bố cục, màu; khoá lạ báo lại', () => {
    const conf = [
      'STATIONS="tp-hcm, dong-thap, ben-tre"',
      'STATIONS_T7="long-an hau-giang"',
      'NAME_ca-mau="Cà Mau"',
      'NAME_tp_hcm="HCM"',
      'NAME_dong-thap="Đ.Tháp"',
      'NOTE="Cần so lại"',
      'PAPER=a5-2',
      'OUTPUT_FORMAT=BOTH',
      'CARD_WIDTH_CM=8,5',
      'NUMBER_FONT_PT=13',
      'CARD_ALIGN=center',
      'ALIGN_NUMBER=giữa',
      'FONT="Arial"',
      'COLOR_ACCENT=E00000',
      'OUTPUT_DIR="~/Documents/xoso"',
      'SOFFICE=/usr/bin/soffice',
      'LA=1'
    ].join('\n')
    const { settings: s, imported, ignored } = importConf(conf)
    expect(ignored).toEqual(['NOTE', 'ALIGN_NUMBER', 'OUTPUT_DIR', 'SOFFICE', 'LA'])
    expect(imported).toBe(12)
    expect(s.stations.mode).toBe('pick')
    // Thứ Hai: theo STATIONS, giữ thứ tự web
    expect(s.stations.byWeekday[1]).toEqual([
      { slug: 'tp-hcm', on: true }, { slug: 'dong-thap', on: true }, { slug: 'ca-mau', on: false }
    ])
    // Thứ Bảy: STATIONS_T7 ưu tiên
    expect(s.stations.byWeekday[6].filter((p) => p.on).map((p) => p.slug)).toEqual(['long-an', 'hau-giang'])
    // Chủ Nhật: STATIONS không có đài nào quay → tắt hết (khi in sẽ in đủ)
    expect(s.stations.byWeekday[0].every((p) => !p.on)).toBe(true)
    expect(s.stations.shortNames).toEqual({ 'ca-mau': 'Cà Mau', 'tp-hcm': 'HCM' })
    expect(s.print).toMatchObject({
      paper: 'A5', format: 'both', cardWidthCm: 8.5, numberFontPt: 13, cardAlign: 'center', font: 'Arial'
    })
    // COLOR_ACCENT của bản 2: "Giải", tên đài, tên giải và số ĐB
    expect(s.print).toMatchObject({ headRow: { color: 'E00000' }, prizeLabels: { color: 'E00000' } })
    expect(s.print.rows.db.numberColor).toBe('E00000')
    expect(s.output.dir).toBe(defaultSettings().output.dir)
  })

  it('khoá không có trong file thì giữ giá trị hiện có; khoá chữ để rỗng thì xoá', () => {
    const base = defaultSettings()
    base.header.addr.value = '000'
    base.header.label.value = 'Đại lý:'
    base.print.paper = 'A6'
    const { settings } = importConf('AGENT_NAME=MINH\nAGENT_LABEL=', base)
    expect(settings.header.name.value).toBe('MINH')
    expect(settings.header.addr.value).toBe('000')
    expect(settings.header.label.value).toBe('')
    expect(settings.print.paper).toBe('A6')
  })

  it('dòng đầu phiếu: CONF_VERSION=2 giữ nguyên văn, AGENT_CONTACT thay AGENT_PHONES, căn lề và khoảng cách', () => {
    const v2 = importConf([
      'CONF_VERSION=2',
      'AGENT_ADDRESS="Số 5, Q.1"',
      'AGENT_PHONES="0909"',
      'AGENT_CONTACT="ĐT: 0283 333 444"',
      'AGENT_NAME_ALIGN=left',
      'AGENT_NAME_AFTER_PT=4,5',
      'AGENT_CONTACT_ALIGN=right',
      'AGENT_PHONES_SIZE=11',
      'DATE_LINE_SHOW=0',
      'DATE_LINE_ALIGN=right',
      'DATE_LINE_AFTER_PT=99',
      'AGENT_LABEL_ALIGN=left'
    ].join('\n'))
    expect(v2.settings.header.addr.value).toBe('Số 5, Q.1')
    expect(v2.settings.header.contact).toMatchObject({ value: 'ĐT: 0283 333 444', align: 'right', size: 11 })
    expect(v2.settings.header.name).toMatchObject({ align: 'left', afterPt: 4.5 })
    expect(v2.settings.header.date).toEqual({ size: 13, align: 'right', afterPt: 3, color: '000000', bold: true, italic: false })
    // nhãn theo dòng tên; khoảng cách quá lớn báo bỏ qua; DATE_LINE_SHOW (dòng luôn in) bỏ qua không báo
    expect(v2.ignored).toEqual(['DATE_LINE_AFTER_PT', 'AGENT_LABEL_ALIGN'])
    // file kiểu cũ: địa chỉ thêm "ĐC: ", rỗng thì giữ rỗng
    expect(importConf('AGENT_ADDRESS="Số 5"').settings.header.addr.value).toBe('ĐC: Số 5')
    expect(importConf('AGENT_ADDRESS=').settings.header.addr.value).toBe('')
  })

  it('FONT nhận tên font bất kỳ (font máy), để rỗng thì giữ font đang có', () => {
    expect(importConf('FONT="Segoe UI"').settings.print.font).toBe('Segoe UI')
    expect(importConf('FONT=Tahoma').settings.print.font).toBe('Tahoma')
    const base = defaultSettings()
    base.print.font = 'Georgia'
    expect(importConf('FONT=', base).settings.print.font).toBe('Georgia')
  })
})

describe('exportConf', () => {
  const meta = { appName: 'Xổ Số Đại Lý', version: '1.0.0', when: '29-10-2026 10:00' }

  function custom() {
    const s = defaultSettings()
    s.header.label.value = 'Đại lý vé số:'
    const ink = { color: '1F2A6B', bold: true, italic: false }
    s.header.label = { ...s.header.label, color: '7F1D1D', bold: false, italic: true }
    s.header.name = { show: true, size: 16, value: 'MINH "NGỌC" & CON # 2', align: 'left', afterPt: 4.5, ...ink }
    s.header.addr = { show: false, size: 9.5, value: 'ĐC: 12 Trần Hưng Đạo, Q.5', align: 'right', afterPt: 0, ...ink }
    s.header.contact = { show: true, size: 11, value: 'DĐ: 0909 000 111  DĐ: 0283 333 444', align: 'center', afterPt: 1, ...ink }
    s.header.date = { size: 12, align: 'right', afterPt: 6, ...ink, italic: true }
    s.stations.mode = 'pick'
    s.stations.byWeekday[1] = [{ slug: 'ca-mau', on: true }, { slug: 'tp-hcm', on: false }, { slug: 'dong-thap', on: true }]
    s.stations.byWeekday[6] = [{ slug: 'hau-giang', on: true }, { slug: 'tp-hcm', on: true }, { slug: 'long-an', on: false }, { slug: 'binh-phuoc', on: true }]
    s.stations.shortNames = { 'ca-mau': 'Cà Mau', 'tp-hcm': 'HCM' }
    s.print = {
      ...s.print,
      paper: 'A5', format: 'both', cardWidthCm: null, cardHeightCm: 11.5, cardGapXCm: 1, cardGapYCm: 0.2,
      cardAlign: 'even', cardAlignY: 'between', numberFontPt: 13.5, font: 'Arial',
      textCell: { padXCm: 0.15, padYCm: 0.1, alignX: 'left', alignY: 'center' },
      numberCell: { padXCm: 0.25, padYCm: 0.05, alignX: 'center', alignY: 'bottom' },
      borderColor: '7F8FB5',
      headRow: { labelSize: 11, color: 'E00000', bold: false },
      prizeLabels: { size: 11.5, dbSize: 15, color: 'E00000', bold: true },
      numbers: { color: '000000', bold: true, italic: true, underline: false },
      rows: {
        ...s.print.rows,
        db: { sizeDeltaPt: 2, numberColor: 'C00000', labelColor: 'C00000', bold: null, italic: false, underline: true, fill: 'F3F4F6' },
        4: { ...s.print.rows['4'], sizeDeltaPt: -0.5, bold: false }
      }
    }
    // Label dòng địa chỉ, dòng tự do đầu (xen giữa) và cuối phiếu
    s.header.addrLabel = { ...s.header.addrLabel, value: 'ĐC:', italic: true }
    s.header.extra = [{ ...newFreeLine('h1'), text: { ...newFreeLine('h1').text, value: 'Zalo: 0909 000 111' }, align: 'left' }]
    s.header.order = ['name', 'h1', 'addr', 'contact']
    s.header.footer = [
      { ...newFreeLine('f1'), text: { ...newFreeLine('f1').text, value: 'Chúc quý khách may mắn!', bold: false, italic: true } },
      { ...newFreeLine('f2'), label: { ...newFreeLine('f2').label, value: 'Ghi chú:' }, afterPt: 2 }
    ]
    s.printer = { deviceName: 'Canon LBP2900', silent: true, copies: 3 }
    s.output.dir = 'D:\\Xo so\\phieu'
    s.autoRefresh = false
    return s
  }

  /** Phần có trong file .conf (bỏ máy in, thư mục lưu, tự lấy lại — riêng từng máy). */
  const confPart = (s: ReturnType<typeof defaultSettings>) => ({ header: s.header, stations: s.stations, print: s.print })

  it('xuất rồi nhập lại ra y nguyên (mặc định và đã chỉnh hết)', () => {
    for (const s of [defaultSettings(), custom()]) {
      const text = exportConf(s, meta)
      const back = importConf(text, defaultSettings())
      expect(back.ignored).toEqual([])
      expect(confPart(back.settings)).toEqual(confPart(normalizeSettings(s)))
    }
  })

  it('nhập lên cài đặt đang có: phần trong file ra y nguyên, máy in / thư mục lưu của máy giữ nguyên', () => {
    const mine = custom()
    const back = importConf(exportConf(defaultSettings(), meta), mine)
    expect(confPart(back.settings)).toEqual(confPart(defaultSettings()))
    expect(back.settings.printer).toEqual(mine.printer)
    expect(back.settings.output).toEqual(mine.output)
    expect(back.settings.autoRefresh).toBe(false)
  })

  it('không xuất và không nhập máy in, thư mục lưu, tự lấy lại', () => {
    const text = exportConf(custom(), meta)
    expect(text).not.toMatch(/PRINTER|PRINT_FAST|PRINT_COPIES|OUTPUT_DIR|AUTO_REFRESH|Canon/)
    const r = importConf('PRINTER="Canon"\nPRINT_COPIES=3\nOUTPUT_DIR="D:\\x"\nAUTO_REFRESH=0\nPAPER=A5')
    expect(r.ignored).toEqual(['PRINTER', 'PRINT_COPIES', 'OUTPUT_DIR', 'AUTO_REFRESH'])
    expect(r.imported).toBe(1)
    expect(r.settings.printer).toEqual(defaultSettings().printer)
    expect(r.settings.output).toEqual(defaultSettings().output)
  })

  it('dòng tự do: số dòng trong file thay hẳn danh sách; thứ tự theo HEADER_ORDER; dòng không có thì báo bỏ qua', () => {
    const base = defaultSettings()
    base.header.extra = [newFreeLine('abc')]
    base.header.order = ['abc', 'name', 'addr', 'contact']
    const r = importConf(['HEADER_LINES=2', 'HEADER_LINE_2_TEXT="Hai"', 'HEADER_LINE_3_TEXT="Ba"', 'HEADER_ORDER="line2, name, addr, contact, line1"', 'FOOTER_LINES=9'].join('\n'), base)
    expect(r.settings.header.extra.map((x) => [x.id, x.text.value])).toEqual([['h1', ''], ['h2', 'Hai']])
    expect(r.settings.header.order).toEqual(['h2', 'name', 'addr', 'contact', 'h1'])
    expect(r.ignored).toEqual(['HEADER_LINE_3_TEXT', 'FOOTER_LINES'])
    // không có HEADER_LINES: giữ dòng đang có
    expect(importConf('PAPER=A5', base).settings.header.extra.map((x) => x.id)).toEqual(['abc'])
  })

  it('file xuất đọc được bằng mắt: có chú thích, đài theo thứ tự, đài tắt có dấu -', () => {
    const text = exportConf(custom(), meta)
    expect(text).toContain('# Cài đặt Xổ Số Đại Lý — xuất lúc 29-10-2026 10:00 (phiên bản 1.0.0)')
    expect(text).toContain('STATIONS_ORDER_T2="ca-mau, -tp-hcm, dong-thap"')
    expect(text).toContain('CARD_WIDTH_CM=auto')
    expect(text).toContain('NUMBER_ALIGN=bottom-center')
    expect(text).toContain('CONF_VERSION=4')
    expect(text).toContain('AGENT_CONTACT="DĐ: 0909 000 111  DĐ: 0283 333 444"')
    expect(text).toContain('DATE_LINE_AFTER_PT=6')
    expect(text).not.toMatch(/AGENT_PHONES|DATE_LINE_SHOW/)
    expect(text.split('\n').filter((l) => l.startsWith('NAME_'))).toHaveLength(21)
  })

  it('căn 9 vị trí ghi được nhiều kiểu; kiểu sai thì báo bỏ qua', () => {
    const r = importConf('TEXT_ALIGN=middle right\nNUMBER_ALIGN=bottom\nCARD_HEIGHT_CM=auto\nTEXT_PAD_X_CM=0,2\nNUMBER_ALIGN=giữa')
    expect(r.settings.print.textCell).toMatchObject({ alignY: 'center', alignX: 'right', padXCm: 0.2 })
    expect(r.ignored).toEqual(['NUMBER_ALIGN'])
  })
})

import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportConf, importConf, parseConf } from '../src/core/conf'
import { defaultSettings, normalizeSettings } from '../src/core/settings'
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
    expect(Object.values(s.print.colors)).toEqual(['000000', '000000', '000000', '000000'])
    expect(s.print.textCell).toEqual({ padXCm: 0.05, padYCm: 0.05, alignX: 'center', alignY: 'top' })
    expect(s.print.numberCell).toEqual({ padXCm: 0.3, padYCm: 0.05, alignX: 'right', alignY: 'center' })
    // Thông tin đại lý để trống, đại lý tự nhập
    expect([s.header.label.value, s.header.name.value, s.header.addr.value]).toEqual(['', '', ''])
    expect(Object.keys(s.header)).toEqual(['label', 'name', 'addr', 'phones', 'date'])
    expect(s.header.phones.values).toEqual([])
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
      header: { name: { size: 99, value: 'A' }, addr: { size: 7.3 } },
      print: { paper: 'B5', cardGapXCm: -1, numberFontPt: '13,5', colors: { text: '#ff0000', border: 'xanh' } }
    })
    expect(s.header.name).toEqual({ show: true, size: 30, value: 'A' })
    expect(s.header.addr.size).toBe(7.5)
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
    expect(s.print.colors.text).toBe('FF0000')
    expect(s.print.colors.border).toBe('000000')
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
    expect(s.header.phones.values).toEqual(['01212 019 343', '0983 019 343'])
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
    expect(s.print.colors.accent).toBe('E00000')
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
})

describe('exportConf', () => {
  const meta = { appName: 'Xổ Số Đại Lý', version: '1.0.0', when: '29-10-2026 10:00' }

  function custom() {
    const s = defaultSettings()
    s.header.label.value = 'Đại lý vé số:'
    s.header.name = { show: true, size: 16, value: 'MINH "NGỌC" & CON # 2' }
    s.header.addr = { show: false, size: 9.5, value: '12 Trần Hưng Đạo, Q.5' }
    s.header.phones = { show: true, size: 11, values: ['0909 000 111', '0283 333 444'] }
    s.header.date = { show: false, size: 12 }
    s.stations.mode = 'pick'
    s.stations.byWeekday[1] = [{ slug: 'ca-mau', on: true }, { slug: 'tp-hcm', on: false }, { slug: 'dong-thap', on: true }]
    s.stations.byWeekday[6] = [{ slug: 'hau-giang', on: true }, { slug: 'tp-hcm', on: true }, { slug: 'long-an', on: false }, { slug: 'binh-phuoc', on: true }]
    s.stations.shortNames = { 'ca-mau': 'Cà Mau', 'tp-hcm': 'HCM' }
    s.print = {
      ...s.print,
      paper: 'A5', format: 'both', cardWidthCm: null, cardHeightCm: 11.5, cardGapXCm: 1, cardGapYCm: 0.2,
      cardAlign: 'center', numberFontPt: 13.5, font: 'Arial',
      textCell: { padXCm: 0.15, padYCm: 0.1, alignX: 'left', alignY: 'center' },
      numberCell: { padXCm: 0.25, padYCm: 0.05, alignX: 'center', alignY: 'bottom' },
      colors: { text: '1F2A6B', accent: 'E00000', border: '7F8FB5', number: '000000' }
    }
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

  it('file xuất đọc được bằng mắt: có chú thích, đài theo thứ tự, đài tắt có dấu -', () => {
    const text = exportConf(custom(), meta)
    expect(text).toContain('# Cài đặt Xổ Số Đại Lý — xuất lúc 29-10-2026 10:00 (phiên bản 1.0.0)')
    expect(text).toContain('STATIONS_ORDER_T2="ca-mau, -tp-hcm, dong-thap"')
    expect(text).toContain('CARD_WIDTH_CM=auto')
    expect(text).toContain('NUMBER_ALIGN=bottom-center')
    expect(text.split('\n').filter((l) => l.startsWith('NAME_'))).toHaveLength(21)
  })

  it('căn 9 vị trí ghi được nhiều kiểu; kiểu sai thì báo bỏ qua', () => {
    const r = importConf('TEXT_ALIGN=middle right\nNUMBER_ALIGN=bottom\nCARD_HEIGHT_CM=auto\nTEXT_PAD_X_CM=0,2\nNUMBER_ALIGN=giữa')
    expect(r.settings.print.textCell).toMatchObject({ alignY: 'center', alignX: 'right', padXCm: 0.2 })
    expect(r.ignored).toEqual(['NUMBER_ALIGN'])
  })
})

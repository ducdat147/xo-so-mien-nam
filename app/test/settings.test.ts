import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultSettings, importConf, normalizeSettings, parseConf } from '../src/core/settings'
import { readSettingsFile, writeSettingsFile } from '../src/core/settings-file'

const CONF_EXAMPLE = readFileSync(join(__dirname, '../../cli/xsmn.conf.example'), 'utf8')

describe('defaultSettings', () => {
  it('đúng mặc định của SPEC', () => {
    const s = defaultSettings()
    expect(s.print).toMatchObject({
      paper: 'A4', format: 'pdf', cardWidthCm: 8, cardGapCm: 0.6, cardAlign: 'left',
      alignText: 'center', alignNumber: 'right', numberPadRightCm: 0.3, numberFontPt: null, font: 'Times New Roman'
    })
    expect(Object.values(s.print.colors)).toEqual(['000000', '000000', '000000', '000000'])
    expect(s.header.note.show).toBe(false)
    // Thông tin đại lý để trống, đại lý tự nhập
    expect([s.header.label.value, s.header.name.value, s.header.addr.value, s.header.fax.value]).toEqual(['', '', '', ''])
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
      print: { paper: 'B5', cardGapCm: -1, numberFontPt: '13,5', colors: { text: '#ff0000', border: 'xanh' } }
    })
    expect(s.header.name).toEqual({ show: true, size: 30, value: 'A' })
    expect(s.header.addr.size).toBe(7.5)
    expect(s.print.paper).toBe('A4')
    expect(s.print.cardGapCm).toBe(0)
    expect(s.print.numberFontPt).toBe(13.5)
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
    expect(ignored).toEqual([])
    expect(imported).toBe(13)
    expect(s.header.label.value).toBe('Đại lý vé số:')
    expect(s.header.name.value).toBe('ĐỨC QUYẾT')
    expect(s.header.phones.values).toEqual(['01212 019 343', '0983 019 343'])
    expect(s.stations.mode).toBe('all')
    expect(s.print).toMatchObject({ paper: 'A4', format: 'pdf', cardWidthCm: 8, numberPadRightCm: 0.3 })
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
    expect(ignored).toEqual(['ALIGN_NUMBER', 'SOFFICE', 'LA'])
    expect(imported).toBe(14)
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
    expect(s.header.note).toMatchObject({ show: true, value: 'Cần so lại' })
    expect(s.print).toMatchObject({
      paper: 'A5', format: 'both', cardWidthCm: 8.5, numberFontPt: 13, cardAlign: 'center', alignNumber: 'right', font: 'Arial'
    })
    expect(s.print.colors.accent).toBe('E00000')
    expect(s.output.dir).toBe('~/Documents/xoso')
  })

  it('giữ các giá trị hiện có khi file không khai báo', () => {
    const base = defaultSettings()
    base.header.fax.value = '000'
    base.print.paper = 'A6'
    const { settings } = importConf('AGENT_NAME=MINH\nAGENT_FAX=', base)
    expect(settings.header.name.value).toBe('MINH')
    expect(settings.header.fax.value).toBe('000')
    expect(settings.print.paper).toBe('A6')
  })
})

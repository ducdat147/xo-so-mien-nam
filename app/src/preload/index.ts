import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type XsmnApi } from '../shared/api'

const api: XsmnApi = {
  init: () => ipcRenderer.invoke(IPC.init),
  fetchResults: (date, force) => ipcRenderer.invoke(IPC.fetchResults, date, force),
  fontCss: (font) => ipcRenderer.invoke(IPC.fontCss, font),
  exportSheet: (req) => ipcRenderer.invoke(IPC.exportSheet, req),
  print: (req) => ipcRenderer.invoke(IPC.print, req),
  openFile: (path) => ipcRenderer.invoke(IPC.openFile, path),
  showInFolder: (path) => ipcRenderer.invoke(IPC.showInFolder, path),
  openOutputDir: () => ipcRenderer.invoke(IPC.openOutputDir),
  saveSettings: (s) => ipcRenderer.invoke(IPC.saveSettings, s),
  importConf: (base) => ipcRenderer.invoke(IPC.importConf, base),
  exportConf: (settings) => ipcRenderer.invoke(IPC.exportConf, settings),
  chooseOutputDir: (current) => ipcRenderer.invoke(IPC.chooseOutputDir, current),
  listPrinters: () => ipcRenderer.invoke(IPC.listPrinters),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch)
}

contextBridge.exposeInMainWorld('xsmn', api)

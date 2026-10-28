# Lệnh thường dùng cho app Electron (app/) và bản bash (cli/). Gõ `make` để xem danh sách.

APP := app
# Terminal của VS Code đặt sẵn ELECTRON_RUN_AS_NODE=1, khiến Electron chạy như Node thuần.
# Gỡ biến này mỗi khi mở app.
RUN := env -u ELECTRON_RUN_AS_NODE

.DEFAULT_GOAL := help
.PHONY: help install dev start build build-win7 test test-watch typecheck check golden cli-demo clean \
        version dist-mac dist-win dist-win7 dist-linux

help: ## Liệt kê các lệnh
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-12s %s\n", $$1, $$2}'

install: ## Cài thư viện cho app (npm install)
	cd $(APP) && npm install

dev: ## Chạy app ở chế độ phát triển, tự nạp lại khi sửa code
	cd $(APP) && $(RUN) npm run dev

start: ## Build rồi chạy bản build (giống bản phát hành)
	cd $(APP) && $(RUN) npm run start

build: ## Build app vào app/out
	cd $(APP) && npm run build

build-win7: ## Build cho bản Windows 7 (Electron 22: Node 16, Chromium 108)
	cd $(APP) && XSMN_TARGET=win7 npm run build

test: ## Chạy unit test (vitest)
	cd $(APP) && npm test

test-watch: ## Chạy test, tự chạy lại khi sửa
	cd $(APP) && npm run test:watch

typecheck: ## Kiểm tra kiểu TypeScript
	cd $(APP) && npm run typecheck

check: typecheck test ## Kiểm tra kiểu + chạy test

version: ## In phiên bản hiện tại; đặt bản mới: make version V=1.1.0
	@if [ -n "$(V)" ]; then \
	  cd $(APP) && npm version "$(V)" --no-git-tag-version >/dev/null && \
	  echo "Đã đặt phiên bản $(V). Nhớ thêm mục $(V) vào CHANGELOG.md rồi tạo tag v$(V)."; \
	else node -p "'Phiên bản hiện tại: ' + require('./$(APP)/package.json').version"; fi

dist-all:
	$(MAKE) dist-mac dist-win dist-win7 dist-linux

dist-mac: ## Đóng gói macOS (.dmg arm64 + x64) vào app/release
	cd $(APP) && npm run dist:mac

dist-win: ## Đóng gói Windows 10/11 (.exe x64)
	cd $(APP) && npm run dist:win

dist-win7: ## Đóng gói Windows 7 (.exe gộp 32 + 64-bit, Electron 22)
	cd $(APP) && npm run dist:win7

dist-linux: ## Đóng gói Linux (.AppImage + .deb x64)
	cd $(APP) && npm run dist:linux

golden: ## Sinh lại document.xml mẫu từ cli/xsmn.sh (khi build_docx đổi)
	cd $(APP) && ./scripts/make-golden.sh

cli-demo: ## Chạy bản bash với fixture 26-10-2026, không cần mạng
	cd cli && ./xsmn.sh -d 26-10-2026 --html tests/fixture-26-10-2026.html -f docx

clean: ## Xoá thư mục build
	rm -rf $(APP)/out $(APP)/dist $(APP)/release

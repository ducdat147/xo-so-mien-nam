# Lệnh thường dùng cho app Electron (app/). Gõ `make` để xem danh sách.

APP := app
# Terminal của VS Code đặt sẵn ELECTRON_RUN_AS_NODE=1, khiến Electron chạy như Node thuần.
# Gỡ biến này mỗi khi mở app.
RUN := env -u ELECTRON_RUN_AS_NODE

.DEFAULT_GOAL := help
.PHONY: help install dev start build build-win7 test test-watch typecheck check golden clean \
        version dist-mac dist-win dist-win7 dist-linux docs docs-build

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
	cp $(APP)/release/*.dmg resources/

dist-win: ## Đóng gói Windows 10/11 (.exe x64) và Windows 7 (.exe gộp 32 + 64-bit, Electron 22) vào app/release
	cd $(APP) && npm run dist:win
	cd $(APP) && npm run dist:win7
	cp $(APP)/release/*.exe resources/

dist-linux: ## Đóng gói Linux (.AppImage + .deb x64)
	cd $(APP) && npm run dist:linux
	cp $(APP)/release/*.AppImage resources/
	cp $(APP)/release/*.deb resources/

golden: ## Cập nhật bản chụp file Word chuẩn (chỉ khi cố ý đổi bố cục; xem diff trước khi commit)
	cd $(APP) && UPDATE_GOLDEN=1 npx vitest run test/render-docx.test.ts

docs: ## Chạy trang tài liệu (website/) ở máy, tự nạp lại khi sửa
	cd website && ([ -d node_modules ] || npm install) && npm run dev

docs-build: ## Build trang tài liệu vào website/.vitepress/dist (báo lỗi nếu có link hỏng)
	cd website && ([ -d node_modules ] || npm install) && npm run build

clean: ## Xoá thư mục build
	rm -rf $(APP)/out $(APP)/dist $(APP)/release

# WaveDrom GUI Editor — development Makefile
#
# Today the app is client-only (Vite + React). Back-end targets activate when
# you add e.g. backend/package.json (Node) or backend/pyproject.toml (Python).

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

ROOT        := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
RUN_DIR     := $(ROOT)/.run
NVM_SH      := source "$$HOME/.nvm/nvm.sh" 2>/dev/null;

FRONTEND_PORT ?= 5173
BACKEND_DIR   ?= $(ROOT)/backend
BACKEND_PORT  ?= 3000

# Node API proxy (uncomment in vite.config when a backend exists)
# VITE_API_URL ?= http://127.0.0.1:$(BACKEND_PORT)

.PHONY: help install deps clean
.PHONY: front-end fe back-end be api
.PHONY: dev dev-all dev-bg stop status
.PHONY: build test lint preview check typecheck

.DEFAULT_GOAL := help

help:
	@echo "WaveDrom GUI Editor"
	@echo ""
	@echo "Run (development):"
	@echo "  make front-end   Vite dev server (foreground, port $(FRONTEND_PORT))"
	@echo "  make dev         Alias for front-end"
	@echo "  make dev-bg      Front-end (+ back-end if present) in background"
	@echo "  make stop        Stop background dev servers"
	@echo "  make status      Show PIDs / ports for background servers"
	@echo "  make back-end    API server (skipped if $(BACKEND_DIR) missing)"
	@echo ""
	@echo "Verify / ship:"
	@echo "  make install     npm install"
	@echo "  make test        Vitest"
	@echo "  make typecheck   tsc --noEmit"
	@echo "  make build       Production build -> dist/"
	@echo "  make preview     Serve dist/ locally"
	@echo "  make lint        ESLint"
	@echo "  make check       typecheck + test + build"
	@echo ""
	@echo "Variables: FRONTEND_PORT=$(FRONTEND_PORT) BACKEND_PORT=$(BACKEND_PORT) BACKEND_DIR=$(BACKEND_DIR)"

install deps:
	@$(NVM_SH) cd "$(ROOT)" && npm install

# ── Front-end (Vite) ───────────────────────────────────────────────────────────

front-end fe dev:
	@$(NVM_SH) cd "$(ROOT)" && npm run dev -- --host 0.0.0.0 --port $(FRONTEND_PORT)

# ── Back-end (optional; add backend/ later) ────────────────────────────────────

back-end be api:
	@if [ -f "$(BACKEND_DIR)/package.json" ]; then \
		$(NVM_SH) cd "$(BACKEND_DIR)" && \
		if grep -q '"dev"' package.json 2>/dev/null; then \
			PORT=$(BACKEND_PORT) npm run dev; \
		elif grep -q '"start"' package.json 2>/dev/null; then \
			PORT=$(BACKEND_PORT) npm start; \
		else \
			echo "backend/package.json has no dev/start script"; exit 1; \
		fi; \
	elif [ -f "$(BACKEND_DIR)/pyproject.toml" ] || [ -f "$(BACKEND_DIR)/requirements.txt" ]; then \
		cd "$(BACKEND_DIR)" && \
		if command -v uvicorn >/dev/null 2>&1; then \
			uvicorn main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT); \
		else \
			echo "Install uvicorn in backend venv, or add backend/package.json"; exit 1; \
		fi; \
	else \
		echo "No backend at $(BACKEND_DIR) (client-only app; see agent.md)."; \
		echo "Create backend/ with package.json or pyproject.toml to enable this target."; \
		exit 1; \
	fi

# ── Background dev (SSH / multitask friendly) ────────────────────────────────

dev-bg: stop
	@mkdir -p "$(RUN_DIR)"
	@echo "Starting front-end on 0.0.0.0:$(FRONTEND_PORT) ..."
	@$(NVM_SH) cd "$(ROOT)" && \
		nohup npm run dev -- --host 0.0.0.0 --port $(FRONTEND_PORT) \
		>"$(RUN_DIR)/frontend.log" 2>&1 & echo $$! >"$(RUN_DIR)/frontend.pid"
	@if [ -f "$(BACKEND_DIR)/package.json" ]; then \
		echo "Starting Node back-end on port $(BACKEND_PORT) ..."; \
		$(NVM_SH) cd "$(BACKEND_DIR)" && \
		(PORT=$(BACKEND_PORT) nohup npm run dev >"$(RUN_DIR)/backend.log" 2>&1 & echo $$! >"$(RUN_DIR)/backend.pid") || true; \
	elif [ -f "$(BACKEND_DIR)/pyproject.toml" ] || [ -f "$(BACKEND_DIR)/requirements.txt" ]; then \
		if command -v uvicorn >/dev/null 2>&1; then \
			echo "Starting Python back-end on port $(BACKEND_PORT) ..."; \
			cd "$(BACKEND_DIR)" && \
			nohup uvicorn main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT) \
			>"$(RUN_DIR)/backend.log" 2>&1 & echo $$! >"$(RUN_DIR)/backend.pid"; \
		fi; \
	fi
	@$(MAKE) status
	@echo "Logs: tail -f $(RUN_DIR)/frontend.log"

dev-all: dev-bg

stop:
	@-if [ -f "$(RUN_DIR)/frontend.pid" ]; then \
		kill $$(cat "$(RUN_DIR)/frontend.pid") 2>/dev/null || true; \
		rm -f "$(RUN_DIR)/frontend.pid"; \
	fi
	@-if [ -f "$(RUN_DIR)/backend.pid" ]; then \
		kill $$(cat "$(RUN_DIR)/backend.pid") 2>/dev/null || true; \
		rm -f "$(RUN_DIR)/backend.pid"; \
	fi
	@echo "Stopped background dev servers (if any)."

status:
	@echo "Front-end: http://localhost:$(FRONTEND_PORT) (bind 0.0.0.0 for SSH forward)"
	@if [ -f "$(RUN_DIR)/frontend.pid" ]; then \
		echo "  pid $$(cat "$(RUN_DIR)/frontend.pid")  log $(RUN_DIR)/frontend.log"; \
	else \
		echo "  (not running in background)"; \
	fi
	@if [ -f "$(RUN_DIR)/backend.pid" ]; then \
		echo "Back-end:  http://localhost:$(BACKEND_PORT)"; \
		echo "  pid $$(cat "$(RUN_DIR)/backend.pid")  log $(RUN_DIR)/backend.log"; \
	elif [ -d "$(BACKEND_DIR)" ]; then \
		echo "Back-end:  $(BACKEND_DIR) present but not started (run make dev-bg)"; \
	else \
		echo "Back-end:  none ($(BACKEND_DIR) not found)"; \
	fi

# ── CI-style targets ───────────────────────────────────────────────────────────

typecheck:
	@$(NVM_SH) cd "$(ROOT)" && npx tsc --noEmit

test:
	@$(NVM_SH) cd "$(ROOT)" && npm test

build:
	@$(NVM_SH) cd "$(ROOT)" && npm run build

preview:
	@$(NVM_SH) cd "$(ROOT)" && npm run preview -- --host 0.0.0.0 --port $(FRONTEND_PORT)

lint:
	@$(NVM_SH) cd "$(ROOT)" && npm run lint

check: typecheck test build

clean:
	@rm -rf "$(ROOT)/dist" "$(RUN_DIR)"
	@echo "Removed dist/ and .run/"

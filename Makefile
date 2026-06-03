# WaveDrom timing diagram editor — type `make` to list commands.

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
PORT ?= 5173

ifeq ($(OS),Windows_NT)
GIT_BASH := $(firstword $(wildcard "C:/Program Files/Git/bin/bash.exe") $(wildcard "C:/Program Files (x86)/Git/bin/bash.exe"))
ifneq ($(GIT_BASH),)
SHELL := $(GIT_BASH)
endif
else
SHELL := /bin/bash
endif
.SHELLFLAGS := -ec

NPM := source "$$HOME/.nvm/nvm.sh" 2>/dev/null; cd "$(ROOT)" &&

.PHONY: help install dev test build preview check clean

.DEFAULT_GOAL := help

help:
	@echo "WaveDrom editor"
	@echo ""
	@echo "  make install   First-time setup (download dependencies)"
	@echo "  make dev       Open the editor — http://localhost:$(PORT)"
	@echo "  make build     Build a copy for deployment (output: dist/)"
	@echo "  make preview   Try the built copy locally — http://localhost:$(PORT)"
	@echo "  make test      Run automated tests"
	@echo "  make check     Tests + build (before you share or commit)"
	@echo "  make clean     Delete dist/"
	@echo ""
	@echo "Press Ctrl+C to stop dev or preview."

install:
	@$(NPM) npm install

dev:
	@$(NPM) npm run dev -- --host 0.0.0.0 --port $(PORT)

test:
	@$(NPM) npm test

build:
	@$(NPM) npm run build

preview:
	@$(NPM) npm run preview -- --host 0.0.0.0 --port $(PORT)

check: test build

clean:
	@rm -rf "$(ROOT)/dist"
	@echo "Removed dist/"

ifdef $$XDG_DATA_HOME
XDG_DATA_HOME := $$XDG_DATA_HOME
else
XDG_DATA_HOME := ${HOME}/.local/share
endif

SOURCE      := $$PWD
EXT_ID      := paperwm-mod@paperwm.github.com
EXT_DIR     := $(XDG_DATA_HOME)/gnome-shell/extensions
TARGET      := $(EXT_DIR)/$(EXT_ID)

CONFIG_FILES   = config/user.js config/user.css
GSCHEMA_FILES  = schemas/org.gnome.shell.extensions.paperwm.gschema.xml
JS_FILES       = $(wildcard *.js)
UI_FILES       = $(wildcard *.ui)
RESOURCE_FILES = $(wildcard resources/*)

RELEASE_FILES = $(JS_FILES) $(UI_FILES) $(RESOURCE_FILES) \
				$(CONFIG_FILES) $(GSCHEMA_FILES) \
				schemas/gschemas.compiled \
				metadata.json \
				stylesheet.css \
				LICENSE

ZIP         := zip

ifneq (,$(shell command -v gnome-extensions))
GNOME_EXT_DISABLE := gnome-extensions disable
else
GNOME_EXT_DISABLE := gnome-shell-extension-tool --disable
endif

SHELL=/bin/bash

## Update compiled files
all: $(RELEASE_FILES)

## Install PaperWM on this system
install: schemas/gschemas.compiled
	@if [[ ! -L "$(TARGET)" && -d "$(TARGET)" ]]; \
	then                                    \
		echo;                               \
		echo "INSTALL FAILED:";             \
		echo;                               \
		echo "A previous (non-symlinked) installation of PaperWM already exists at:"; \
		echo "'$(TARGET)'.";                   \
		echo;                               \
		echo "Please remove the installed version from that path and re-run this install script."; \
		echo;                               \
		exit 1;                             \
	fi
	@$(call rich_echo,"MKDIR","$(EXT_DIR)")
	@mkdir -p $(EXT_DIR)
	@$(call rich_echo,"LINK","$(EXT_ID)")
	@ln -snf $(SOURCE) $(TARGET)
	@echo
	@echo "INSTALL SUCCESSFUL:"
	@echo
	@echo "If this is the first time installing PaperWM, then please logout/login"
	@echo "and enable the PaperWM extension, either with the GNOME Extensions application,"
	@echo "or manually by executing the following command from a terminal:"
	@echo
	@echo "gnome-extensions enable $(EXT_ID)"
	@echo

## Uninstall PaperWM from this system
uninstall:
	@$(call rich_echo,"GNOME_EXT_DISABLE", "$(EXT_ID)")
	@$(GNOME_EXT_DISABLE) $(EXT_ID)
	@if [[ `readlink -f $(TARGET)` != `readlink -f $$PWD` ]]; \
	then                                                   \
		echo "'$(TARGET)' does not link to '$$PWD', refusing to remove."; \
		exit 1;                                             \
	fi
	@if [ -L $(TARGET) ];                                     \
	then                                                   \
		$(call rich_echo,"RM", "$(TARGET)")                   \
		rm $(EXT);                                         \
	else                                                   \
		read -p "Remove $(TARGET)? (y/N): " -n 1 -r           \
		echo                                               \
		[[ $$REPLY =~ ^[Yy]$ ]] && rm -rf $(TARGET);       \
	fi


## Generate a release zip for review on GNOME Extensions
release: $(EXT_ID).zip


$(EXT_ID).zip: $(RELEASE_FILES)
	@$(call rich_echo,"ZIP","$@")
	@$(ZIP) -r $@ $^

schemas/gschemas.compiled: $(GSCHEMA_FILES)
	@$(call rich_echo,"MAKE","$@")
	@$(MAKE) -C schemas gschemas.compiled

## Verify schemas/gschemas.compiled is current (catches a committed stale binary)
check-schema:
	@$(call rich_echo,"CHECK","schemas/gschemas.compiled is current")
	@tmp=$$(mktemp -d); \
	trap 'rm -rf "$$tmp"' EXIT; \
	glib-compile-schemas --targetdir="$$tmp" schemas || exit 1; \
	if ! cmp -s "$$tmp/gschemas.compiled" schemas/gschemas.compiled; then \
		echo "ERROR: schemas/gschemas.compiled is stale."; \
		echo "Run 'make -C schemas gschemas.compiled' and commit the binary."; \
		exit 1; \
	fi

## Parse every extension module without executing it. A syntax error (for
## example a duplicate `const` from a bad merge) otherwise only surfaces when
## GNOME Shell tries to load the extension, where it stays cached as ERROR
## until logout/login. Node is optional; the check is skipped when absent.
check-syntax:
	@$(call rich_echo,"CHECK","JS syntax - $(words $(JS_FILES)) modules")
	@if command -v node >/dev/null 2>&1; then \
		for f in $(JS_FILES); do \
			node --input-type=module --check < "$$f" || { \
				echo "ERROR: syntax error in $$f"; \
				exit 1; \
			}; \
		done; \
	else \
		echo "node not found; skipping JS syntax check"; \
	fi

## Run the paperwm-mod test suite (gjs).
## lib.test.js (pure functions) runs anywhere; the tiling/navigator/scratch
## suites require a GNOME Shell session (gi:// imports resolve there).
## Also fails when schemas/gschemas.compiled is stale or a module has a
## syntax error.
test: check-schema check-syntax
	@$(call rich_echo,"TEST","running gjs test suite")
	@gjs -m tests/run.js

.PHONY: install uninstall release test check-schema check-syntax

include lib.mk

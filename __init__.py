"""Odin's Throne for the Hermes desktop app.

Agent half of the unified plugin package. The experience lives in the desktop
half (desktop/plugin.js — the bundled Hlidskjalf job list + log viewer); this
module exists so the package installs, validates and loads as a first-class
Hermes plugin. It intentionally registers nothing yet.

No side effects at import or register time — the doctor imports this in a
temporary HERMES_HOME.
"""


def register(ctx, **kwargs):
    """Register agent-facing contributions. Currently none (desktop-only UI)."""
    return []

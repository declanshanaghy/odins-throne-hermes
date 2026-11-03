# UI sharing: the vendored ui/

src/ui/ is vendored from fenrir-ledger development/odins-throne/ui — copied, not shared. As of
the 2026-11-02 audit: 17 of 28 shared-path files byte-identical; 96.1% aggregate character-level
similarity over 9,108 shared-origin LOC; this repo's copy is the superset (adds NamespaceTree,
useNamespaceSummaries, hermesFormat — hermes-harness log parsing). Five seam points where the
targets diverge, each a future platform-adapter function:

1. Theme root — web sets <html> data-theme; plugin scopes to .odins-throne-root
2. WS URL — same-origin /ws vs ${base}/bot/ws?token=
3. REST — same-origin /api/* vs otFetch mapping to /bot/api + bearer
4. Assets — /profiles/*.png URLs vs imported data-URLs (imports serve both)
5. App shell — full-page App vs headless StoreBridge

CSS scoping is build-time (postcss :root→.odins-throne-root), so one stylesheet serves both.

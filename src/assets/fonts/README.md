# Inter font assets

These files are Inter v20 variable WOFF2 subsets from the Google Fonts Inter project. They are bundled locally; page loads do not request Google Fonts.

- `Inter-Latin.woff2` covers the Latin subset used by the English and Turkish pages.
- `Inter-Latin-Ext.woff2` is generated with the Turkish-specific text subset `ĞğİıŞş`, plus the combining marks and shaping glyphs declared by the subset response. The `ÇçÖöÜü` characters are covered by the Latin subset.
- Both faces support weights 100–900 and use `font-display: swap` in `src/scss/theme.scss`.
- `OFL-Inter.txt` is the license distributed with the font source.

Current WOFF2 inventory: Latin **48,256 bytes** (SHA-256 `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`), Turkish subset **4,260 bytes** (SHA-256 `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956`), **52,516 bytes total**. The license file is 4,377 bytes.

Sources: [Inter project metadata](https://github.com/google/fonts/blob/main/ofl/inter/METADATA.pb), [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt), [Latin WOFF2 v20](https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2), and the Google Fonts CSS API `text=ĞğİıŞş` subset for the Latin-ext file. The downloaded license is retained beside the font files.

The production build acceptance checks that the local WOFF2 files are valid, the combined source size remains below the 120 KB WOFF2 budget, the CSS has the expected subsets and `font-display`, and both hashed assets are emitted. Update the source CSS ranges and this note if the subsets are regenerated.

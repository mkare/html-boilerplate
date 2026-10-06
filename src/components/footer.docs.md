# Shared footer

## Purpose and data

The footer provides shared brand information and manifest-derived page, blueprint, and external links. `footerNavigation`, `blueprintNavigation`, and `externalNavigation` are build inputs. Internal destinations go through `route(pageId)`; external social links use their configured `href` and `rel="noreferrer"`. Optional `homePageId` and `demoBrand` profile locals scope the brand link and displayed name; legacy pages fall back to `legacy.home` and `Interface Kit`.

## Runtime API

`mountFooter(root = document)` finds one footer root, writes the current year into `[data-current-year]`, and returns the existing controller if the same footer is mounted again. Its `{ destroy() }` handle restores the original year text when it has not been changed by the page and permits a later remount. Footer markers use data attributes rather than duplicate document-global IDs.

`mountShell(root = document, options = {})` is the owner for all footer roots under its input and isolates a failure in one component from other shell widgets.

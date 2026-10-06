# Responsive picture

Purpose: render a responsive raster image from generated AVIF/WebP candidates with a JPEG or PNG fallback.

## Pug API

`+responsivePicture(image, { sizes, alt, className })` requires:

- `image`: a record from `generateResponsiveImageVariants`, enriched by the Webpack integration with a resolved `src` URL for every candidate and the fallback.
- `sizes`: the CSS slot-width description used to select a `srcset` candidate.
- `alt`: caller-owned alternative text. Decorative images may pass an empty string deliberately.
- `className`: optional class applied to the `<picture>` element.

The mixin emits supported sources in AVIF then WebP order, followed by the JPEG/PNG `<img>` fallback. All sources use width descriptors and the same `sizes`; the fallback image receives the source's intrinsic dimensions. `priority: true` opts into `loading="eager"` and `fetchpriority="high"`; other images use `loading="lazy"`.

## Build input and output

`validateResponsiveImageEntries` accepts an explicit array of `{ id, owner, source, widths, formats?, fallback?, priority? }`. IDs are unique map keys; owners are safe filename namespaces. Widths must be unique, ascending, positive integers no wider than the orientation-adjusted source. AVIF/WebP are the default outputs. JPEG and PNG are the only fallback formats; JPEG/PNG input defaults to its source format. Animated files are rejected.

`generateResponsiveImageVariants` is side-effect-free. It returns `images` metadata and `assets` buffers; the Webpack plugin owns URL resolution and emits each buffer under its owner-qualified, content-hashed filename. Sharp's fixed output settings are AVIF quality 55 / effort 2 / 4:2:0, WebP quality 78 / effort 4, JPEG quality 82 / progressive / 4:2:0, and PNG compression level 9. EXIF orientation is applied before resize; Sharp's default output strips source metadata.

No production raster source is registered by this component. Temporary QA fixtures exercise conversion without becoming demo or release content.

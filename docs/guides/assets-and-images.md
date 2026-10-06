# Assets and responsive images

## Source ownership

Use `src/assets/images/` for shared image assets and `src/pages/<demo>/assets/` for demo-owned art. Keep an image beside the demo that owns it so identical filenames from separate demos retain separate namespaces. Keep `public/` for intentionally hashless copied files. Imported assets are emitted with hashed Webpack names and the configured `assetBase`.

The shared UI symbol file is `src/assets/images/ui-icons.svg`. Reference its symbols through the dashboard icon mixin or a decorative SVG `<use>` with `require('@images/ui-icons.svg')`. Symbol IDs are prefixed by their consumer family. Keep logos, favicons, and editorial artwork outside this UI sprite. Same-origin external SVG references keep working at root and subpath deployments.

## AVIF, WebP, and fallback variants

`config/responsive-images.cjs` is the opt-in raster manifest. It is empty until a real demo image has a known source and license. Add each registered image once under `entries`, using an owner-qualified ID and a repository-relative source path; then list the IDs under the page that renders them in `pages`.

```js
module.exports = {
  entries: [
    {
      id: 'agency-home-hero',
      owner: 'agency',
      source: 'src/pages/agency/assets/licensed-hero.jpg',
      widths: [480, 960, 1440],
      formats: ['avif', 'webp'],
      fallback: 'jpeg',
      priority: true,
    },
  ],
  pages: {
    'agency.home': ['agency-home-hero'],
  },
};
```

The build validates source ownership, supported raster input, dimensions, width limits, output identity, and requested formats. It creates AVIF and WebP candidates plus resized JPEG or PNG fallback candidates with Sharp **0.35.5**, then emits them as Webpack assets. The generated picture record includes intrinsic dimensions and aspect ratio; use the `responsivePicture` Pug mixin with an explicit `sizes` value and useful alternative text. Priority images load eagerly with high fetch priority. Other images load lazily. The release checker verifies each referenced candidate exists; the preview smoke serves image bytes with their image MIME types at root and subpath URLs.

Do not add an unlicensed or unrelated raster photo to exercise the production path. Disposable, nonshipping fixtures cover conversion and namespace behavior. The tracked `src/assets/images/cadillac.jpg` has no source/license record and is unused, so it is excluded.

Sharp's official [installation guide](https://sharp.pixelplumbing.com/install/) lists Node.js 20.9.0 or newer; this project pins Node 22.23.2. Its [output API](https://sharp.pixelplumbing.com/api-output/) supports AVIF and WebP. Sharp's platform binaries are installed as optional dependencies, so the Yarn install must include optional packages on the target platform.

No raster image is currently registered for either demo. The pipeline and SVG sprite can therefore be checked independently, while selecting and testing an actual LCP image remains dependent on suitable licensed demo content.

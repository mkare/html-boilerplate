# Faz 0 — Route ve sayfa envanteri

**Başlangıç snapshot’ı:** 2026-10-03  
**Kapsam:** Aşağıdaki 11 satır, planın başlangıç ölçümündeki legacy route setidir. Bu tarihli ilişki haritası temiz git ağacı veya etiketli commit değildir. Güncel katalog route seti manifestten üretilen tabloda ayrıca tutulur.

İlk 11 route; root, Markdown, about, component/template katalogları, üç auth sayfası, dashboard, commerce ve marketing örnekleridir. Bunlar sonraki demo ve içerik route’larıyla karıştırılmamalıdır.

Locale başlangıç kararı: home ve üç auth route’u Türkçe (`tr`); about, markdown, components, templates, dashboard, commerce ve marketing ağırlıklı İngilizce (`en`). Dashboard içindeki birkaç Türkçe aria-label içerik temizliği sırasında doğrulanmalı.

| Legacy route | Başlangıç output’u | Başlangıç Pug entry’si | CSS entry / kaynak ilişkisi | JS entry / ortak davranış | Başlangıç layout’u |
| --- | --- | --- | --- | --- | --- |
| `/` | `dist/index.html` | `src/views/index/index.pug` | `src/views/index/index.scss` → `src/scss/main.scss` | `src/views/index/index.js` → `src/js/layouts/base.js` → header + footer controller’ları | `src/layouts/base.pug` |
| `/markdown/` | `dist/markdown/index.html` | `src/views/markdown/index.pug` | `src/views/markdown/style.scss` → `src/scss/main.scss` | Sayfa JS entry’si yok; bu nedenle üretilen belgede script yok | `src/layouts/base.pug` |
| `/about/` | `dist/about/index.html` | `src/views/about/about.pug` | `src/views/about/about.scss` → `src/scss/main.scss` | `src/views/about/about.js` → `src/js/layouts/base.js` → header + footer | `src/layouts/base.pug` |
| `/components/` | `dist/components/index.html` | `src/views/components/components.pug` | `src/views/components/components.scss` → `src/scss/main.scss` | `src/views/components/components.js` → base layout JS | `src/layouts/base.pug` |
| `/templates/` | `dist/templates/index.html` | `src/views/templates/templates.pug` | `src/views/templates/templates.scss` → `src/scss/main.scss` | `src/views/templates/templates.js` → base layout JS | `src/layouts/base.pug` |
| `/auth/login/` | `dist/auth/login/index.html` | `src/views/auth/login.pug` | `src/views/auth/login.scss` → `_auth-shared.scss` → `main.scss` | `src/views/auth/login.js` → base layout JS | `src/layouts/base.pug` |
| `/auth/register/` | `dist/auth/register/index.html` | `src/views/auth/register.pug` | `src/views/auth/register.scss` → `_auth-shared.scss` → `main.scss` | `src/views/auth/register.js` → base layout JS | `src/layouts/base.pug` |
| `/auth/forgot-password/` | `dist/auth/forgot-password/index.html` | `src/views/auth/forgot-password.pug` | `src/views/auth/forgot-password.scss` → `_auth-shared.scss` → `main.scss` | `src/views/auth/forgot-password.js` → base layout JS | `src/layouts/base.pug` |
| `/dashboard/` | `dist/dashboard/index.html` | `src/views/dashboard/dashboard.pug` | `src/views/dashboard/dashboard.scss` → `src/scss/main.scss` | `src/views/dashboard/dashboard.js` → base layout JS | `src/layouts/base.pug` |
| `/commerce/` | `dist/commerce/index.html` | `src/views/commerce/store.pug` | `src/views/commerce/store.scss` → `src/scss/main.scss` | `src/views/commerce/store.js` → base layout JS | `src/layouts/base.pug` |
| `/marketing/` | `dist/marketing/index.html` | `src/views/marketing/marketing.pug` | `src/views/marketing/marketing.scss` → `src/scss/main.scss` | `src/views/marketing/marketing.js` → base layout JS | `src/layouts/base.pug` |

## Paylaşılan ve gözlenen ilişkiler

- Başlangıçta 11 Pug entry’nin hepsi `src/layouts/base.pug` dosyasını `extends` ederdi. Sonraki migrasyonda bazı layout ve entry ilişkileri değişti; güncel ilişkiler aşağıdaki manifest tablosundadır.
- On sayfa JS’i `Base()` çağırır. `Base()` `Header()` ve `Footer()` mount eder. Markdown sayfasında JS entry’si olmadığı için shell davranışı çalışmaz; plan bunu Faz 2’de layout’un yüklediği shell’e taşır.
- Her SCSS girişi ortak `main.scss`’i yeniden derler. Auth sayfaları bunu `_auth-shared.scss` üzerinden yapar. Markdown’ın `style.scss` adı CSS çıktısına da `style.<hash>.css` olarak yansır.
- Planın başlangıç ölçümü bu 11 HTML, 11 CSS ve 10 JS çıktıyı bildirir. Tarihsel kaynak tree ve baseline etiketi mevcut olmadığından başlangıç build ölçümü güncel çalışma ağacından tekrar üretilemez.

## Bilinen route/link kusurları

Plan §2.2’de kayıtlı kusurlar başlangıç snapshot’ına aittir: register sayfasındaki `/terms/` hedefi üretilmiyor; dashboard’da 12 hedefsiz fragment var; bir kısım iç link slash’sız ve `/auth/login/` ile slash’sız karşılığı birlikte bulunuyor; `404.html` üretilmiyor. Bunlar güncel çıktı iddiası değildir. Güncel link kabulü `node qa/check-dist.cjs` ile kontrol edilir; route helper ADR-003’teki slash’lı biçimi üretir.

## Hedef envantere geçiş

Yeni build’de route/output `page.json` ve manifest sözleşmesinden türetilir; elle Webpack entry sırası kalıcı kaynak olmaz. Eski `extends` sayfaları ve wrapper sayfaları aynı manifest çıktısına bağlanır. Yukarıdaki 11 satır başlangıç ilişki haritasıdır; güncel route’lar alttaki tabloda tutulur.

<!-- GENERATED CATALOG ROUTE INVENTORY: START -->
## Güncel katalog preview route matrisi

Manifest ve koleksiyonlardan üretildi; sabit `buildNow=2026-10-03T12:00:00.000Z`, profil `catalog-preview`. Bu snapshot **52 route/output** içerir: 11 legacy `src/views/**` entry’si, 40 `src/pages/**` manifest/content instance’ı ve 1 sistem route’u. Aynı kaynakların customer-profile kapsamı: saas `22` outputs (21 demo routes + 404); agency `10` outputs (9 demo routes + 404). Bu sayılar Faz 0 başlangıç ölçümündeki 11 HTML sayfasıyla aynı kapsam değildir.

| Page ID | Kanonik route | Output | Pug source | CSS source | JS entry | Layout | Locale/direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legacy.home` | `/` | `dist/index.html` | `src/views/index/index.pug` | `src/views/index/index.scss` | `src/views/index/index.js` | `site` | `en/ltr` |
| `legacy.markdown` | `/markdown/` | `dist/markdown/index.html` | `src/views/markdown/index.pug` | `src/views/markdown/style.scss` | `—` | `docs` | `en/ltr` |
| `legacy.about` | `/about/` | `dist/about/index.html` | `src/views/about/about.pug` | `src/views/about/about.scss` | `src/views/about/about.js` | `site` | `en/ltr` |
| `legacy.components` | `/components/` | `dist/components/index.html` | `src/views/components/components.pug` | `src/views/components/components.scss` | `src/views/components/components.js` | `site` | `en/ltr` |
| `legacy.templates` | `/templates/` | `dist/templates/index.html` | `src/views/templates/templates.pug` | `src/views/templates/templates.scss` | `src/views/templates/templates.js` | `site` | `en/ltr` |
| `legacy.auth.login` | `/auth/login/` | `dist/auth/login/index.html` | `src/views/auth/login.pug` | `src/views/auth/login.scss` | `src/views/auth/login.js` | `auth` | `en/ltr` |
| `legacy.auth.register` | `/auth/register/` | `dist/auth/register/index.html` | `src/views/auth/register.pug` | `src/views/auth/register.scss` | `src/views/auth/register.js` | `auth` | `en/ltr` |
| `legacy.auth.forgot-password` | `/auth/forgot-password/` | `dist/auth/forgot-password/index.html` | `src/views/auth/forgot-password.pug` | `src/views/auth/forgot-password.scss` | `src/views/auth/forgot-password.js` | `auth` | `en/ltr` |
| `legacy.dashboard` | `/dashboard/` | `dist/dashboard/index.html` | `src/views/dashboard/dashboard.pug` | `src/views/dashboard/dashboard.scss` | `src/views/dashboard/dashboard.js` | `dashboard` | `en/ltr` |
| `legacy.commerce` | `/commerce/` | `dist/commerce/index.html` | `src/views/commerce/store.pug` | `src/views/commerce/store.scss` | `src/views/commerce/store.js` | `storefront` | `en/ltr` |
| `legacy.marketing` | `/marketing/` | `dist/marketing/index.html` | `src/views/marketing/marketing.pug` | `src/views/marketing/marketing.scss` | `src/views/marketing/marketing.js` | `site` | `en/ltr` |
| `agency.about` | `/demos/agency/about/` | `dist/demos/agency/about/index.html` | `src/pages/agency/about/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.contact` | `/demos/agency/contact/` | `dist/demos/agency/contact/index.html` | `src/pages/agency/contact/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.home` | `/demos/agency/` | `dist/demos/agency/index.html` | `src/pages/agency/home/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.not-found` | `/demos/agency/not-found/` | `dist/demos/agency/not-found/index.html` | `src/pages/agency/not-found/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.project.northline` | `/demos/agency/projects/northline/` | `dist/demos/agency/projects/northline/index.html` | `src/pages/agency/projects/northline/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.projects` | `/demos/agency/projects/` | `dist/demos/agency/projects/index.html` | `src/pages/agency/projects/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.service.brand-strategy` | `/demos/agency/services/brand-strategy/` | `dist/demos/agency/services/brand-strategy/index.html` | `src/pages/agency/services/brand-strategy/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `agency.services` | `/demos/agency/services/` | `dist/demos/agency/services/index.html` | `src/pages/agency/services/page.pug` | `src/pages/agency/agency.scss` | `—` | `agency` | `en/ltr` |
| `commerce.catalog` | `/commerce/catalog/` | `dist/commerce/catalog/index.html` | `src/pages/commerce/catalog/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/catalog.js` | `site` | `en/ltr` |
| `commerce.product.arc-glass-set` | `/commerce/products/arc-glass-set/` | `dist/commerce/products/arc-glass-set/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.drift-weekend-tote` | `/commerce/products/drift-weekend-tote/` | `dist/commerce/products/drift-weekend-tote/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.field-notebook` | `/commerce/products/field-notebook/` | `dist/commerce/products/field-notebook/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.fold-desk-clock` | `/commerce/products/fold-desk-clock/` | `dist/commerce/products/fold-desk-clock/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.form-lounge-chair` | `/commerce/products/form-lounge-chair/` | `dist/commerce/products/form-lounge-chair/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.halo-serving-tray` | `/commerce/products/halo-serving-tray/` | `dist/commerce/products/halo-serving-tray/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.orbit-speaker` | `/commerce/products/orbit-speaker/` | `dist/commerce/products/orbit-speaker/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.orion-table-lamp` | `/commerce/products/orion-table-lamp/` | `dist/commerce/products/orion-table-lamp/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.still-vessel-02` | `/commerce/products/still-vessel-02/` | `dist/commerce/products/still-vessel-02/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `commerce.product.vale-water-bottle` | `/commerce/products/vale-water-bottle/` | `dist/commerce/products/vale-water-bottle/index.html` | `src/pages/commerce/product/page.pug` | `src/pages/commerce/commerce.scss` | `src/pages/commerce/product.js` | `site` | `en/ltr` |
| `saas.auth.create-account` | `/demos/saas/create-account/` | `dist/demos/saas/create-account/index.html` | `src/pages/saas/auth/create-account/page.pug` | `src/pages/saas/auth/auth.scss` | `—` | `auth` | `en/ltr` |
| `saas.auth.reset-password` | `/demos/saas/reset-password/` | `dist/demos/saas/reset-password/index.html` | `src/pages/saas/auth/reset-password/page.pug` | `src/pages/saas/auth/auth.scss` | `—` | `auth` | `en/ltr` |
| `saas.auth.sign-in` | `/demos/saas/sign-in/` | `dist/demos/saas/sign-in/index.html` | `src/pages/saas/auth/sign-in/page.pug` | `src/pages/saas/auth/auth.scss` | `—` | `auth` | `en/ltr` |
| `saas.faq` | `/demos/saas/faq/` | `dist/demos/saas/faq/index.html` | `src/pages/saas/faq/page.pug` | `src/pages/saas/saas.scss` | `—` | `site` | `en/ltr` |
| `saas.features` | `/demos/saas/features/` | `dist/demos/saas/features/index.html` | `src/pages/saas/features/page.pug` | `src/pages/saas/saas.scss` | `—` | `site` | `en/ltr` |
| `saas.home` | `/demos/saas/` | `dist/demos/saas/index.html` | `src/pages/saas/home/page.pug` | `src/pages/saas/saas.scss` | `src/views/marketing/marketing.js` | `site` | `en/ltr` |
| `saas.privacy` | `/demos/saas/privacy/` | `dist/demos/saas/privacy/index.html` | `src/pages/saas/legal/privacy/page.pug` | `src/pages/saas/saas.scss` | `—` | `site` | `en/ltr` |
| `saas.terms` | `/demos/saas/terms/` | `dist/demos/saas/terms/index.html` | `src/pages/saas/legal/terms/page.pug` | `src/pages/saas/saas.scss` | `—` | `site` | `en/ltr` |
| `saas.pricing` | `/demos/saas/pricing/` | `dist/demos/saas/pricing/index.html` | `src/pages/saas/pricing/page.pug` | `src/pages/saas/saas.scss` | `src/views/marketing/marketing.js` | `site` | `en/ltr` |
| `system.maintenance` | `/maintenance/` | `dist/maintenance/index.html` | `src/pages/system/maintenance/page.pug` | `src/pages/system/maintenance/page.scss` | `—` | `minimal` | `en/ltr` |
| `blog.archive` | `/demos/saas/blog/` | `dist/demos/saas/blog/index.html` | `src/pages/blog/archive/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.archive.page2` | `/demos/saas/blog/page/2/` | `dist/demos/saas/blog/page/2/index.html` | `src/pages/blog/archive-page-2/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.category.accessibility` | `/demos/saas/blog/category/accessibility/` | `dist/demos/saas/blog/category/accessibility/index.html` | `src/pages/blog/category-design/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.category.design` | `/demos/saas/blog/category/design/` | `dist/demos/saas/blog/category/design/index.html` | `src/pages/blog/category-design/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.category.research` | `/demos/saas/blog/category/research/` | `dist/demos/saas/blog/category/research/index.html` | `src/pages/blog/category-design/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.category.teams` | `/demos/saas/blog/category/teams/` | `dist/demos/saas/blog/category/teams/index.html` | `src/pages/blog/category-design/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.category.workflow` | `/demos/saas/blog/category/workflow/` | `dist/demos/saas/blog/category/workflow/index.html` | `src/pages/blog/category-design/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.article.tokens-guide` | `/demos/saas/blog/practical-guide-to-design-tokens/` | `dist/demos/saas/blog/practical-guide-to-design-tokens/index.html` | `src/pages/blog/articles/tokens-guide/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.article.accessible-states` | `/demos/saas/blog/designing-accessible-product-states/` | `dist/demos/saas/blog/designing-accessible-product-states/index.html` | `src/pages/blog/articles/tokens-guide/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.article.calm-workflow` | `/demos/saas/blog/calm-workflow-for-product-teams/` | `dist/demos/saas/blog/calm-workflow-for-product-teams/index.html` | `src/pages/blog/articles/tokens-guide/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `blog.article.small-signals` | `/demos/saas/blog/small-signals-better-interfaces/` | `dist/demos/saas/blog/small-signals-better-interfaces/index.html` | `src/pages/blog/articles/tokens-guide/page.pug` | `src/pages/blog/blog.scss` | `—` | `site` | `en/ltr` |
| `system.404` | `/404/` | `dist/404.html` | `build/pages/404.pug` | — | `—` | `minimal` | `en/ltr` |
<!-- GENERATED CATALOG ROUTE INVENTORY: END -->

Matrisi denetle: `node qa/phase-0/check-route-inventory.cjs`. Kaynak manifest değişince tabloyu yenile: `node qa/phase-0/check-route-inventory.cjs --write`. Sabit `buildNow` ve `catalog-preview` profiliyle çalışan QA, URL/output, Pug, CSS/JS ve layout/locale ilişkilerini `build/pages/manifest.cjs` üzerinden doğrular.

**Plan izleri:** §2, §4.4–4.5, §5/Faz 0 iş 0.4; inceleme raporu R01, R16.

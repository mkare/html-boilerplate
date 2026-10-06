# Faz 0 — Dosya sahipliği haritası

Bu harita hedef mimaride her bilginin ve çıktının tek sahibini tanımlar. Mevcut dosyalar migration tamamlandı anlamına gelmez. Bir süre eski ve yeni kaynak birlikte bulunursa uyumluluk köprüsü açıkça adlandırılır; toplu rename veya gizli çift doğruluk kaynağı oluşturulmaz.

| Alan | Tek doğruluk kaynağı / hedef sahibi | Sorumluluk ve sınır | Bugünkü kaynak → hedef sahiplik | Faz |
| --- | --- | --- | --- | --- |
| Build girişi | `webpack.config.js` ince giriş + `build/webpack` | Mode, profil, `siteUrl`, `basePath`, `assetBase`, `buildNow`, alias ve plugin yapılandırması; içerik route’u burada elle listelenmez | `webpack.config.js` → `build/webpack` + `build/pages` | 1 |
| Sayfa kaydı | Her somut sayfa için `page.json` | `id`, `blueprintId`, translation eşleşmesi, route kaynağı, layout/theme/locale, metadata, data/style/script, navigation/gallery/robots; şema ile doğrulanır | Elle sıralı Pug entry’leri → manifest girdileri | 1 |
| Sayfa manifesti | `.generated/pages-manifest.json` | Sayfa ve koleksiyon üreticilerinin normalize sonucu; route/output/navigation/galeri tüketicilerinin ortak girdisi | Webpack entry listesi ve nav listeleri → manifest adaptörü | 1–2 |
| Pug sayfa içeriği | `src/pages/**/page.pug` ve içerik koleksiyonları | Sayfanın semantik içeriği ve blok kompozisyonu; kaynak kaydı dışında route/output/başlık listesi kopyalanmaz | `src/views/index`, `about`, `markdown`, vb. → `src/pages` / `content` | 1–5 |
| Layout | `src/layouts/**` | Belge iskeleti, head slot’ları ve uygun shell; Site/Auth/Dashboard/Storefront/Docs/Minimal ayrımı. Layout sayfa metadatası veya route listesi üretmez | `src/layouts/base.pug` → Document ve amaca uygun layout aileleri | 2 |
| Site blokları | `src/blocks/**` | Header, footer ve tekrar kullanılabilir içerik bölümleri; navigasyon verisi manifestten alınır | `src/components/header.pug`, `footer.pug` → site block’ları | 2, 5 |
| Ortak UI | `src/ui/**` | Props, varyant, HTML erişilebilir temeli, JS controller ve o component’in stili; her component’in katalog örneği aynı modülü kullanır | `src/scss/components/*`, `src/views/components/*` → component modülleri ve katalog sayfası | 2–3 |
| Feature davranışı | `src/features/<yetkinlik>/**` | Auth, commerce/cart, filters gibi iş yetenekleri ve adapter sınırı; genel UI primitive’lerini sahiplenmez | `src/views/auth/*.js`, `src/views/commerce/store.js`, tekrar eden page kodu → feature modülleri | 3–4 |
| JavaScript runtime | `src/js/runtime` ve layout/page entry modülleri | Shell tüm belgeye bir kez mount edilir; page entry yalnız gerekli feature’ı başlatır; modül instance’ı ve controller yaşam döngüsü sözleşmesi burada | `src/js/layouts/base.js`, `src/js/components/*` ve page `*.js` → runtime/shell + sayfa import’ları | 2–3 |
| CSS core/vendor | `src/styles/core.scss`, `src/styles/vendor/**` | Reset, daraltılmış Bootstrap yüzeyi, temel type ve semantic token varsayılanları; Bootstrap uyumluluk import’ları vendor katmanında | `src/scss/custom-bootstrap.scss`, core parçaları → `styles/core` / `styles/vendor` | 2 |
| Tema ve layout/page CSS | `src/themes/**`, `src/layouts/**`, `src/pages/**` stil sahipleri | Sıra `core → theme → layout → page → custom`; page CSS core’u import etmez; aynı CSS bir belgede iki kez üretilmez | `src/scss/variables.scss`, `main.scss`, view SCSS → tokens/themes/layout/page | 2–5 |
| Kullanıcı özelleştirmesi | Proje override alanı (`theme.config`, tokens, `custom.scss`, menü ve özel sayfalar) | Kullanıcıya ait değişiklikler framework çekirdeği dağıtımından ayrılır; override sırası belgelenir | Bugünkü genel SCSS/Pug düzenlemeleri → Faz 6’da belirlenecek kullanıcı-owned alan | 6 |
| İçerik/veri | `content/**` ve sayfaya bağlı data modülleri | Makale/ürün/page content ve locale; format ile adapter hata durumları; route/output derleyici tarafından çözülür | `src/views/commerce/_store-data.pug`, Pug içine gömülü veri → `content/products` / data adapter’ları | 4 |
| Görsel/font kaynakları | `src/assets/**` | Hash’li, türüne göre ayrılmış build asset’ları; Pug/data referansı alias/helper ile, göreli generated path yok | `src/assets/images` ve template asset referansları → asset pipeline | 1–2 |
| Oluşturulmuş ara dosyalar | `.generated/**` | Manifest, Pug wrapper ve diğer build ara çıktıları; elle düzenlenmez, kaynak sayılmaz | Yok → page manifest/wrapper generator | 1 |
| Release çıktısı | `dist/**`, paketleme sonrası `release/**` | `dist` build çıktısıdır; release paketi profil ve checksum manifestiyle oluşturulur; kaynak dosyaların sahibi değildir | `dist` → build çıktı sahibi; `release` → release packager | 1, 6 |
| Kalite kanıtları | `docs/`, `qa/` | ADR/sözleşme insan kararını; QA senaryosu build ve davranış kanıtını tutar. Aynı kabul eşiği çelişkili kopyalarda yazılmaz | Plan/review dosyaları ve Faz 0 envanteri → ADR, mimari sözleşme ve QA | 0–6 |

## Değişmez sahiplik kuralları

1. `id`, normalize route ve output derleyici/manifeste aittir; sayfa data spread’i bunları ezemez.
2. Navigation ve demo galerisi manifestten türetilir; header, footer ve şablonlar bağımsız route listesi tutmaz.
3. Her output’un tek üreticisi vardır. Page, public copy, sitemap, robots veya search index çakışırsa build hata verir.
4. Bir SCSS partial’ının sahibi bellidir. Page entry ortak core’u tekrar import etmez; UI stili başka bir UI kopyasında tutulmaz.
5. `.generated` ve release dosyaları elle düzenlenmez. Kullanıcıya açık override alanı kaynak kontrolündeki framework modüllerinden ayrılır.
6. Mevcut 11 sayfa route’u ve dirty working tree bu hedef haritanın uygulandığını göstermez; migration Faz 1–6’da küçük adımlarla yürür.

**Plan izleri:** §4.4, §4.7–4.8, §5/Faz 0 iş 0.6, §8 geçiş haritası ve §9 kullanıcı özelleştirmeleri.

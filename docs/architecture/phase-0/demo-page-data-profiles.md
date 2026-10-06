# Faz 0 — Demo, sayfa ve veri profilleri

Bu sözleşme üç ayrı kavramı ayırır: **blueprint** sayfa düzeninin tekrar kullanılabilir tanımıdır; **page instance** belirli demo/locale/içeriğin build’de üretilen sayfasıdır; **content record** makale veya ürün gibi koleksiyon verisidir. Tema, renk şeması, yön ve locale varyantı tek başına yeni blueprint sayılmaz.

## Build profilleri

| Profil | Ana sayfa | Route mount’u | Dahil edilen sayfalar | İndeksleme |
| --- | --- | --- | --- | --- |
| `catalog-preview` | Framework kataloğu `/`; demo girişleri katalog route’larında | Demo örnekleri `/demos/<demo>/...`; varsayılan locale prefix’siz, ek locale `/<locale>/` segmentiyle | Katalog ana sayfası, seçili demoların sayfaları, component/templates/docs yüzeyleri ve gösterim verisi. Demo menüleri yalnız seçili demoda bulunan route’lara gider. | Zorunlu `noindex,follow`; robots crawler’ın HTML meta bilgisini okuyabilmesi için preview’ı bütünüyle disallow etmez. |
| `customer-production` | Seçilen tek demo’nun home’u `/` | Demo kimliği route’tan çıkar; ör. katalogdaki `/demos/agency/about/` müşteri build’inde `/about/` olur. `basePath` ayrıca uygulanır. | Yalnız seçilen demo için açıkça seçilmiş page instance’ları, ortak layout/UI ve ihtiyaç duyduğu content/feature/asset’lar. Katalog, başka demo, docs ve gallery sayfaları dışarıda kalır. | Varsayılan `index,follow`; sayfa kaydı gerçek içerik durumuna göre daraltabilir. `siteUrl` gerçek origin’dir. |
| `starter` | Seçilen demo için sade başlangıç home’u `/` | Customer-production ile aynı; demo mount’u köke taşınır | Minimum deploy edilebilir başlangıç: home, about/contact blueprint’i mevcutsa seçilenlerden, 404, Site layout ve P0 UI. İçerik/data örnekleri starter’da tutulanlarla sınırlı. | Scaffold varsayılanında `noindex`; site sahibi gerçek origin ve içerik ayarladıktan sonra production metadata’sını etkinleştirir. |

`config/site.config.cjs` declares `defaultLocale` for the selected package and `defaultLocales` for every packaged demo. `route()` combines the demo mount, the page locale prefix (only when it differs from that demo's default), and `basePath` as separate inputs. `/demos/agency/` mount’ını kaldırmak `basePath` değişikliği değildir. Katalog profilinde seçili demo dışına giden dahili menü linki build’i durdurur.

## v1 demo ve sayfa kapsamı

| Sıra | Paket | v1 kapsamı | Page blueprint / veri sınırı |
| --- | --- | --- | --- |
| İlk tam demo | Agency / corporate | Home, about, services, service detail, projects, project detail, contact, 404 | Her route bir blueprint/instance eşlemesi alır; hizmet/proje listeleri ancak koleksiyon yapısı varsa content record’udur. |
| İkinci tam demo | **SaaS — seçildi (ADR-006)** | Home, features, pricing, FAQ, blog, article ve auth bağlantıları | SaaS v1 kapsamıdır. Gerçek backend/ödeme/e-posta bu statik framework kapsamı dışındadır; adapter sözleşmesi gerekir. |
| Kapasiteye bağlı / sonraki | Commerce | Shop, category, product, cart, checkout UI, order status | Commerce storefront korunan örnektir; ADR-006 kapsamında v1’de ikinci tam demo değildir. “Hazır örnek” tek başına tamamlanmış demo sayılmaz. |
| Sonraki | Editorial, Portfolio, Dashboard | v1 sonrası | Sayım kapasite ve kalite kabulünden sonra yapılır. |

İki dil, dark/light mode veya renk değişimi yeni blueprint değildir. Blueprint sayısı; content record sayısı, layout sayısı ve tema varyantı ayrı ayrı raporlanır. Mevcut commerce ve dashboard sayfaları korunacak örneklerdir; tamamlanmış demo paketi olarak sayılmaz. İkinci demo seçimi ADR-006 ile SaaS olarak karara bağlanmıştır; eski “Faz 5’te seçilecek” önerisi geçerli değildir.

## Mevcut 11 route’un profildeki yeri

| Mevcut örnek | Katalog preview | Tek müşteri / starter |
| --- | --- | --- |
| `/` home | Katalog ana sayfası olarak kalır | Seçilen demo home’u ile yer değiştirir |
| `/about/` | Agency örneği seçilirse `/demos/agency/about/` altına mount edilir; mevcut `/about/` yalnız legacy geçişte korunur | Yalnız seçilen demo sayfa eşlemesi varsa alınır; yeni demo’daki about blueprint’i ayrı instance olabilir |
| `/markdown/`, `/components/`, `/templates/` | Docs/component katalog yüzeyi | Müşteri paketi dışında; starter’da yalnız rehber paketi açıkça istenirse |
| `/auth/login/`, `/auth/register/`, `/auth/forgot-password/` | Katalogdaki auth örnek route’ları olarak kalır; seçili demo menüsünde kullanılacaksa demo mount’una göre üretilir | Seçili ürünün auth bağımlılığı varsa dahil edilir; gerçek authentication server adapter’ına bağlıdır |
| `/dashboard/`, `/commerce/`, `/marketing/` | Gösterim/korunan örnek route’ları olarak kalır; yeni demo page kayıtları kendi demo mount’unu kullanır | Yalnız seçili demo bunları açıkça isterse alınır; var olmaları pakete otomatik dahil etmez |

Bu tablo yeni manifest tamamlandı iddiası değildir; mevcut route’ları hedef profile’lara bağlayan Faz 0 kapsam kararıdır. Mevcut route’lar için gözlenen Pug/CSS/JS ilişkileri [route inventory](./route-inventory.md) içindedir.

## İçerik ve entegrasyon sınırı

- Makale instance’ı `id`, slug, title, description, publish/update zamanı, author, tags, cover, draft ve locale taşır. Slug normalizasyonu tek helper’da yapılır; çakışan slug build’i durdurur.
- Ürün bedeli minor unit + currency ile tutulur ve locale ile formatlanır. DOM’dan ürün kataloğu veya fiyat otoritesi çıkarılmaz.
- Demo filter/search kapsamı görünür biçimde sınırlandırılır. Build-time arşiv/pagination gerçek HTML `<a>` linki üretir; client filter bunun yerine geçmez.
- Demo auth, checkout, newsletter ve dashboard server-side işlemleri sağlamaz. Adapter sonucu başarı, alan hatası, genel hata, iptal ve bulunamadı durumlarını ayırır.

**Plan izleri:** §2.4, §3 ek Faz 0 kararları, §4.4–4.5, §4.9–4.10, §5/Faz 0 iş 0.6 ve Faz 5; inceleme raporu R07, R08, R14.

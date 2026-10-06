# ADR-010 — Sayfa locale’i ve URL prefix’i

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Her page kaydı gerçek içerik dilini `locale` ile, yönü `direction` ile bildirir; HTML `lang` ve `dir` buradan üretilir. Her demo/site bir `defaultLocale` belirler. Varsayılan locale route’larında locale segmenti yoktur; diğer locale’ler `/<locale>/` prefix’i alır. Katalogda demo mount’u korunur: `/demos/<demo>/<sayfa>/`; varsayılan olmayan örnek `/demos/<demo>/<locale>/<sayfa>/` olur. Müşteri build’inde seçilen demo mount’u köke taşınır.

## Mevcut içerik için karar

Locale, sayfa metninin baskın diline göre verilir; ilk migration envanterinde Türkçe ana sayfa ve üç auth sayfası `tr`, İngilizce about, markdown, component kataloğu, templates, dashboard, commerce ve marketing sayfaları `en` olarak işaretlenir. Dashboard’daki Türkçe etiketler içerik temizliği sırasında doğrulanır; karışık tek sayfayı bir dilde etiketlemek içerik çevirisi/temizliği yerine geçmez. Bu etiketleme çeviri üretmez. Sayfa karşılığı yoksa dil değiştirici gösterilmez; `translationKey` yalnız gerçekten üretilmiş eş sayfalara bağlanır. `direction` mevcut `tr`/`en` içerikte `ltr` olur; RTL yönü ayrıca desteklenen locale kaydından gelir.

## Bağlam ve seçenekler

Bugünkü layout sabit `lang="tr"` kullanırken birkaç sayfa İngilizcedir. Locale’i yalnız site kökünde tutmak HTML dilini yanlış verir; her sayfaya elle `lang` koymak kayıt sözleşmesini çoğaltır. Bütün locale’leri daima prefix’lemek `/` ana sayfası ve mevcut URL’leri değiştirir. Varsayılan locale’i prefixesiz tutmak mevcut tek dilli demo route’unu korurken ek diller için çakışmasız URL verir.

## Sonuçlar

`route()` locale prefix’ini ve demo mount’unu üretir; `basePath` bunlardan ayrı dağıtım prefix’idir. Canonical, hreflang ve dil değiştirici yalnız var olan karşılıklara göre türetilir. Legacy 11 route migration sürecinde korunur; locale-aware manifest devreye girince build kabulü her sayfanın `lang/dir` değerini ve iki locale’in route çakışmamasını denetler.

## İzler

Plan §3/K10, §2.1, §4.4–4.5, §4.10; inceleme raporu R07 ve “dil karışıklığı” bulgusu; v1 planı §13.2.

## Uygulama notu (2026-10-05)

`config/site.config.cjs` now provides `defaultLocale` plus per-demo `defaultLocales` (SaaS and Agency default to `en`; `DEFAULT_LOCALE` overrides the selected package). Manifest materialization prefixes non-default demo routes before output, helper, canonical, sitemap, and navigation generation. Preview routes keep `/demos/<demo>/` before the locale segment; customer package routes put the locale segment at the package root. The eleven legacy `src/views/**` routes remain unchanged during migration. Reciprocal hreflang and visible language-switch behavior use only existing `translationKey` instances; current content remains English-only and does not synthesize translations.

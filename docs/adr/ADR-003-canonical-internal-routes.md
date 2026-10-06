# ADR-003 — Kanonik site içi route biçimi

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Bütün site içi sayfa linkleri `route(pageId, params)` ile üretilir ve kanonik route’un sonunda `/` bulunur. Şablon ve içerikte literal site köküne bağlı `href="/..."` yazılmaz. Asset adresleri `route()` yerine asset helper/`publicPath` üzerinden çözülür.

## Bağlam ve kanıt

Mevcut üretimde directory-index dosyaları (`about/index.html`, `components/index.html` vb.) vardır; buna rağmen mevcut şablonlarda `/components`, `/templates`, `/dashboard`, `/commerce`, `/marketing`, `/markdown` ve `/auth/login` gibi sondaki eğik çizgisi olmayan linkler ve bazı slash’lı varyantlar birlikte bulunur. Aynı hedefin birden fazla biçimi canonical, alt dizin ve 404 davranışını belirsizleştirir. `/auth/register/` içindeki `/terms/` hedefi de üretilmiyor.

## Değerlendirilen seçenekler

- **Slash’lı route helper’ı — seçildi.** Directory-index çıktısıyla eşleşir; root ve subpath birleştirmesini tek noktaya taşır.
- **Slash’sız route’lar — seçilmedi.** Hosting katmanında redirect/rewrite davranışına bağlı olur ve mevcut directory-index düzenine ikinci biçim ekler.
- **Şablonda literal absolute path — seçilmedi.** `basePath` ve demo route mount kararlarını her dosyada tekrar ettirir.

## Sonuçlar

`route()` `siteUrl`, `basePath`, demo mount’u ve locale segmentini gerektiğinde kontrollü birleştirir; `publicPath` yalnız asset içindir. `check:dist` eğik çizgisiz site içi linki, bulunmayan route’u ve bozuk fragment’i hata sayar. Hosting kabulünde `/about` isteğinin yönlendirme/404 davranışı belgelenir.

## İzler

Plan §3/K3, §4.4–4.5, §5/Faz 1 ve §7; inceleme raporu R16.

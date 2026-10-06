# Faz 0 — Sayfa ve içerik veri önceliği

## Genel birleştirme kuralı

Normal, çakışmasına izin verilen yapılandırma alanlarında öncelik düşükten yükseğe şöyledir:

`site → theme → demo → page → content → custom`

Bir katman alanı vermediyse alt katmandaki değer kalır; aynı seviyede tekrarlı/conflicting değer sessizce “son yazan kazanır” davranışıyla seçilmez, şema/derleme hatası olur. `custom`, framework kaynak kodunu değil, proje sahibinin açık override alanını ifade eder. Bu sıra yalnızca aşağıdaki korunmuş alan kurallarına tabidir.

## Alan bazlı sözleşme

| Alan grubu | Düşükten yükseğe etkin kaynak | Kural / doğrulama |
| --- | --- | --- |
| Marka tokenları ve tema varyantı | `site defaults → theme → demo → page variant → custom` | İçerik token değiştirmez. Custom override token API’si ve CSS yükleme sırasına uyar. |
| Sayfa metadatası (`title`, `description`, OG varsayılanları) | `site → theme → demo → page → content instance → custom` | Sayfa kaydı fallback sağlar; içerikten üretilen makale/ürün kendi gerçek başlık/açıklamasını verir; açık proje custom override en yüksek normal önceliktir. Required değer kalmazsa build durur. |
| Sayfa gövdesi ve koleksiyon kaydı | `site defaults → theme defaults → demo → page defaults → content record → custom` | Content schema içerik tipine göre doğrular. Product price minor unit + currency olur. Kaynak metin/ürün görünür DOM’dan türetilmez. |
| Navigation item label/order/visibility | `site defaults → demo → page navigation override → custom` | İçerik record’u nav yapısını değiştirmez. Link yalnız seçili profil manifestindeki route’a gider. Kayıtlı karşılığı olmayan route build hatasıdır. |
| Dil ve yön | `site defaultLocale/direction → demo defaultLocale → page.locale/direction → matching content locale` | Page `locale` eksiksizdir ve HTML `lang`/`dir` için otoritedir. Content locale page locale ile uyuşmuyorsa reddedilir. Custom, yalnız schema’nın açıkça desteklediği proje locale override’ını verebilir; route çakışması kabul edilmez. |
| Robots/indeksleme | `profile policy → page robots → explicit production custom policy` | `development` ve `catalog-preview` profilleri `noindex` zorunlu kılar; page/custom bunları `index`e çeviremez. `customer-production` ve `release-html` için profil varsayılanı `index,follow`, sayfa/custom açıkça daraltabilir. |
| Adapter ve demo yetenekleri | `site defaults → theme → demo → page wiring → custom adapter` | Feature davranışının ağ sonucu ile “bulunamadı” sonucu ayrılır. Demo paketi dışında gereken entegrasyon açık adapter adresi/sözleşmesi ister. |
| `siteUrl`, `basePath`, `assetBase`, `buildNow`, build profile | Build invocation/config tek sahibi | Sayfa, content veya custom page data spread’i build ortamı girdilerini değiştiremez. Aynı girdiler deterministik çıktıya bağlanır. |
| `id`, normalize `route`, `output` ve output sahipliği | Manifest/compiler tek sahibi | Page registration kimliği ve route parametreleri doğrulanır; derleyici normalize edilmiş değerleri kilitler. Custom/content spread ile ezilemez. Duplicate ID, route, output ve producer çakışması build hatasıdır. |

## Güvenli çözüm sırası

1. Site/build profile ayarlarını yükle.
2. Theme ve demo varsayılanlarını birleştir.
3. Sayfa kayıtları ve içerik instance’larını şemaya göre doğrula.
4. Genel alanlarda yukarıdaki sıra ile tek sonuç üret; korunmuş alanları compiler/profile kurallarıyla ayrı doğrula.
5. Normalize route/output’ları üret, benzersizlik ve seçili demo içi linkleri denetle.
6. Sonuçları `.generated/pages-manifest.json` içinde dondur; nav, gallery, sitemap ve page wrapper aynı manifesti tüketir.

Bu sözleşme, plan §4.4’teki genel öncelik sırasını somut alanlara uygular. Kod veya validator Faz 1 işidir.

**Plan izleri:** §3 ek Faz 0 kararları, §4.4 veri önceliği ve reddedilecek manifest koşulları, §4.10 locale/robots; inceleme raporu R07–R09.

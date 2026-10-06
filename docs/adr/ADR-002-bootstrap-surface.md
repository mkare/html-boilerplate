# ADR-002 — Korunan Bootstrap CSS yüzeyi

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Framework core’unda Bootstrap `reboot`, `containers` ve `grid` modülleri korunur. Mevcut `.nav-link` ve `.nav-item` sınıfları için Bootstrap `nav` modülü korunur. `helpers` çıkarılır; `utilities/api` yalnız mevcut şablonlarda kullanılan `.list-unstyled` ve `.my-0` utility’lerini üretecek şekilde daraltılır. Sonradan eklenen Bootstrap sınıfı önce bu allowlist’e alınmalıdır.

## Bağlam ve kanıt

Mevcut `custom-bootstrap.scss`, `utilities`, `helpers`, `grid`, `containers`, `reboot`, `type`, `images`, `nav` ve `utilities/api` yükler. İnceleme ölçümünde bu dosya 103.987 byte ham / 14.845 byte gzip; ortak `main.scss` çıktısının yaklaşık %91’idir. Şablon kullanımı çok daha küçük: `container`, `nav-link`, `nav-item`, `list-unstyled` ve `my-0`. Bu nedenle Bootstrap’ı tamamen kaldırmak yerine korunan yüzeyi gerçek bağımlılığa bağlamak daha düşük geçiş maliyetlidir.

## Değerlendirilen seçenekler

- **Grid/temel reset + kullanılan nav ve iki utility ile sınırlandırma — seçildi.** Mevcut layout ve sınıf adları korunur; tam utility API’sinin maliyeti taşınmaz.
- **Bootstrap utility ve helper modüllerini tümüyle korumak — seçilmedi.** Geçişi kolaylaştırır, ancak ölçülen ortak CSS tekrarını sürdürür.
- **Nav sınıflarını hemen özel `ui-*` sınıflarına çevirmek — seçilmedi.** Ayrı bir sınıf göçü ve iki sistemli geçiş gerektirir; şu anki kanıt bu maliyeti zorunlu kılmıyor.

## Sonuçlar

Faz 2 başlangıç/bitiş core gzip ölçümünü aynı yöntemle raporlar. Şablonda allowlist dışı Bootstrap sınıfı lint uyarısı üretir. Bootstrap köprüsü ve tema değişkenleri ayrı kabul edilir; bu karar Sass geçişinin mekanik import değişimine indirgenmesine izin vermez.

## İzler

Plan §3/K2, §2.1, §4.7, §5/Faz 2; inceleme raporu R04 ve R15.

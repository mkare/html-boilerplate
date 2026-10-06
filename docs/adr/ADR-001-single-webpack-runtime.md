# ADR-001 — Tek Webpack runtime chunk’ı

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Çoklu HTML entry’leri `optimization.runtimeChunk: 'single'` kullanır. Ortak shell ve sayfa entry’leri aynı stateful modülleri kullanıyorsa tek runtime üzerinden yüklenir.

## Bağlam ve kanıt

Shell ve sayfa entry’lerinin aynı controller/store modülünü ayrı runtime’larda çalıştırması, modül seviyesindeki singleton ve `WeakMap` korumalarını ikiye bölebilir. İnceleme deneyi kurulu Webpack/Pug Plugin ile varsayılan runtime’da `shared.js` modülünü iki kez değerlendirmiş ve iki kez mount etmiştir; `runtimeChunk: 'single'` tek değerlendirme ve mount vermiştir. Kabul kontrolü gerçek iki-entry çıktısını ve HTML’deki script sırasını kapsar.

## Değerlendirilen seçenekler

- **`runtimeChunk: 'single'` — seçildi.** Çoklu entry mimarisini korur ve paylaşılan modül kimliğini tek runtime’da tutar. Her HTML belgesine runtime asset’i eklenir; bu asset’in doğru sırada yüklendiği plugin çıktısında doğrulanmalıdır.
- **Shell ve sayfa kodunu tek page entry’de birleştirmek — seçilmedi.** Runtime çoğalmasını engelleyebilir; ancak her sayfada entry üretim sorumluluğunu ve mevcut Pug Plugin akışını yeniden kurmayı gerektirir.

## Sonuçlar

Runtime yapılandırması sayfa başına tek instance garantisinin parçasıdır; yalnızca tek bundle içindeki tekrar-mount testi yeterli sayılmaz. Controller’ların hangi root’u başlattığı ayrıca açıkça sahiplenilir. Build değişikliği Faz 1’de uygulanır; burada kayıt altına alınan karar kodun hâlihazırda değiştiği anlamına gelmez.

## İzler

Plan §3/K1, §4.6, §4.8; inceleme raporu R01; Faz 1 iş kartı 4 ve kabul matrisi “Runtime”.

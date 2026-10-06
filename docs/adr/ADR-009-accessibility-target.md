# ADR-009 — Erişilebilirlik hedefi

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Framework’ün açık erişilebilirlik hedefi WCAG 2.2 AA’dır. Etkileşimli hedefler için 44×44 CSS px proje tasarım hedefi kullanılır. Bu ADR mevcut sayfaların uyumlu olduğunu beyan etmez.

## Bağlam ve kanıt

Semantik HTML, klavye/focus davranışı, no-JS temel içerik ve çoklu component instance’ı tasarım sözleşmesinin parçasıdır. Sadece otomatik tarama tüm ölçütleri kanıtlamaz; plan klavye/focus, örnek ekran okuyucu notu ve otomatik kontrolleri birlikte tarif eder. 44×44 px proje hedefi, WCAG hedefiyle birlikte ayrı tasarım eşiğidir.

## Değerlendirilen seçenekler

- **WCAG 2.2 AA + proje boyut hedefi — seçildi.** Açık kabul seviyesi verir ve planın güncel gereksinimlerini kapsar.
- **“Erişilebilirlik best practice” gibi ölçülemeyen ifade — seçilmedi.** Faz kabulü için test edilebilir hedef bırakmaz.
- **Otomatik taramayı tek kanıt yapmak — seçilmedi.** Klavye/focus ve içerik alternatifleri gibi davranışları tek başına kapsamaz.

## Sonuçlar

Kabul matrisi otomatik tarama, klavye/focus ve temsilî ekran okuyucu notunu birleştirir. Anlamlı görsel alternatifi, non-text contrast, %200 metin büyütme, 320 CSS px reflow ve auth’ta parola yöneticisi/yapıştırma desteği ayrıca kontrol edilir. Faz 1–3 kontrolleri kurar; sonraki demo kapsamı genişletir.

## İzler

Plan §3/K9, §4.6, §4.9–4.10, §5 ve §7; inceleme raporu R10.

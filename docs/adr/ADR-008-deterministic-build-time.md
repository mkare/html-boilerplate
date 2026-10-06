# ADR-008 — Deterministik build zamanı

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Koleksiyonları ve tarih tabanlı içerik görünürlüğünü üreten her build açık `buildNow` girdisi alır. Değer UTC ISO-8601 biçimindedir. Reproducibility kontrolü sabit `buildNow` kullanır; ileri tarihli içerik, zamanı geçtiğinde görünmesi için yeniden build ister.

## Bağlam ve kanıt

Derleme anındaki makine saati koleksiyon sırasını, yayınlanma filtresini, HTML’yi ve checksum’ları etkiler. Aynı kaynak, lockfile ve profil farklı günlerde farklı çıktı üretirse build tekrarlanabilirliği kanıtlanamaz. Zaman dilimi farkları da yerel tarih eşiklerinde farklı içerik seçimine yol açabilir.

## Değerlendirilen seçenekler

- **Açık UTC `buildNow` parametresi — seçildi.** Build girdisi görünür ve sabitlenebilir; yerel saat ortamına bağlı değildir.
- **Sistem saatini gizlice okumak — seçilmedi.** Çıktıda açıklanmayan değişken oluşturur.
- **İleri tarihli içeriği runtime’da açmak — seçilmedi.** Statik HTML’nin build-time yayın modelini ve crawler görünürlüğünü bulanıklaştırır.

## Sonuçlar

Build metadata’sı ve raporlar kullanılan zamanı kaydeder. Aynı kaynak + lockfile + profil + `buildNow` aynı checksum’ları vermelidir. Editör yayın zamanını geçtiğinde yeniden derleme ve dağıtım gerekir; bu sınır içerik rehberlerinde açıklanır.

## İzler

Plan §3/K8, §4.4 ve §4.10; inceleme raporu R09; Faz 1 reproducibility kabulü.

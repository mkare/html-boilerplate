# Framework oturum bağlamı

Bu belge devam oturumları için okuma ve iş paylaşımı sözleşmesidir. Kapsamı [plan](../MULTIPURPOSE_THEME_FRAMEWORK_PLANI.md), uygulanan iş ve kanıtı [durum defteri](../FRAMEWORK_IMPLEMENTATION_STATUS.md) belirler. Bir tarihte alınmış başarılı sonuç, daha sonra değişen kaynak ağacının tekrar doğrulandığını göstermez.

## Başlangıç ve kademeli okuma

Çalışma dizini: `/Users/solvia/Documents/cowork/html-boilerplate`. Önce `git status --short`, varsa uygulanan `AGENTS.md` talimatları ve durum defterinin son sürümünü oku. Sonra yalnız atanmış işin plan bölümlerini ve ilgili ADR/sözleşmelerini aç. Dosya bulmak için `rg --files`, hedef davranışı bulmak için dar `rg` sorguları kullan; bütün planı veya repository'yi her agent'a tekrar yükleme.

Node yolu: `/Users/solvia/.nvm/versions/node/v22.23.2/bin`. Komutlarda bu yolu `PATH` başına ekle. Proje Node 22.23.2 ve Yarn Classic 1.22.22 kullanır; `.nvmrc`, `package.json` ve ADR-007 değişmedikçe bunları koru.

| İş | Önce okunacak plan/sözleşme |
| --- | --- |
| Tarayıcı, görsel ve erişilebilirlik kabulü | Plan §4.10, §5 Faz 2/3/5/6 kabulü ve §7; ADR-009/010; `phase-2/layout-runtime-contract.md`; `../style-ownership.md` |
| Release ve temiz kurulum | Plan §5 Faz 6, §7 Release, §9 ve §11; ADR-005/007/008; `../guides/release-and-hosting.md`; `../release/README.md` |
| Kaynak kalite tooling'i | Plan §4.11/§5 Faz 6/§7; package.json/yarn.lock; mimari import checker; prompt 4 |
| Gerçek yerelleştirme | Plan §4.10, §5 iş 5.5 ve §7; ADR-010; `phase-5/profiles-and-routes.md`; ilgili içerik kayıtları |
| Orkestratörün devamı | Durum defteri; plan §5/7/9/11; ihtiyaç duyulan ADR; ilgili lane'in son handoff'u |

## Sahiplik ve build sırası

- Orkestratör kaynak değişikliklerini, merkezi durum defterini ve final entegrasyon kararını sahiplenir. Bir agent yalnız kendisine yazılı olarak atanmış path'leri değiştirir. Atanmamış kaynak kusurlarını path/selector/tekrar adımlarıyla orkestratöre teslim eder.
- Agent'ın kendi yeni kanıt alanı `qa/framework-acceptance/<benzersiz-oturum-id>/` olabilir. Mevcut başka agent kanıtlarını veya merkezi raporları üzerine yazmaz. Geçici kaynak/build/profile/cache alanları `/private/tmp/` altında kendine ait benzersiz dizinde tutulur.
- Gerçek çalışma ağacında `dist/`, `.generated/`, build/watch/preview profilleri ortak kaynaktır. `yarn ci:build`, watcher ve profil testleri dahil bu çıktıları değiştiren komutların aynı anda **tek build sahibi** vardır. Aktif sahibi ve komutunu orkestratörün güncel handoff'undan doğrula; sahiplik devri verilmeden ortak build veya preview yeniden başlatma. Canlı ekip varsa sahibine haber ver; bağımsız oturumda sahipliği doğrulayamıyorsan izole snapshot üzerinde ilerle.
- İzole snapshot build'i yalnız kendi çıktısını/cache'ini değiştirir. Snapshot'ın kopyalandığı kaynak sürümünü, girdilerini ve hash'lerini kaydet. Bu sonuç sonradan değişen gerçek çalışma ağacının entegrasyon sonucu değildir.
- Agent kaynak düzeltmesinden sonra mevcut dar kontrolü çalıştırır; final ortak `ci:build` orkestratör tarafından sıraya alınır. Başarılı kontrolleri yeni değişiklik veya çözülmemiş şüphe yokken tekrar çalıştırma.

## Korunacak çalışma ve kanıt sınırları

Çalışma ağacı işe başlanmadan önce staged, modified ve untracked dosyalar içeriyordu. Reset, clean, rebase, stage, commit ve tag yapma; lockfile silme. Diğer oturumun dosya güncellemesini fark edersen son sürümü tekrar oku, yalnız sahip olduğun değişikliği uygula. `.generated/`, `dist/` ve release çıktısını elle düzeltme.

Faz 1–6 uygulamaları, §4.11 source-quality, §4.8.9 sprite/responsive-image pipeline, full CI/release, 12/12 commerce, current frozen install + SaaS/Agency builds ve transition-aware Chrome 154 örneği durum defterinde kayıtlıdır; bunları yeniden uygulama görevi sayma. Sharp'lı `yarn install --frozen-lockfile` bağımsız snapshot'ta geçti; SaaS customer 21 HTML/36 files ve Agency CLI 9 HTML/22 files kabul edildi. Sadece dependency/lockfile değişince frozen install'i tekrar et. §4.8.9 generator, opt-in manifest, `<picture>` mixin, Webpack asset emitter, namespaced sprite ve nonshipping fixtures tamamlandı. Manifest boş, çünkü provenance/lisansı temiz raster demo girdisi yok; prompt 5 sadece gerçek görsel sağlandığında kullanılır. 18 gözlemli post-fix browser sample ayrı report/screenshots ile kayıtlıdır: 1440/640/320 CSS px örnekleri geçti; 160 CSS px/DPR2 proxy'de SaaS/Commerce overflow ve Commerce'te bir 44 px target istisnası var. Bu 200% browser zoom değildir. 42-gözlemli historical baseline Markdown clipping/tema kusurlarını bulmuştu; yeni sample tüm visual/a11y matrisi değildir. Gerçek %200 browser metin büyütme, screen reader, strict native-dialog Tab wrap, kapsamlı interaktif contrast/target review, çeviri/hreflang, gerçek raster source, field performance ve tarihsel baseline açık kalır. Gözlemediğin şeyi “geçti” sayma; sonucu exit code ve source snapshot ile kaydet.

Temiz tarihsel Faz 0 baseline/tag'i miras alınan kirli ağaçtan geriye dönük üretilemez. Bugünkü ağacın tarihli snapshot'ı veya yeni regresyon ölçümü yararlı olabilir; bunu eski baseline diye adlandırma. `package-lock.json` kaldırılması ADR-007 uyarınca ayrı izlenebilir değişikliktir ve mevcut no-stage/no-commit sınırında ertelenmiştir.

Gerçek çevrilmiş sayfa instance'ları mevcut değildir. Gerçek yerelleştirme kabulü için sağlanan içerik gerekir. Yayınlanmayan, açıkça etiketlenmiş QA fixture'ı route/lang/dir/hreflang veya uzun metin/RTL yapısını sınayabilir; bu gerçek çeviri veya gerçek yerelleştirme geçişi sayılmaz. Gzip bütçeleri LCP/INP/CLS saha ölçümü değildir.

Kullanıcının zaten istediği yerel, geri alınabilir uygulama/doğrulama işini rutin onay sorularıyla durdurma. Gerekli bilgi veya gerçek yetki eksikse bağımsız işe devam ederken tam eksik girdiyi bildir. Sandbox escalation gerekiyorsa tool'un kendi izin yolunu kullan; onay engelini aşmak için başka tool seçme. Yayınlama, dışarı mesaj gönderme veya üretime telemetry ekleme bu devam promptlarıyla yetkilendirilmez.

## Handoff ve compaction checkpoint

Her lane sonunda ve context compaction öncesinde kendi kanıt alanında `HANDOFF.md` veya `CHECKPOINT.md` bırak:

```text
Lane / oturum-id:
Amaç ve plan ölçütü:
Sahip olunan path'ler / aktif build sahibi:
Kaynak snapshot'ı ve değişen path'ler:
Doğrulanan: exact command/tool, cwd, sürüm, girdiler, exit code, kanıt path'i:
Başarısız: tekrar adımları, beklenen/gerçek, sahip kaynak:
Çalıştırılmayan / bilgiye bağlı: neden ve gerekli en küçük girdi:
Çalışan process/preview: yalnız kendi PID/port/profile ve stop yöntemi:
Sıradaki tek eylem / bağımlılığı:
```

Devam ederken checkpoint'i, güncel durum defterini ve `git status --short` sonucunu yeniden oku; dosya veya build sahipliği değişmişse eski varsayımı bırak. Tamamlanmış lane'i baştan başlatma. Final handoff “geçti / başarısız / çalıştırılmadı / girdiye bağlı” ayrımını korur.

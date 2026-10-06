# Framework devam oturumu promptları

Kapsamın kaynağı [uygulama planı](./MULTIPURPOSE_THEME_FRAMEWORK_PLANI.md), son kanıtın kaynağı [durum defteri](./FRAMEWORK_IMPLEMENTATION_STATUS.md). Bu promptlar Faz 1–6 uygulamasını baştan yaptırmaz; kalan kabul işlerini ve yeni oturumda orkestrasyonun devamını tarif eder. Aktif ekip aynı lane üzerinde çalışıyorsa aynı promptla ikinci oturum açma; önce mevcut handoff'u bekle.

Prompt yapısı rol, net sonuç, gerekli bağlam ve ölçülebilir teslimi ayırır; yalnız ilgili belgeleri kademeli yükler. Bu seçimler [official OpenAI documentation: Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering), [progressive disclosure guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) ve [durable project memory](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) önerilerinden yararlanır. Bunlar ek repository gereksinimleri veya model değiştirme talimatı değildir.

## Hangi prompt ne zaman kullanılır?

| Prompt | Gerçek kalan iş / bağımlılık |
| --- | --- |
| 1 — Tarayıcı, erişilebilirlik ve görsel kabul | Gerçek %200 metin büyütme, ekran okuyucu, strict dialog Tab wrap, parola yöneticisi/clipboard ve daha geniş non-text/state kontrast-hedef istisna incelemesi; gerçek çeviri/RTL girdisi geldiğinde uzun içerik |
| 2 — İzole temiz kurulum | Kurulum kanıtı geçti; yalnız lockfile/dependency alanları değiştiğinde tekrar kurulum. Source-package/CLI değişikliği için dar build/smoke kontrolü yeterlidir |
| 3 — Orkestratör devamı | Bu oturum compaction/session sınırına ulaştığında; kanıtları birleştirme, kusur düzeltme ve final entegrasyon |
| 4 — Kaynak kalite tooling'i | **Tamamlandı ve kapatıldı.** §4.11 lint/format kontrolleri ve CI entegrasyonu geçti; aşağıdaki kayıt tekrar uygulanacak görev değildir |
| 5 — Sağlanan raster görseli bağlama (koşullu) | Yalnız lisans/provenansı belli gerçek raster demo içeriği sağlandığında; ortak hat ve sprite tamamlandı |

Plan §4.8.9'in uygulama hattı tamamlandı: namespaced external SVG sprite, Sharp tabanlı AVIF/WebP/fallback generator, responsive `<picture>` component, opt-in manifest, Webpack emission ve fixture/release coverage. Raster manifest boş; gerçek demo görseli lisans/provenans girdisi olmadan üretilmez. Prompt 5 yalnız böyle bir içerik sağlandığında kullan. Prompt 4'teki §4.11 lint/format tooling'i, fixture kontrolleri ve CI bağlantısı uygulanıp son CI'da geçmiştir; bunu tekrar uygulama. Gerçek çevrilmiş instance kabulü içerik, saha LCP/INP/CLS kabulü gerçek ölçüm verisi bekler. Tarihsel temiz baseline/tag ve lockfile kaldırılması mevcut no-stage/no-commit sınırında ertelenmiştir; bunları tamamlanmış veya bugünkü snapshot ile yeniden üretilmiş sayma. İçerik/veri gelmeden yalnız bu işler için yeni uygulama oturumu açmak gerekmez.

## 1 — Tarayıcı, erişilebilirlik ve görsel kabul

Aşağıdaki bloğu yeni oturuma olduğu gibi ver. Çalışan browser acceptance agent'ı varsa bu promptu yalnız onun handoff'undan sonra kullan.

```text
ROL VE SONUÇ
Multipurpose HTML framework'ün kalan tarayıcı, görsel ve erişilebilirlik kabulünü sahiplen. Sonuç; ölçülmüş kabul tablosu, tekrar edilebilir kusurlar ve açık kalan kontrol listesidir. Mevcut uygulamayı baştan kurma veya yeniden tasarlama.

ÇALIŞMA DİZİNİ VE OKUMA SIRASI
/Users/solvia/Documents/cowork/html-boilerplate
1. git status --short, varsa geçerli AGENTS.md ve docs/FRAMEWORK_IMPLEMENTATION_STATUS.md'nin güncel sürümü.
2. docs/architecture/framework-session-context.md: sahiplik/build sırası, kanıt sınırı ve checkpoint formatı.
3. Plan docs/MULTIPURPOSE_THEME_FRAMEWORK_PLANI.md: §4.10, §5 Faz 2/3/5/6 kabulü ve §7 görsel/erişilebilirlik matrisi.
4. docs/adr/ADR-009-accessibility-target.md, ADR-010-locale-and-route-prefixes.md; docs/guides/browser-support.md; docs/architecture/phase-2/layout-runtime-contract.md. Sonra sadece ilgili sayfa/component kaynaklarını aç.

BİLİNEN VE BİLİNMEYEN
- Önceki focused customer-build Chrome 154.0.8037.95 kontrolü dokuz rota × 320/768/1440 CSS px, tema, menü/dialog, JS-off pagination, quantity-2 cart persistence ve storage-denial akışlarını kaydeder; bu tarihsel sonuçtur.
- Historical catalog-preview baseline Chrome 154.0.8037.98 ile yedi rota × üç width × light/dark = 42 gözlem yaptı ve Markdown clipping gibi kusurları kaydetti. Sonraki 18-state transition-aware ve ilk 54 gözlemli matris de tarihsel kusur bulgularını korur.
- Önceki 54 gözlemli rapor `browser-verified/` altındadır ve tarihsel Chrome 154.0.8037.98 çalışmasıdır. Güncel [remediated visual report](../qa/framework-status-2026-10-06/browser-remediated/visual-report.json), Playwright 1.63.0 managed Chromium 153.0.8010.12 ile aynı 54 gözlemi yaptı: sıfır yatay taşma, ölçülen kontrast sorunu, 24×24 altı hedef veya 44×44 proje hedefi altı kontrol; sıfır runtime/harici/GET dışı istek. 36 catalog snippet assertion'ı, tema geçişi ve auth fallback'leri geçti. Axe 52 preview rotasını light/dark taradı (104 scan): sıfır violation ve tarama/navigasyon hatası, 144 incomplete/manual-review item. Bu tam route/state veya WCAG AA kanıtı değildir. Gerçek browser 200% text zoom, screen reader, strict dialog Tab wrap ve clipboard/password-manager davranışı hâlâ doğrulanmamıştır.
- Güncel [Axe entegre final CI özeti](../qa/framework-status-2026-10-06/integration/ci-build-axe-integrated-final.md) `yarn ci:build` exit 0 sonucunu, 104 taramayı, SaaS production restore kontrolünü ve tekrarlanabilirlik/archive hash'lerini kaydeder. Bu dosya ham terminal kaydı değil, tamamlanan çıktının dayanıklı özetidir.
- §4.11 source-quality checks, responsive asset fixture'ları ve full `ci:build`, extracted SaaS root/subpath ile Agency release checks güncel implementation snapshot'ında geçti. Yeni frozen install de Sharp dependency'siyle SaaS ve Agency build'lerini doğruladı. Exact komut/hash ve source-snapshot sınırları ledger'dadır. Aynı snapshot'ta gereksiz yere tekrarlama.
- Otomatik markup + accessibility tree, gerçek ekran okuyucu davranışı veya WCAG 2.2 AA uygunluk kanıtı değildir. Tarihsel Commerce disabled-pagination contrast ve target-size kusurları giderildi; güncel 54-state matriste ölçülen kusur kalmadı. Tarayıcı örneklemi tam conformance değildir.
- Gerçek çevrilmiş instance yok. QA fixture'ı gerçek yerelleştirme kabulü sayılmaz. Gzip bütçeleri saha performansı sayılmaz.

PATH SAHİPLİĞİ VE BUILD
Yalnız kendi yeni qa/framework-acceptance/<benzersiz-oturum-id>/ kanıt dizinini ve kendine ait /private/tmp/ dizinini yaz. Kaynak kodunu, merkezi durum defterini veya başka agent'ın raporunu değiştirme; kusurları owning path ile orkestratöre teslim et. Kaynak düzeltme görevi ayrıca verilirse yalnız belirtilen path'leri değiştir.
Gerçek worktree'de dist/.generated/build/watch/preview tek sahibin kontrolündedir. Aktif sahibini orkestratör handoff'undan doğrulamadan ortak build başlatma. Sahipliği doğrulayamıyorsan kendi snapshot'ında build yap ve snapshot bilgisini kaydet. Kullanıcının tarayıcı profilini veya kalıcı tercihlerini değiştirmeyen ayrı bir tarayıcı yüzeyi kullan.
Node 22.23.2/Yarn 1.22.22; shell PATH başına /Users/solvia/.nvm/versions/node/v22.23.2/bin ekle.

İŞ
1. Preview profilini ve manifestteki gerçek route'ları doğrula. Catalog-preview'de /demos/saas/, /demos/agency/, /demos/saas/sign-in/, /commerce/catalog/, /markdown/, /components/ ve /dashboard/ temsili başlangıç setidir. Customer build demo mount'unu kaldırır; route'ları tahmin etme.
2. SaaS ve Agency ana sayfa + en az bir iç sayfayı light/dark × 320/768/1440 CSS px ile karşılaştır. Diğer layout ailelerinde en az bir temsilî sayfayı kontrol et. Görselde tipografi, Bootstrap utility köprüsü, focus, bileşen state'leri, kesilme/örtüşme ve içeriğin görünürlüğünü kaydet. Scheme/viewport/route'u screenshot adında belirt.
3. Gerçek tarayıcı %200 metin büyütme/zoom ayarını uygula ve uygulanan değeri doğrula. CSS transform/font-size injection veya yalnız viewport küçültmeyi bunun yerine sayma. Reflow, bilgi kaybı, clipping, overlap ve klavye erişimini gözle; tarayıcı zoom'u ile CSS viewport ölçüsünü ayrı kaydet. Ayar tool ile yapılamıyorsa bu kontrolü çalıştırılmadı say, kalan bağımsız kontrollere devam et.
4. Ekran okuyucu varsa isim/sürümünü kaydet. Landmark/heading gezinmesi, mobil menü state'i, auth label/hata-öneri ve pending/demo mesajları, dialog adı/açılış-kapanış/return focus, toast/cart/storage denial duyurusunu dinle. Native dialog için son/ilk kontrolden Tab/Shift+Tab wrap'ını ayrıca doğrula; baseline'daki geçici body activeElement gözlemi strict wrap kanıtı değildir. Beklenen/gerçek konuşmayı kısa örnekle yaz. Accessibility tree dump'ını dinleme yerine sayma. Parola alanlarında autocomplete bilgisi, dummy metin yapıştırma ve sağlanabiliyorsa ayrı test profiliyle parola yöneticisi davranışını kontrol et; gerçek kimlik bilgisi kullanma.
5. Light/dark altında temsilî body/muted/link/button/error metinleri, sınırlar ve focus göstergelerinde selector, gerçek foreground/background ve hesaplanan kontrast oranını kaydet. Alpha/gradient varsa görünen arka planı hesaba kat. Planın 3:1 non-text contrast gereksinimi ve ADR-009'un 44×44 CSS px proje hedefi için kontrollerin bounding-box ölçüsünü raporla; spot-check sonucundan tüm sayfaya WCAG uygunluk beyanı üretme.
6. Uzun gerçek metin varsa bunu kullan. Yoksa yayımlanmayan izole fixture'da mevcut metni uzatarak ve dir=rtl uygulayarak layout yapısını sınayabilirsin: ikon, breadcrumb, tablo, sidebar, drawer ve focus sırası. Fixture kullanımını açıkça etiketle; bunu gerçek RTL dili/çeviri/hreflang testi sayma. Gerçek locale instance kabulünü içerik girdisine bağlı bırak.
7. Kusuru tekrar üret, screenshot/ölçüm ve en küçük owning source path'i kaydet. Başarılı önceki commerce/CI testlerini yeni kusur veya kaynak değişikliği gerektirmedikçe baştan çalıştırma. Kalan bağımsız işi bitir.

SINIRLAR VE KABUL
Reset/clean/rebase/stage/commit/tag, lockfile silme ve üretilmiş çıktıları elle düzeltme yok. Tüm staged/modified/untracked çalışmayı koru. Rutin yerel kontroller için tekrar onay isteme; eksik tool/içerik/gerçek yetkiyi tam adıyla bildir. Yayınlama veya dışarı mesaj gönderme yok.
Her planlanan kontrol için geçti / başarısız / çalıştırılmadı / girdiye bağlı sonucu bulunmalı. Hata yoksa bunu yalnız gerçekten gözlenen scope için söyle. Browser/version, snapshot/profile/URL, viewport, scheme, zoom, input/screen reader, selector/ölçüm ve kanıt path'i olmadan ölçülmüş pass yazma.

TESLİM VE DEVAM
Kendi kanıt dizinine HANDOFF.md yaz: kapsam tablosu; changed paths; exact commands/tools/cwd/sürümler/exit code; kusur tekrarları ve source sahibi; çalıştırılmayan kontroller/gerekli girdiler; root'a entegrasyon isteği. Context dolmadan aynı dizine CHECKPOINT.md bırak; sıradaki tek eylemi ve kendi process/port bilgini yaz. Devamda checkpoint + güncel ledger + git status oku; tamamlanmış lane'i yeniden başlatma. Finalde kaynak dosyası değişip değişmediğini açıkça söyle.
```

## 2 — İzole temiz kurulum kabulü (koşullu)

Güncel `sharp@0.35.5` dâhil frozen-lockfile kurulumu, SaaS build/dist ve literal `yarn build:demo agency`/dist/profile yeni izole snapshot'ta geçti. SaaS 22 HTML/39 dosya, Agency 10 HTML/25 dosya üretti. Kanıt ve lockfile hash'leri: [son temiz kurulum raporu](../qa/framework-status-2026-10-06/integration/clean-install-final.md). Dependency/lockfile değişmedikçe kurulumu tekrar etme. Sonraki script/source-package değişikliklerini kendi mevcut temiz fixture'ında dar build/smoke ile doğrula.

```text
ROL VE SONUÇ
Faz 6'nın temiz kurulumdan build ve release source kullanılabilirliği kabulünü doğrula. Mevcut dependency ağacını kopyalamadan/symlink etmeden izole kurulum kanıtı üret. Tarihsel Faz 0 baseline'ını yeniden üretmeye çalışma.

ÇALIŞMA DİZİNİ VE OKUMA SIRASI
/Users/solvia/Documents/cowork/html-boilerplate
1. git status --short; varsa geçerli AGENTS.md; güncel docs/FRAMEWORK_IMPLEMENTATION_STATUS.md ve aktif integration handoff'u.
2. docs/architecture/framework-session-context.md.
3. Plan §5 Faz 6 kabulü, §7 Release/Build, §9, §11; ADR-005/007/008; docs/guides/release-and-hosting.md ve docs/release/README.md.
4. package.json, scripts/package-release.cjs, qa/release/smoke-extracted.cjs: yalnız packaging, source copy ve komut sınırları.

SAHİPLİK VE DURUM
Node 22.23.2/Yarn 1.22.22; PATH başına /Users/solvia/.nvm/versions/node/v22.23.2/bin ekle. Yalnız kendi /private/tmp/ fixture/cache/build ve yeni qa/framework-acceptance/clean-install-<oturum-id>/ artefaktlarını yaz. Kaynak/package/lockfile/durum defteri değişikliği yapma; kusurları root'a teslim et.
Güncel clean-install-final.md Sharp'lı frozen install, SaaS 22 HTML/39 files ve Agency CLI 10 HTML/25 files pass'ini kaydeder. Dependency/lockfile değişmediyse bu kurulum kanıtını kullan. Yalnız docs/script değişimi yeni clean install gerektirmez. Ortak dist/.generated mutasyonunu root'un build sahipliği devri olmadan başlatma. Mevcut arşiv güncel kaynağa ait değilse kendi geçici snapshot'ından izole paket üret; source snapshot/hash ve sabit build girdilerini kaydet.

İŞ
1. Önce clean-install-report ve mevcut dependency/lockfile hash'lerini karşılaştır. Değişiklik yoksa install adımını atla; yalnız sonraki source/package/CLI değişikliğine ait dar kontrolü yap. Release source kabulü için güncel arşivi benzersiz geçici dizine çıkar. Önce checksums/manifest'i doğrula. source/ içinde node_modules yok, dışarı symlink yok ve yarn.lock mevcut olduğunu kaydet; sadece bugünkü tree snapshot'ı olduğunu belirt.
2. Yalnız dependency/lockfile değiştiğinde source/ cwd'sinde bağımsız cache ile yarn install --frozen-lockfile --non-interactive çalıştır. İndirmenin sandbox/ağ nedeniyle reddedilmesi halinde tool'un gerekli escalation yolunu kullan; ret durumunu gizleme ve mevcut node_modules'u kopyalayıp fresh install sayma. Token/ortam gizlisi loglama.
3. Sabit BUILD_NOW=2026-10-03T12:00:00.000Z ve aynı demo/siteUrl/basePath girdileriyle source/ üzerinden build yap; advertised package scripts'in yerel dosya hedefleri bulunabiliyor mu incele. Temiz kurulum ölçütünü yarn install + build exit code ile ayrı raporla.
4. Source paketi gerekli QA dosyalarını içeriyorsa ilgili mevcut build/link/reproducibility kontrolünü çalıştır. Eksik advertised komut varsa root'a path ve exact error ile bildir. Tüm kaynak ağacının ci:build'i source paketi içeriği kontrol edilmeden çalışacak diye varsayma.
5. İki build'in checksum'larını karşılaştır; arşivin html/ çıktısıyla karşılaştırmayı yalnız aynı profile/demo/locale/basePath/siteUrl/buildNow ve aynı girdilerle yap. Karşılaştırma kapsamını açık yaz. Root/subpath için başka lane'in yeni kanıtı varsa kullan; eksikse kendi fixture'ında narrow smoke yap.

KABUL, SINIR VE TESLİM
Fresh install/build/repeatability sonuçları ayrı pass/fail olmalı. Her sonucun cwd, kaynak/arşiv/hash, Node/Yarn, girdiler, exact command, exit code ve log path'i bulunmalı. Shared worktree'ye reset/clean/stage/commit/tag veya lockfile silme yok; mevcut baseline dosyasını bir farkı gizlemek için güncelleme yok.
HANDOFF.md: değişen yollar (artefakt dahil), sonuç tablosu, dependency/advertised-command kusurları, unknowns, root'a gerekli source fix. Compaction öncesi CHECKPOINT.md: tamamlanan kontroller, aktif kendi process/cache/fixture, sıradaki tek eylem. Devamda ledger/git status/build sahipliğini yeniden doğrula. Çalışan paralel lane'in sonucunu üzerine yazma.
```

## 3 — Orkestratör devamı

Bu bloğu yeni ana oturuma ver. Yeni oturum, önce canlı ekip ve dosya durumunu kontrol eder; eski planı tekrar görev dağıtımına çevirmez.

```text
ROL VE SONUÇ
Multipurpose HTML framework planının orkestratörüsün. Kullanıcı planın tamamını uygulamayı ve işi agent'lara bölmeyi zaten istedi. Mevcut işi devam ettir; kalan gerçek kusurları ve kabul boşluklarını kapat, kanıtlı durum bildir. Tamamlanan Faz 1–6 kodunu yeniden yaptırma. Rutin geri alınabilir işler için tekrar onay isteme.

ÇALIŞMA DİZİNİ VE OKUMA SIRASI
/Users/solvia/Documents/cowork/html-boilerplate
1. git status --short; varsa geçerli AGENTS.md; docs/FRAMEWORK_IMPLEMENTATION_STATUS.md'nin son sürümü.
2. docs/architecture/framework-session-context.md ve canlı agent'ların son mesaj/HANDOFF/CHECKPOINT dosyaları. Aktif agent/process/build sahibini belirle.
3. Plan docs/MULTIPURPOSE_THEME_FRAMEWORK_PLANI.md §5, §7, §9 ve §11; ihtiyaç duyulan açık ölçütün ADR/sözleşmesini sonra aç. Bütün repo veya planı her agent'a kopyalama.
4. Son integration/browser loglarının bitişi, exact source snapshot ve exit code; yeni kaynak değişikliği varsa hangi kanıtı eskittiğini belirle.

KAYITLI DURUM VE AÇIK İŞ
Durum defteri Faz 1–6 uygulamasını, source-quality checks'i, §4.8.9 asset pipeline + fixture'larını, Commerce 13/13 sonucunu ve current frozen install/demo build'lerini kaydediyor. Browser-remediated 54-state Chrome matrix, 36 catalog snippet parity assertion'ı, password toggle ve no-JS/script/storage auth fallback'leri geçti; Axe CI kapısı da 104 route/scheme scan'de sıfır violation ve SaaS production restore ile geçti. Bu kaynak snapshot'ında final integration tamamlandı; [son CI özeti](../qa/framework-status-2026-10-06/integration/ci-build-axe-integrated-final.md) ve ledger'daki sınırları oku, başarılı zinciri tekrar çalıştırma. Plan kapsamından çıkılan veya çalıştırılmayan ölçütü açık bırak.
Gerçek %200 browser metin büyütme, screen reader, kontrast/hedef boyutu, iki marka light/dark, uzun copy/RTL ve gerçek çevrilmiş instance kabulünü ayrı takip et. Gerçek çeviri içeriği yok; nonshipping QA fixture yapısal kanıt olabilir. Saha LCP/INP/CLS için gerçek veri yoksa kaynak erişimi/yayın/ölçüm dönemi ihtiyacını yaz; build-size veya laboratory ölçümünü field p75 diye sunma.
Tarihsel clean baseline/tag bugünkü kirli ağaçtan üretilemez. Bugünkü snapshot'ı açıkça bugünkü olarak kaydet. package-lock.json kaldırılması ADR-007'nin ayrı izlenebilir commit işidir; mevcut no-stage/no-commit sınırında ertelenmiştir.
Current clean-install-final.md'de Sharp'lı frozen kurulum/SaaS build ve literal `build:demo agency` PASS var; kurulum yalnız dependency/lockfile değişince tekrar edilir. Build:demo alias, font customization/browser policy, source QA/docs, responsive asset pipeline ve extracted-package/release CI kontrolleri uygulandı. §4.11 ve §4.8.9 uygulama lane'lerini tamamlandı say; kanıtlı işi yeniden atama. Açık olanlar gerçek kaynak görseli, manuel erişilebilirlik/zoom, çeviri girdileri, field performance verisi ve tarihsel baseline sınırıdır.

SAHİPLİK VE YÜRÜTME
Kaynak düzeltmelerini ve docs/FRAMEWORK_IMPLEMENTATION_STATUS.md'yi sen sahiplen. Agent'a tek bounded outcome, explicit paths, bağlı olduğu interface/build çıktısı, acceptance ve handoff formatı ver. Disjoint lanes'i paralelleştir; shared source veya dist/.generated/watch/ci:build için tek aktif sahibi belirle ve yazılı handoff ile devret.
Aktif integration/browser/context agent'ı varsa onun sonucunu al; aynı iş için kullanıcıya gereksiz yeni session açtırma. Context yetmezse tamamlanan/gerekli/bekleyen işi kendi CHECKPOINT.md ile yeni oturuma taşı. Agent'ın önemli kusuru için en küçük kaynak değişikliğini yap, ilgili dar kontrolü çalıştır; son source snapshot için tek final integration zincirini sıraya al. No new change/no unresolved concern varsa başarılı testi tekrar çalıştırma.
Node22.23.2/Yarn1.22.22; PATH başına /Users/solvia/.nvm/versions/node/v22.23.2/bin ekle. İnherited staged/modified/untracked çalışmayı koru; reset/clean/rebase/stage/commit/tag, lockfile silme, üretilmiş çıktıyı elle düzeltme yok. Concurrent file değiştiyse yeniden oku ve kendi diff'ini yeniden uygula.

KABUL VE FINAL HANDOFF
1. Her açık plan ölçütü için uygulandı+kanıtlandı / kusur / çalıştırılmadı / dış girdiye bağlı sonucu bulunmalı.
2. Ledger'a yeni kanıtı exact command/cwd/sürümler/girdiler/exit code/log path'iyle ekle; önceki kanıtı veya sınırları kaybetme. Log devam ederken pass yazma.
3. Kaynak değişikliği sonrası fresh integration sonucu beklenmeli; tamamlandı beyanı build, görsel/a11y, locale veya field ölçütlerinden açık olanları saklamamalı.
4. Kullanıcıya Türkçe kısa son durum: somut tamamlananlar, fresh kontrol sonucu, gerçek kalan işler ve varsa yalnız gereken devam prompt'u. İzin/girdi gerçekten eksikse tam nedeni ve kaynağını söyle; bağımsız işlere devam et. Yayınlama veya dışarı mesaj gönderme yetkisini varsayma.
Compaction/checkpoint: amaç, sahip paths/build sahibi, source snapshot/changed paths, geçen/başarısız/unrun kontroller, canlı kendi PID/port, sıradaki tek eylem, gerekli girdi. Resumption'da checkpoint + canlı agent durumu + ledger + git status'tan devam et.
```

## 4 — Kaynak kalite tooling'i (tamamlandı; kapalı)

Plan §4.11 için pinned lint/format tooling, scoped configurations, check-only scripts, hata yakalayan disposable fixtures ve `ci:build` entegrasyonu uygulanmıştır. Node 22.23.2 / Yarn Classic 1.22.22 ile son `yarn ci:build` exit 0 verdi; Markdown lint 70 dosyada sıfır sorun bildirdi. Exact komut, log ve 2026-10-06 source snapshot sınırı [durum defterinde](./FRAMEWORK_IMPLEMENTATION_STATUS.md); araç kapsamı [guide'da](./guides/source-quality.md). Bu lane kapalıdır; yalnız sonraki tooling/source değişikliği regresyon şüphesi doğurursa ilgili dar kontrolü çalıştır.

## 5 — Sağlanan raster görseli bağlama (koşullu)

Bu prompt yalnız provenance/lisans bilgisiyle gerçek raster demo içeriği sağlandığında kullanılır. Ortak generator, SVG sprite, component, Webpack plugin ve fixture'lar tamamlandı; bunları yeniden yazma. Mevcut tek legacy raster `src/assets/images/cadillac.jpg` kullanım dışı ve provenance'ı belirsizdir, bu nedenle yayınlama.

```text
ROL VE SONUÇ
Sağlanan, lisans/provenansı doğrulanabilir raster görseli mevcut responsive image pipeline'ına bağla. Görseli doğru demo/page manifest girdisine kaydet, AVIF/WebP ve fallback varyantlarını üret, `<picture>` consumer'ını mevcut page'e ekle, root/subpath ve intrinsic size davranışını doğrula. Pipeline'ı veya başka tasarımı baştan kurma. İçerik/lisans bilgisi eksikse uygulama uydurma ve yalnız eksik girdiyi raporla.

DİZİN VE OKUMA
/Users/solvia/Documents/cowork/html-boilerplate
1. git status --short, geçerli AGENTS.md, güncel docs/FRAMEWORK_IMPLEMENTATION_STATUS.md ve sağlanan görselin source/license/provenance bilgisi.
2. docs/architecture/framework-session-context.md; plan §4.8.9 ve §7 asset/performance kabulü; `docs/guides/assets-and-images.md`; ilgili manifest/page/build helper ve release budget.
3. Sadece mevcut pipeline API'sini ve hedef page'i aç: `config/responsive-images.cjs`, `build/assets/responsive-images.cjs`, `src/blocks/media/responsive-picture.pug`, `webpack.config.js` ve page source.

PATH SAHİPLİĞİ VE SINIR
Yalnız sağlanan image file, manifest kaydı, owning page source ve gerekli docs/asset provenance note'larını değiştir. `package.json`, `yarn.lock`, sprite, generator, plugin veya shared styling'i edit etme. Shared dist/.generated build için tek sahip orkestratörün onaylı handoff'uyla belirlenir. Node22.23.2/Yarn1.22.22.

İŞ
1. Sağlanan source'ı checksum/format/size ve verili lisans/provenance ile doğrula; uydurma metadata ekleme.
2. `config/responsive-images.cjs` içine demo/page owner, stable ID, path, widths, sizes ve uygun fallback'i gir; içerik policy'si gerekiyorsa non-hero görselleri lazy, gerçek above-the-fold LCP görselini eager/priority seç.
3. Hedef page'e mevcut `responsivePicture` mixin'ini bağla. Gerçek alt metni, sizes, class ve eager/lazy policy'yi doğru ver. Kaynak atfı gereken lisans ise birinci taraf docs/lisans envanterine kaydet.
4. Owner manifest contract'ı, `yarn check:assets`, build, `check:dist`, release/budget ve gerçek browser `currentSrc`/naturalWidth gözlemlerini çalıştır; candidate seçimini en az iki viewport için kanıtla. İçerik browser'a yüklenmiyorsa sebebi/ortamı yaz.
5. Görsel katkısının bytes/gzip maliyetini mevcut baseline'a karşı raporla; HTML, format, layout veya görsel dili yeniden tasarlama.

KABUL VE TESLİM
Manifest'in üretim girdisi geçer; actual `<picture>` href/srcset candidate'ları, dimensions/alt/priority, root/subpath fetch, browser currentSrc, license/provenance ve release budget doğru. Her sonucu exact source, command, cwd, browser/viewport, bytes ve exit code ile handoff et. Input eksikse branch açma/asset uydurma.
Reset/clean/rebase/stage/commit/tag yok. Compaction öncesi CHECKPOINT.md bırak; devamda ledger/git status/ownership'ü yeniden oku ve tamamlanmış kontrolü baştan başlatma.
```

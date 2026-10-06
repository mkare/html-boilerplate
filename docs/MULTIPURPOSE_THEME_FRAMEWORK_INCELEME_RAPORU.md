# Çok Amaçlı Tema Framework Planı — İnceleme Raporu

**Tarih:** 3 Ekim 2026  
**İncelenen belge:** v1 plan, 1.010 satır ve 21 bölümün tamamı. v1 metni [PLAN_v1_orijinal.md](./reviews/theme-framework-2026-10-03/PLAN_v1_orijinal.md) olarak arşivlendi; bu rapordaki satır ve § referansları o metne aittir. Bulguların işlendiği birleşik plan: [MULTIPURPOSE_THEME_FRAMEWORK_PLANI.md](./MULTIPURPOSE_THEME_FRAMEWORK_PLANI.md) (v2).  
**Yöntem:** Planın iç tutarlılığı, mevcut kaynak kodla karşılaştırma, izole production build, üretilmiş HTML taraması, kurulu Webpack/Pug Plugin ile küçük doğrulama deneyleri ve birincil doküman kontrolü.  
**Makine çıktıları:** [kanitlar.json](./reviews/theme-framework-2026-10-03/kanitlar.json) ve tamamlama turunun ölçümleri [tamamlama-olcumleri.json](./reviews/theme-framework-2026-10-03/tamamlama-olcumleri.json).  
**Durum:** İlk tur R01–R14 ile kesildi. Tamamlama turu (aynı gün, ikinci ortam) ilk turun kod iddialarını yeniden doğruladı, R15–R17’yi ekledi ve §6’daki bölüm bölüm incelemeyi yazdı.

**Karar: Temel mimari korunmalı; aşağıdaki sözleşmeler netleştirildikten sonra dikey pilotla uygulanmalı.** Webpack + Pug + SCSS + saf JavaScript seçimini değiştirmeyi gerektiren bir bulgu yok. Plan; MPA, component sahipliği, gerçek pagination, sepet verisi ve kademeli migration konularını doğru ele alıyor. En önemli risk, bazı araç davranışlarının ve modüller arası sözleşmelerin uygulamacının yorumuna kalması.

Bu raporda **5 P1 ve 12 P2 bulgu/iyileştirme** var. Bunların tamamı mevcut kod hatası değildir: doğrulanan davranış, tasarım riski ve ürün kararı her maddede ayrılmıştır. P1, ilk pilotun ilgili kısmına başlamadan çözülmesi gereken konuyu; P2, ilgili fazın kabulüne eklenmesi gereken iyileştirmeyi ifade eder. İncelemede mimarinin tamamen değiştirilmesini gerektiren bir engel saptanmadı.

## 1. Öncelik özeti

| ID | Öncelik | Konu | Kanıt türü | Ele alınacağı faz |
| --- | --- | --- | --- | --- |
| R01 | P1 | Shell/page entry’leri ortak modülü iki kez başlatabiliyor | Kurulu araçlarla doğrulandı | Faz 1–2 |
| R02 | P1 | Generated wrapper, bileşen içindeki göreli asset yolunu bozabiliyor | Kurulu araçlarla doğrulandı | Faz 1 |
| R03 | P1 | Manifest üretiminin watch ve hata sonrası güncelleme sözleşmesi eksik | Tasarım riski | Faz 1 |
| R04 | P1 | Yeni tema tokenlarıyla korunan Bootstrap stillerinin bağlantısı belirsiz | Kaynak/çıktı + doküman | Faz 2 |
| R05 | P1 | Demo auth formunun JS çalışmadığında güvenli davranışı tanımlanmamış | Kaynak + hata enjeksiyonu | Faz 2–3 |
| R06 | P2 | `config/browserslist` varsayılan keşifle bulunmuyor | Kurulu araçla doğrulandı | Faz 0–1 |
| R07 | P2 | Demo, sayfa örneği, locale ve veri önceliği sözleşmeleri tamamlanmalı | Ürün/mimari kararı | Faz 0–1, Faz 5 |
| R08 | P2 | Component props ve servis adapter’larının doğrulanabilir API’si eksik | Sözleşme boşluğu | Faz 3–4 |
| R09 | P2 | Deterministik build için yayın zamanı ve tüm çıktı sahipleri tanımlanmalı | Tasarım riski | Faz 1, Faz 4 |
| R10 | P2 | Erişilebilirlik ve tarayıcı kontrolleri faz kabulüne daha erken bağlanmalı | Planlama boşluğu | Faz 1–3’ten itibaren |
| R11 | P2 | CSS küçültme kapsamı ve performans bütçeleri ölçüme göre düzeltilmeli | Production çıktısı | Faz 1–2 |
| R12 | P2 | Özelleştirmeleri koruyan sürüm yükseltme akışı somutlaşmalı | Ürün kararı | Faz 0, Faz 6 |
| R13 | P2 | Release/preview/hosting profillerinin sınırı tamamlanmalı | Teslim sözleşmesi | Faz 1, Faz 6 |
| R14 | P2 | Pilot tanımı, v1 kapsamı ve tahminin sayım birimleri netleştirilmeli | Plan içi belirsizlik | Faz 0 |
| R15 | P2 | Ortak CSS’in yaklaşık %91’i Bootstrap; şablonlarda neredeyse hiç Bootstrap sınıfı kullanılmıyor | Ölçümle doğrulandı | Faz 2 |
| R16 | P2 | İç linklerin çoğu sondaki eğik çizgi olmadan yazılmış; directory-index sözleşmesiyle çelişiyor | Kaynak + çıktı taraması | Faz 1 |
| R17 | P2 | Çalışma ağacında commit edilmemiş 33 giriş var; Faz 0 kabulü bunu koruma şartı koyuyor | Depo durumu | Faz 0 |

## 2. Mevcut proje üzerinde doğrulanan durum

Mevcut bağımlılık kurulumuyla production build başarılı oldu: **11 HTML, 11 CSS, 10 JS; 0 derleme hatası ve 0 derleme uyarısı.** Tek çalıştırmadaki Webpack derleme süresi 8.018 ms. Kullanılan ortam Node `v26.10.0`, Webpack `5.111.1`, Pug Plugin `5.3.0`, Dart Sass `1.67.0`. Buradaki Node sürümü bir sürüm önerisi değildir; yalnız deney ortamıdır.

Çıktı `/private/tmp/theme-plan-review-20261003/dist` altında üretildi. Projenin mevcut `dist` dizini hedef alınmadı. Bağımlılık kurulumu veya sürüm güncellemesi yapılmadı; bu sonuç temiz kurulumun tekrarlanabilirliğini kanıtlamaz. Tarayıcıyla görsel/etkileşim incelemesi ve Lighthouse/saha performans ölçümü yapılmadı.

| Kontrol | Gözlem | Plan açısından anlamı |
| --- | --- | --- |
| 11 ayrı HTML çıktısı | Doğrulandı | §2.1’deki envanter doğru |
| Markdown ortak JS | Üretilen `/markdown/` belgesinde script yok | Layout üzerinden shell başlatma işi gerekli |
| Ortak CSS tekrarı | 11 CSS dosyasının ilk **113.908 byte’ı** birebir aynı | Ortak CSS sahipliği ölçümle doğrulanan öncelik |
| CSS küçültme | Sass production çıktısı zaten `compressed` | `minimize: false` bütün CSS’in okunabilir bırakıldığı anlamına gelmiyor; R11 |
| JS küçültme | Webpack `optimization.minimize: false`; çıktıda okunabilir kod mevcut | JS production minimization işi geçerli |
| HTML’de yerel asset referansları | Taranan `href/src/poster` referanslarında eksik asset bulunmadı | Build temel asset çözümlemesi çalışıyor |
| Kırık sayfa linki | `/auth/register/` → `/terms/`; hedef üretilmiyor | Mevcut envantere açık hata olarak eklenmeli |
| Hedefi olmayan fragment linkleri | `/dashboard/` içinde 12 adet | Link kontrolü `#fragment` hedeflerini de kapsamalı |
| Sepet DOM bağımlılığı | `store.js:19–39` ürün haritasını DOM’dan oluşturuyor; `147–150` görünmeyen ID’leri siliyor | §8.4’teki düzeltme doğru ve pagination öncesinde gerekli |
| Sass sürümü | Kurulu paket ve iki lockfile’da `1.67.0` | Planın `@import` için mevcut build’de uyarı iddia etmemesi doğru |

### 2.1. Tamamlama turunda yeniden doğrulananlar ve envantere eklenenler

İkinci ortamda (Node `v22.23.2`, aynı lockfile ve aynı `node_modules`) production build yine **11 HTML, 11 CSS, 10 JS** üretti; derleme 6.641 ms sürdü, hata ve uyarı yok. 11 CSS dosyasının ortak başlangıcı yine 113.905 karakter. Bu, `main.scss` tek başına derlendiğinde çıkan 113.907 byte ile eşleşiyor: ortak başlangıç tamamen `main.scss` içeriğidir. İlk turun aşağıdaki iddiaları kaynakta tek tek doğrulandı: [store.js](../src/views/commerce/store.js) satır 17–39 ürünleri DOM kartlarından topluyor, 147–151 sepetten görünmeyen ID’leri siliyor; [header.js](../src/js/components/header.js) satır 42 ve 44 `localStorage`’a korumasız erişiyor; [login.js](../src/views/auth/login.js) satır 3’te `Base()` çağrılıyor, submit handler satır 46’da bağlanıyor; üç auth formu `action="#" method="post"`; `/markdown/` çıktısında script yok; iki lockfile var ve `yarn.lock` daha yeni; README Yarn komutlarını belgeliyor.

İlk turun tablosuna eklenmesi gereken, bu turda saptanan durumlar:

| Durum | Kaynak | Plan açısından anlamı |
| --- | --- | --- |
| İç linklerin çoğu `/components`, `/templates`, `/dashboard`, `/auth/login` biçiminde; aynı hedef için `/auth/login/` de var | header.pug 1–7, footer.pug 2–13, templates.pug, markdown/index.pug | R16; §8.1 directory-index sözleşmesi ve canonical için tek link biçimi gerekli |
| Ortak CSS’in Bootstrap payı: 103.987 byte ham, 14.845 byte gzip; `main.scss` toplamı 113.907 / 17.239 | `custom-bootstrap.scss`, `utilities/api` dahil | R15; CSS sahipliği işi önce Bootstrap kapsamını daraltmalı |
| Şablonlarda kullanılan Bootstrap sınıfları: `container` 12, `nav-link`/`nav-item` 4’er, `list-unstyled` 1, `my-0` 1 | Bütün `.pug` dosyaları | Bootstrap utility API’sinin neredeyse tamamı kullanılmıyor |
| `html lang="tr"` sabitken docs, templates, components ve storefront sayfaları İngilizce | base.pug:2; markdown/index.pug; store.pug | §13.2 `locale` alanı mevcut içeriğin karışık dilini de çözmeli; erişilebilirlik ve SEO etkisi var |
| Sepet ve quick view, ürün alanlarını `innerHTML` içinde template string ile yazıyor | store.js 153–175 | Veri bugün build-time fixture; katalog adapter’a bağlanınca §9.3 kuralı (textContent/template cloning) zorunlu olur |
| Koyu tema için Sass sabitleriyle yazılmış override’lar var | base.scss 82–85, header.scss 62 | Token modeline geçişte bu kurallar `.theme-dark` sınıfıyla birlikte envantere girsin |
| Google Fonts CSS’i derlenmiş CSS’in içinden `@import url()` ile çekiliyor | main.scss:4 | İlk boyama CSS zincirine dış istek ekliyor; §11.4 yerel font işinin öne alınma gerekçesi |
| Markdown sayfasının CSS çıktısı `style.<hash>.css` adıyla üretiliyor | markdown/style.scss | §11.2’deki “entry adı sahipliği göstermeli” kuralının mevcut örneği |
| `404.html` üretilmiyor | webpack.config.js entry listesi | §8.1 çıktı sözleşmesinde var; Faz 1’de eklenmeli |
| `.gitignore` yalnız `node_modules` ve `dist` içeriyor | .gitignore | `.generated/` ve `release/` için kural yok; R17 |

Fragment sorunları: `#customers`, `#invoices`, `#settings`, `#upgrade`, `#project-orbit`, `#project-canvas`, `#project-northstar`, `#project-echo`, `#project-atelier`, `#download-report`, `#team-report`, `#customer-report`. Dashboard sidebar kodu seçili görünümü değiştiriyor; bu ID’ler için eksik içerik üretmiyor. Demo eylemi olacak öğe uygun bir button/geri bildirimle, gezinme olacak öğe gerçek hedefle tamamlanmalı. Kaynaklar: [register.pug](../src/views/auth/register.pug), [dashboard.pug](../src/views/dashboard/dashboard.pug), [dashboard.js](../src/views/dashboard/dashboard.js).

Yalnız HTML’de doğrudan referans verilen yerel CSS/JS dosyalarının gzip boyutları aşağıdadır. Dış Google Fonts CSS/font istekleri ve görseller bu toplamlara dahil değildir. Gzip Node zlib’in varsayılan ayarıyla hesaplandı; gerçek sunucu transfer boyutu ölçülmedi. Birim **KiB = 1.024 byte**.

| Sayfa | CSS gzip KiB | JS gzip KiB |
| --- | ---: | ---: |
| `/` | 20,20 | 1,82 |
| `/about/` | 17,18 | 1,05 |
| `/markdown/` | 19,00 | 0,00 |
| `/components/` | 22,18 | 5,89 |
| `/templates/` | 17,61 | 1,19 |
| `/auth/login/` | 18,84 | 1,58 |
| `/auth/register/` | 18,87 | 1,82 |
| `/auth/forgot-password/` | 18,88 | 1,37 |
| `/dashboard/` | 21,32 | 2,35 |
| `/commerce/` | 23,34 | 5,03 |
| `/marketing/` | 21,29 | 1,78 |

## 3. İlk pilot öncesinde kapatılacak konular

### R01 — Ortak modülün tek instance olması bir doğruluk koşulu

**Plan referansı:** §9.1, §9.2 ve §11.3; satır 460, 484 ve 637–639.  
**Tür:** Önerilen entry düzenine ilişkin doğrulanmış risk.

Plan layout’un `shell.js`, sayfanın ayrıca `page.js` yüklemesini öneriyor; idempotent mount için modül içi WeakMap kullanıyor. Webpack’in varsayılanında her entry kendi runtime’ını taşıyabilir. İki entry aynı controller veya store’u import ederse iki ayrı modül instance’ı oluşabilir. Bir WeakMap’in kontrolü diğer bundle’daki WeakMap’i görmez. Bu durum cache optimizasyonundan önce çözülmelidir. [Webpack runtimeChunk dokümanı](https://webpack.js.org/configuration/optimization/#optimizationruntimechunk).

Kurulu Pug Plugin ile aynı HTML’de `shell.js` ve `page.js`, aynı `shared.js` içindeki `mount()` fonksiyonunu aynı root için çağırdı:

| Yapılandırma | Modül değerlendirme | Mount | Dönen instance aynı mı? |
| --- | ---: | ---: | --- |
| Varsayılan runtime | 2 | 2 | Hayır |
| `runtimeChunk: 'single'` | 1 | 1 | Evet |

**Öneri:** Faz 1’de belge başına runtime politikası seçilsin. Mevcut araçta doğrulanan seçenek `runtimeChunk: 'single'`; alternatif olarak build’in ürettiği tek sayfa entry’si layout başlangıcını ve page modülünü birlikte import edebilir. Karar bir ADR’de tutulmalı. Controller’ları başlatacak alanların sahipliği de açık olmalı: aynı root’u shell ve page’in ayrı ayrı taraması gerekmemeli.

**Kabul:** Shell ve page aynı stateful modülü kullandığında tek store/controller oluşur; tek tıklama tek event üretir; ortak script’ler doğrudan açılan her HTML’de doğru sırada bulunur. Yalnız bir bundle içinde yapılan tekrar-mount testi yeterli değildir.

### R02 — Pug wrapper için asset yolu kuralı bütün partial’lara uygulanmalı

**Plan referansı:** §7.1, satır 335–342.  
**Tür:** Kurulu Pug Plugin ile doğrulanan araç davranışı.

Plan, page kayıtlarındaki kaynak yollarını `.generated/` wrapper’a göre düzeltmeyi zaten ele alıyor. Ancak included page/block/component içindeki literal `img(src="./icon.svg")` gibi referanslar için aynı kapsam açık değil. Pug Plugin 5’te `require()` kullanılmadan verilen asset yolu entry template’e göre çözülür; include edilen dosyanın konumu esas alınmaz. [Pug Plugin v5 yol açıklaması](https://github.com/webdiscus/pug-plugin#pug-template-as-entry-point).

Deneyde `src/card/card.pug` ve yanındaki `icon.svg`, `.generated/page.pug` tarafından kullanıldı. `src="./icon.svg"` ile plugin `.generated/icon.svg` aradı ve build hata verdi. Aynı kaynak `src="@card/icon.svg"` alias’ıyla sorunsuz üretildi.

**Öneri:** §7.1’e şu kural eklensin: “Generated entry’den kullanılan bütün Pug page/block/UI asset referansları kaynak alias’ı veya doğrulanmış asset helper’ı üzerinden verilir. Scaffold ve lint bu kuralı uygular.” Bu kural template asset’ları içindir; SCSS içindeki `url()` çözümlemesini ayrıca kendi loader davranışına göre ele almak gerekir.

**Kabul:** Aynı görselli block, farklı dizinlerdeki iki wrapper’dan derlenir; `src`, `srcset`, favicon ve data üzerinden gelen görseller doğru çıkar. Legacy doğrudan entry ile yeni wrapper yolu birlikte doğrulanır.

### R03 — Watch, manifesti yeniden üretmekle aynı işlem değil

**Plan referansı:** §7.2–7.3, özellikle satır 368; §17 Faz 1.  
**Tür:** Henüz yazılmamış adaptörün tasarım riski; mevcut uygulamada yeniden üretilmiş bir bug değildir.

Plan JSON/Markdown değişikliklerinin izlenmesini ve silinen çıktının temizlenmesini doğru istiyor. Fakat kayıt → manifest → wrapper → plugin entry hattının hangi olayda yeniden kurulacağını tanımlamıyor. Sadece `devServer.watchFiles` eklemek tarayıcıyı yenileyebilir; başlangıçta hesaplanan entry/data nesnesini kendiliğinden yeniden oluşturmaz. `page.data.cjs` bir kez `require()` edilip object olarak saklanırsa dosyanın değişmesiyle o object’in yenilenmesi de ayrıca yönetilmelidir.

Plugin’in kendi watch/dependency desteği mevcut; bunu yok sayıp ikinci bir kapsamlı watcher yazmak gerekmiyor. Adaptörün ürettiği kayıtların ve config bağımlılıklarının bu akışa nasıl bağlanacağı kanıtlanmalı. [Webpack Node/watch API](https://webpack.js.org/api/node/#watching), [HTML Bundler watchFiles](https://github.com/webdiscus/html-bundler-webpack-plugin#watchfiles).

**Öneri:** Tek bir üretim fonksiyonu hem ilk build’de hem rebuild’de kullanılmalı. Dosya değişiminin yanında kayıt ekleme/silme/yeniden adlandırma izlenmeli. `.generated` kendi üretimini sonsuz rebuild’e çevirmemeli. Watch input/cache politikası, koleksiyonun tarih filtresi ve nested CJS veri bağımlılıkları yazılmalı. Yeni manifest doğrulanıp derleme başarılı olduktan sonra eski çıktılar sahiplik listesine göre kaldırılmalı; geçersiz bir içerik düzenlemesi çalışan son çıktıyı yarıda bırakmamalı.

**Kabul:** Dev server açıkken yeni page ekle, route değiştir, kaydı sil, koleksiyon sayfa sayısını azalt, veri modülünü değiştir, bozuk JSON ekleyip düzelt. Her durumda HTML, menü, sitemap ve arama indeksi aynı başarılı manifest sürümüne ait olmalı.

### R04 — Bootstrap ve public tema tokenları arasında açık köprü gerekli

**Plan referansı:** §10.2–10.4; satır 521, 546–566 ve 574–576.  
**Tür:** Mevcut CSS çıktısıyla doğrulanan entegrasyon riski.

Plan yeni renk şemasını `html[data-color-scheme]` üzerinden yönetiyor; mevcut Bootstrap grid ve utility’lerinin bir bölümünü koruyor. Üretilen CSS’te Bootstrap koyu şeması `[data-bs-theme=dark]`, renk utility’leri ise `--bs-*` değişkenlerini kullanıyor. Yeni `--color-*` tokenlarını değiştirmek bu iki alanı otomatik eşitlemez. Örneğin `.text-body` ve `.bg-body` kendi RGB tokenlarını ve `!important` kullanıyor. [Bootstrap color modes](https://getbootstrap.com/docs/5.3/customize/color-modes/).

Bugün bu utility’lerin bütün sayfalarda kullanıldığını iddia etmiyorum. Risk, korunan public utility setinin yeni temalarda kullanıldığında farklı renk/font kurallarına bağlı kalmasıdır. Yalnız Bootstrap’in dark attribute’unu eşitlemek de marka renklerini tümüyle eşitlemez.

**Öneri:** Faz 2’de korunan Bootstrap API listesi çıkarılsın. Renk/font utility’leri korunuyorsa semantic token → ilgili `--bs-*` ve RGB token eşlemesi tanımlansın; gerekirse dark attribute’u aynı çözümlenmiş state’ten türetilsin. Bootstrap yalnız grid/layout için kullanılacaksa kapsam buna göre daraltılsın. Native kontroller için CSS `color-scheme` de belirlensin. Tercih edilen `system` değeriyle uygulanmış `light/dark` değeri ayrı tutulmalı.

**Kabul:** İki marka ve light/dark altında ortak UI ile korunan Bootstrap utility’leri aynı tasarım sözleşmesine uyar; `system` açıkken işletim sistemi değişimi yansır; açık kullanıcı tercihi korunur. Yalnız attribute değerini kontrol etmek yeterli değildir.

### R05 — Demo auth, JavaScript başarısız olduğunda form gönderebiliyor

**Plan referansı:** §2.3, §9.2–9.3 ve §15.2; satır 489, 503 ve 830–833.  
**Tür:** Mevcut kaynak + derlenmiş JS’e hata enjeksiyonu; gerçek ağ isteği gönderilmedi.

Üç auth formu `action="#" method="post"` kullanıyor. `#` form göndermeyi devre dışı bırakmaz; submit engellenmezse mevcut sayfa adresine POST davranışı oluşur. [HTML form davranışı](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#attributes_for_form_submission).

Ek olarak [login.js](../src/views/auth/login.js) önce `Base()` çağırıyor, submit handler’ını daha sonra bağlıyor. [header.js](../src/js/components/header.js) içindeki storage okuması hata verirse aşağıdaki form başlangıcı hiç çalışmıyor. Derlenmiş login script’ine engellenmiş storage simülasyonu verildiğinde istisna oluştu ve **0 submit listener** bağlandı. No-JS, bundle yükleme hatası ve başlangıç hatası aynı eksik fallback’e çıkabilir.

Plan güvenli storage ve widget hata izolasyonunu zaten istiyor. Eksik olan, bunlar çalışmadığında **demo formunun temel HTML davranışının** da güvenli olması ve kabul senaryosuna girmesi.

**Öneri:** Demo ve bağlı form modları için ayrı temel davranış tanımlansın. Demo formunda gönderilebilir kontroller başlangıçta disabled bir fieldset içinde tutulabilir; controller handler’ları başarıyla bağladıktan sonra etkinleşir. Demo açıklaması statik HTML’de görünür olur. Gerçek endpoint bağlı formda geçerli `action/method` ve sunucu doğrulaması korunur. Shell’de bir widget hatası bağımsız form başlangıcını durdurmamalı.

**Kabul:** JS kapalı, script yüklenememiş veya storage erişimi reddedilmiş demo sayfasında kimlik bilgisi ağ isteğine dönüşmez; sahte başarı gösterilmez. Bağlı formun belgelenmiş temel gönderim akışı ayrıca doğrulanır.

## 4. İlgili fazlara eklenecek iyileştirmeler

### R06 — Browserslist dosyası keşfedilebilir yerde olmalı

**Plan referansı:** §5, satır 158; §14.4.  
**Tür:** Doğrulandı.

`config/browserslist` adı tek başına yanlış değildir; fakat varsayılan keşif kaynak dosyadan üst dizinlere gider, kardeş `config/` klasörüne inmez. Deneyde dosya bu konumdayken otomatik yükleme `null`, açık `config` yolu verilince beklenen liste döndü. [Browserslist yapılandırma araması](https://github.com/browserslist/browserslist#queries).

**Öneri:** Repo kökünde `.browserslistrc` veya `package.json#browserslist` kullanılsın. `config/` tercih edilecekse bütün tüketicilere açık yol verilsin. Ayrıca “hedef tarayıcı listesi”, “uygulama JS sözdizimini dönüştürmek” ve “eksik browser API’si için fallback sağlamak” ayrı kararlar olarak yazılsın. Browserslist dosyası tek başına polyfill sağlamaz.

**Kabul:** CLI, build ve varsa Autoprefixer aynı listeyi okur; seçilen tarayıcılarda kullanılan native API’lerin destek/fallback kararı bellidir.

### R07 — Demo profili, sayfa örneği ve veri önceliği açıklaştırılmalı

**Plan referansı:** §7.1, §8.1, §12.3 ve §13.2; satır 314–328, 393–397, 695 ve 718–720.  
**Tür:** Ürün ve şema kararı.

Örnekte route `/demos/agency/about/`; seçili demo build’inde bunun `/about/` olup olmayacağı tanımlı değil. `basePath` yalnız kurulum prefix’idir; sayfanın iç route’undaki `/demos/agency/` parçasını kaldırmak farklı bir işlemdir. Ayrıca demo kaydı tema/menü seçerken page kaydı da tema ve navigation bilgisi taşıyor. Hangi kaynağın üstün olduğu ve aynı blueprint’in iki demo/locale için nasıl örnekleneceği açıklanmalı.

**Öneri:** Küçük bir profil tablosu eklensin: katalog preview, tek müşteri sitesi ve starter. Her profil için ana sayfa, route mount’u, dahil sayfalar ve indeksleme davranışı tanımlansın. Gerektiği ölçüde `blueprintId`, benzersiz page instance ID’si ve locale eşleştirmesi için `translationKey` ayrı kavramlar olsun. Fazladan renderer yazmadan aynı Pug kaynağı farklı doğrulanmış verilerle kullanılabilir.

Site/theme/demo/page/content/custom verisi için alan bazlı öncelik tanımlansın. `id`, normalize route ve output gibi derleyicinin yönettiği alanlar içerik nesnesinin spread edilmesiyle değişmemeli. Seçili SaaS demosunun auth linkleri gibi demo dışı bağımlılıklar profile dahil edilmeli veya açık entegrasyon adresine çözülmeli.

**Kabul:** Aynı demo kökte ve `/preview/theme/` altında çalışır; tek demo çıktısında giriş sayfası vardır; menüler seçilen paketin dışına yanlışlıkla çıkmaz; dil değiştirici eş içerikle ilişki kurar.

### R08 — “Schema doğrulaması” ile component ve adapter sözleşmesi aynı şey değil

**Plan referansı:** §6, §7.3, §8.4, §9.2 ve §14.4; satır 298, 360–366, 450 ve 792.  
**Tür:** Doğrulama kapsamı eksikliği.

`page.json` şemasını doğrulamak, Pug içinde yazılan `+button({ variant: 'yanlis-deger' })` çağrısını kendiliğinden doğrulamaz. §6’daki “variant değerleri build şemasında sınırlandırılır” cümlesinin hangi katmanda uygulanacağı açıklanmalı. Sayfa şeması zorunluyken schema validator’ın ancak sözleşmeler büyüyünce eklenmesi önerisi de ayrıştırılmalı: kullanılan kütüphane opsiyoneldir; doğrulama Faz 1’den itibaren gereklidir.

Auth/catalog/newsletter adapter’ları için de isim vermek tek başına yeterli değil. Controller’ı servisten ayırmak için minimum sonuç/hata ve iptal sözleşmesi gerekli.

**Öneri:** Public JS API’leri JSDoc ile belgelenebilir; tüm projeyi TypeScript’e geçirmek gerekmez. Pug props için build’de çalışan küçük bir `assertProps` yardımcısı veya aynı sonucu sağlayan doğrulama yolu seçilsin. Adapter’larda örneğin `getByIds(ids, { signal })` ve `submit(payload, { signal })`; başarı, alan hatası, genel hata, iptal ve bulunamayan kayıt sonuçları tanımlansın. Cart repository’si ağ hatasını “ürün yok” sonucuyla karıştırmamalı; silme kararını bu ayrım beslemeli.

**Kabul:** Hatalı variant kaynak dosya/bileşen bilgisiyle build’i durdurur. Demo adapter ile bağlı adapter aynı controller’a takılabilir. Geç tamamlanan eski istek yeni sonucu ezmez; `destroy()` sonrasında UI güncellenmez; katalog isteği başarısız oldu diye sepet boşaltılmaz.

### R09 — Determinizm için zaman girdisi ve bütün çıktı sahipleri tanımlanmalı

**Plan referansı:** §7.3, §8.2, §11.4 ve §19; satır 362–368, 421–428, 651 ve 973.  
**Tür:** Build sözleşmesi iyileştirmesi.

Sabit sıralama ve ID tie-breaker doğru. Buna rağmen yayın tarihi filtresi gerçek saate bağlı çalışırsa aynı kaynak ve lockfile farklı günde farklı içerik üretir. Bu istenen davranış olabilir; ancak “tekrarlanabilir build”in girdileri arasında saat de yer almalıdır. Benzer şekilde `public/robots.txt` ile robots üreticisi veya public HTML ile page üreticisi aynı çıktı yolunu hedefleyebilir. Yalnız page kayıtlarını karşılaştırmak bütün çakışmaları yakalamaz.

**Öneri:** Koleksiyon üretimine açık bir `buildNow`/yayın kesim zamanı verilsin; tarih formatı ve saat dilimi kararı yazılsın. Reproducibility kontrolü bu girdiyi sabitlesin. İleri tarihli içeriğin yayınlanması için yeniden build gerektiği belgelensin. Page, public copy, sitemap/search generator ve release dosyaları ortak bir output sahiplik kontrolünden geçsin. Release manifest kendi checksum’unu hesaplamaya çalışmasın; dışarıda bırakılan dosyalar açıklansın.

**Kabul:** Aynı kaynak + lockfile + profil + zaman girdisi aynı HTML/asset checksum’larını üretir. Aynı output’u isteyen iki üretici build’i durdurur. Başarısız build son başarılı sürümün manifestini geçerli yeni manifest gibi değiştirmez.

### R10 — Kalite senaryoları ilgili fazı durduran kabul koşulları olmalı

**Plan referansı:** §13.3, §14.4, §15.2 ve §17 Faz 6; satır 742, 794, 820–837 ve 917.  
**Tür:** Kabul ve uygulama sıralaması.

Planın §15.2 senaryoları iyi; `check:dist` komutunun build fazında olması da doğru. Buna karşılık tarayıcı/erişilebilirlik araçları “ileriki” iş, temsilî kontroller ise Faz 6 işi gibi okunabiliyor. İlk ortak tabs/dialog ve layout çıkarıldıktan sonra davranış bozulmuşsa bunu iki demo tamamlanınca görmek yeniden iş üretir.

**Öneri:** Faz 1’de build/link kontrolü CI’a; Faz 2’de menü/theme/no-JS/storage kontrolleri; Faz 3’te çoklu instance, klavye ve dialog focus kontrolleri ilgili fazların kabulüne bağlansın. Görsel karşılaştırma başlangıçta az sayıda temsilî sayfa için yeterli. Desteklenen tarayıcı aileleri ve asgari sürüm politikası yazılsın; otomatik motor testi ile gerçek Safari/iOS gibi elle kontrol edilen ortamlar açık ayrılsın.

WCAG 2.2 AA hedefi ürün için benimsenecekse “tanımlanabilir” yerine açık hedef yazılmalı. Mevcut tabloya özellikle şunlar eklenmeli: anlamlı görsellerin metin alternatifi, gerekli kontrol/grafik sınırlarında 3:1 non-text contrast, 200% metin büyütme, istisnalarıyla 320 CSS px reflow, hata tanımlama/öneri akışı ve auth’ta parola yöneticisi/yapıştırma desteği. 44×44 px’in proje tasarım hedefi olarak ayrılması mevcut planda doğru. [W3C WCAG 2.2 kontrol listesi](https://www.w3.org/WAI/WCAG22/quickref/).

**Kabul:** İlgili davranış bozulduğunda o faz tamamlandı sayılmaz. Otomatik sonuç yanında kısa klavye/ekran okuyucu bulgusu tutulur; tek bir otomatik skor uygunluk kanıtı olarak sunulmaz.

### R11 — CSS işi “ilk kez küçültmek” olarak tarif edilmemeli; bütçe regresyonu da yakalamalı

**Plan referansı:** §2.2, §11.1, §14.4 ve §15.1; satır 50, 594–599, 790 ve 808–816.  
**Tür:** Ölçümle yapılan kapsam düzeltmesi.

Mevcut production CSS zaten sıkıştırılmış biçimde çıkıyor. Kurulu `sass-loader` kodu production modunda `sassOptions.outputStyle = 'compressed'` kullanıyor (`node_modules/sass-loader/dist/utils.js:202–204`). Webpack `optimization.minimize: false`, Sass’ın bu çıktısını geri açmıyor. Resmî loader dokümanı da production için compressed varsayılanını açıklıyor. [sass-loader production davranışı](https://webpack.js.org/loaders/sass-loader/#the-style-option-in-production-mode).

Dolayısıyla “JS küçültmeyi etkinleştirmek” ile “CSS optimizasyon politikasını açıklaştırmak” ayrı işler olmalı. CSS minifier eklemek hâlâ yararlı olabilir; beklenen ek kazanç, plain/vendor CSS kapsamı, build maliyeti ve çıktı doğruluğuyla gerekçelendirilmelidir. Sadece tek satır görmek veya stats’ta `minimized` alanı aramak da bütün minification aşamalarını kanıtlamaz.

11 CSS dosyasında ortak başlangıç **111,24 KiB ham**; bu parça tek başına gzip edildiğinde **16,83 KiB**. Bu, sayfalar arasında yeniden indirilen ortak kaynak sorununun somut kanıtıdır. Gzip bağlama bağlı olduğu için bu değeri doğrudan 10 ile çarpıp kesin ağ tasarrufu olarak sunmamak gerekir.

**Öneri:** Plandaki 60/70/130 KB mutlak tavanlar yanında temsilî sayfaların baseline’ına göre boyut değişimi raporlansın. Birimin KB/KiB olduğu, gzip ayarı, cold/warm cache kapsamı ve harici kaynakların dahil edilmesi netleşsin. Örneğin mevcut standart sayfalarda yaklaşık 1–2 KiB JS varken 70 KB tavanı tek başına belirgin bir büyümeyi kaçırır. Yeni özellik kaynaklı artışlar gerekçeli olarak kaydedilebilir.

**Kabul:** İlk sayfa ve ikinci sayfaya geçişte gerçek ortak asset tekrar kullanımı ölçülür; toplam request zinciri fontları da içerir. CSS ortaklaştırma sonrasında yalnız küçülme değil stil sırası ve görünüm korunması da kontrol edilir. Mevcut LCP/INP/CLS hedefleri korunur; bu incelemede bu metriklerin sağlandığı iddia edilmez.

### R12 — Kullanıcı özelleştirmelerinin güncellemede korunması için dosya sahipliği gerekli

**Plan referansı:** §19 ve §21; satır 970–975 ve 1008.  
**Tür:** Ürünün güncelleme vaadini somutlaştırma.

Public token, `custom.scss`, migration belgesi ve alias geçişi iyi başlangıç. Ancak kullanıcının düzenlediği theme config, menü, logo referansı ve özel Pug sayfasının yeni sürüm paketiyle nasıl birlikte yaşayacağı belirli değil. “Özelleştirmelerini koruyarak geçebilmeli” hedefi yalnız SemVer veya changelog ile sağlanamaz.

**Öneri:** Framework’ün dağıtımla değişen dosyalarıyla müşterinin sahip olduğu dosyaların sınırı yazılsın. Örneğin bir proje override alanından config/token/custom CSS okunması yeterli olabilir; yeni bir paket sistemi kurmak şart değil. Kullanıcı-owned dosyaların varsayılanları, override sırası ve güncellemede birleştirme adımları rehberde yer alsın. Mevcut storage/class geçişinde de eski `theme` anahtarı, `body.theme-dark` ve `atelier-store-cart-v1` için korunacak/taşınacak davranış açıkça kaydedilsin.

**Kabul:** Örnek müşteri markası, menüsü, özel sayfası ve stil override’ı bir sürümden sonraki sürüme taşınır; değişmesi gereken public API varsa migration talimatıyla giderilir. Bu deneme release paketinin kendisiyle yapılır.

### R13 — Hazır HTML, preview ve yayın profilleri birlikte sınanmalı

**Plan referansı:** §8.1, §10.2, §11.1–11.3, §13.1 ve §19; satır 389, 568, 597, 636–641, 708 ve 960–976.  
**Tür:** Teslim profili iyileştirmesi.

Hazır HTML’yi elle düzenleyebilme vaadi ile HTML’yi küçültme hedefi arasında kullanım kararı var. HTML’nin tek satır olması dosyayı çalıştırır ama kaynakla çalışmayacak müşterinin düzenleme işini zorlaştırabilir. CSS/JS küçültülmüş kalırken teslim HTML’si okunabilir biçimde üretilebilir; bu profil açık seçilmeli.

Hosting tarafında directory-index, gerçek 404, alt dizin, cache ve CSP tek tek anılıyor; bunları aynı örnek yayın/preview profili üzerinde bir araya getiren bir kabul görevi gerekli. `preview` komutu SPA fallback kullanarak derin link/404 problemlerini gizlememeli. Paketlenen `html/` içindeki asset yolları, ayrı `source/` altında üretildiği varsayılan yollarla karışmamalı.

Preview SEO politikası da net olmalı: taranabilir preview için `noindex` kullanılıyorsa crawler’ın sayfayı okuyabilmesi gerekir; `robots.txt` ile engellemek noindex’in okunmasını önleyebilir. Gizli preview gerekiyorsa erişim kontrolü ayrı konudur. [Google noindex açıklaması](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

**Öneri:** `development`, ürün katalog preview’ı, müşteri production’ı ve release HTML biçimi için küçük bir tablo eklensin. İlk boyama script’i inline ise CSP hash’i son üretilmiş byte’lardan oluşturulsun. Paketleme sonrası root/subpath smoke kontrolü ve okunabilir HTML düzenleme denemesi yapılsın.

**Kabul:** ZIP’ten çıkarılan hazır HTML paketi belgelenen HTTP preview komutuyla açılır; iç linkler, 404 ve asset’lar çalışır. Seçilen CSP profilinde tema başlangıcı engellenmez; preview metadata’sı müşteri production çıktısına sızmaz.

### R14 — İlk pilot ve v1 kapsamı tek anlam taşımalı

**Plan referansı:** §12.3, §17 ve §21; satır 686–693, 891–933 ve 1010.  
**Tür:** Plan içi kapsam belirsizliği; süre tahmininin aritmetiğinde hata yok.

§12.3’te “ilk pilot” Agency/corporate paketini, Faz 3 ve belgenin sonunda ise auth/mimari pilotunu anlatıyor. 2–3 demo, 20–30 blueprint ve 25–35 component kapasite aralığı verilmiş; Faz 5 teslimi en az iki demo. Bunlar çelişmek zorunda değil, fakat iş kartlarına dönüşürken iki farklı teslim beklentisi oluşturabilir.

**Öneri:** “Mimari pilot” ve “ilk tamamlanmış ürün demosu” ayrı milestone adı olsun. v1’in zorunlu iki demo paketi ve sayfa listesi sabitlensin; üçüncü demo kapasiteye bağlı hedef olarak işaretlensin. Page blueprint, içerikten üretilen sayfa instance’ı, layout ve tema varyantı ayrı sayım birimleri olsun. Korunacak mevcut dashboard örneği ile tamamlanmış dashboard ürün paketinin kapsamı da yazılsın.

35–58 gün, belgedeki tasarım/içerik/backend hariç varsayımlarıyla bir başlangıç tahmini olarak kalabilir. Pilot sonrasında manifest/watch işi, Pug wrapper geçişi, dokümantasyon ve tarayıcı kabulü için gerçekleşen sürelerle yeniden tahmin edilmeli. Eldeki veriler bu aralığa daha kesin bir rakam atamayı desteklemiyor.

**Kabul:** Bir milestone’un hangi sayfalar, hangi modlar ve hangi kontroller geçince tamamlandığı tek listeden okunur. Kapsam arttığında tahmin de aynı listeden güncellenir.

### R15 — Ortak CSS’in büyük kısmı kullanılmayan Bootstrap çıktısı

**Plan referansı:** §2.1, §10.1, §10.3 ve §10.4; satır 38, 521–531, 570–578 ve 586–588.  
**Tür:** Tamamlama turunda ölçümle doğrulandı.

[custom-bootstrap.scss](../src/scss/custom-bootstrap.scss) `utilities`, `helpers`, `grid`, `containers`, `reboot`, `type`, `images`, `nav` ve `utilities/api` modüllerini alıyor. Bu dosya tek başına derlendiğinde **103.987 byte ham / 14.845 byte gzip** üretiyor. Her sayfaya kopyalanan `main.scss` toplamı 113.907 / 17.239. Yani sayfalar arasında tekrar eden ortak CSS’in yaklaşık **%91’i** Bootstrap’tan geliyor. Buna karşılık bütün Pug şablonlarında kullanılan Bootstrap sınıfları `container` (12), `nav-link` ve `nav-item` (4’er), `list-unstyled` ve `my-0` (1’er). Projenin kendi stil sistemi `.button`, `.auth-*`, `.store-*` gibi özel sınıflarla kurulmuş.

Plan §10.3’te “mevcut Bootstrap utility’lerinin kullanım ve maliyeti incelenir” diyor ve §10.4’te PurgeCSS’i erteliyor. İkisi de doğru; eksik olan, bu incelemenin sonucunun zaten belli olması: utility API çıktısı neredeyse hiç tüketilmiyor. R04’teki Bootstrap köprüsü sorusu da bu ölçümle küçülüyor: korunacak Bootstrap yüzeyi çok dar olduğunda eşlenecek `--bs-*` değişkeni de azalıyor. Ayrıca header ve footer’daki `.nav-link` adı Bootstrap `nav` modülüyle çakışıyor; `header.scss:27` bu kuralı override ediyor. Vendor alanına taşırken bu bağımlılık görünür olmalı.

**Öneri:** Faz 2 CSS sahipliği işi “core.css’i ayır” ile başlamasın; önce korunan Bootstrap yüzeyi listelensin. Muhtemel sonuç: `containers` + `grid` + `reboot` korunur, `utilities/api` ve `helpers` ya tamamen çıkar ya da `$utilities` map’i kullanılan birkaç sınıfa indirilir. Bu, PurgeCSS gerektirmeden ortak CSS’i büyük ölçüde küçültür ve safelist riski taşımaz. `.nav-link`/`.nav-item` adları ya Bootstrap `nav` modülüyle birlikte kalır ya da projenin kendi `ui-*` adlarına geçer; ikisi birden olmaz.

**Kabul:** Core CSS’in gzip boyutu Faz 2 başında ve sonunda aynı yöntemle ölçülür ve raporlanır. Korunan Bootstrap sınıf/mixin listesi belgelidir; bu listede olmayan bir Bootstrap sınıfı şablonda görünürse lint uyarır. Temsilî sayfalarda light/dark görsel karşılaştırma değişiklik göstermez.

### R16 — İç link biçimi directory-index sözleşmesiyle uyuşmuyor

**Plan referansı:** §8.1 satır 374–399; §13.1 satır 701–711; §18 iş 3.  
**Tür:** Kaynak ve üretilmiş HTML taramasıyla doğrulandı; hosting davranışı test edilmedi.

Plan standart çıktıyı `/<route>/index.html` olarak tanımlıyor ve `/about` → `/about/` yönlendirmesini hosting adaptörüne bırakıyor. Mevcut şablonlarda ise iç linklerin büyük bölümü eğik çizgisiz: `/components` 9, `/templates` 4, `/dashboard` 4, `/commerce` 4, `/marketing` 3, `/markdown` 3 ve `/auth/login` 3 kez. Aynı hedef için `/auth/login/` de 3 kez kullanılıyor. Header’daki `aria-current` kodu sondaki eğik çizgiyi normalize ettiği için menü vurgusu bugün çalışıyor; bu, sorunun görünmesini engelliyor.

Sonuçlar hosting’e göre değişir: webpack-dev-server ve çoğu CDN `/components`’ı `/components/`’a yönlendirir; bazı statik sunucular ve bucket tabanlı hosting’ler ya 404 verir ya da içeriği yönlendirmeden sunar. İkinci durumda aynı sayfa iki adreste yaşar ve göreli linkler bozulur. Canonical, sitemap ve hreflang tek biçim gerektirir.

**Öneri:** §8.1’e açık kural eklensin: site içi linkler yalnız `route()` yardımcısından çıkar ve her zaman sondaki eğik çizgiyle üretilir; şablonlarda literal `href="/..."` yazılmaz. Faz 1’deki `check:dist` komutu üretilmiş HTML’de eğik çizgisiz iç linki hata saysın. `/terms/` gibi hedefi olmayan linkler aynı kontrolde yakalanır. Hosting profili kabulünde `/about` isteğinin davranışı (301 ya da 404) belgelensin.

**Kabul:** Üretilmiş bütün HTML’lerde iç linkler tek biçimdedir; link kontrolü eğik çizgisiz ve hedefsiz linkleri raporlar; root ve `/preview/theme/` profillerinde her iç link ve canonical aynı adrese çözülür.

### R17 — Commit edilmemiş çalışma ağacı pilotun ilk riski

**Plan referansı:** §17 Faz 0 kabulü (satır 871); §20 son satır; §5 `.generated/` ve `release/` notları.  
**Tür:** Depo durumu; `git status` ile doğrulandı.

Çalışma ağacında 22 değiştirilmiş dosya ve 11 izlenmeyen giriş var: `docs/`, dört yeni SCSS component dosyası ve `auth`, `commerce`, `components`, `dashboard`, `marketing`, `templates` görünümlerinin tamamı. Yani planın “mevcut 11 sayfa” dediği şeyin yarıdan fazlası henüz hiçbir commit’te yok. Plan Faz 0 kabulünde “var olan kullanıcı değişiklikleri kaybolmamış” diyor ve §20’de otomatik clean/reset yapılmamasını istiyor; fakat bu durumu bir iş olarak yazmıyor. `CleanWebpackPlugin` ve `npm run clean` yalnız `dist`’i hedefliyor, kaynakları silmiyor; risk build’de değil, migration sırasında yapılacak elle dosya taşımalarında.

**Öneri:** Pilot başlamadan mevcut durum olduğu gibi commit edilsin ve bir baseline etiketi konsun; Faz 0 ölçümleri bu etikete bağlansın. `.gitignore`’a `.generated/` ve `release/` eklensin. İkinci lockfile kararı aynı commit’te değil, ayrı ve açıklanmış bir commit’te verilsin.

**Kabul:** `git status` temiz; baseline etiketi mevcut; Faz 0 raporundaki ölçümler etiketlenen commit’ten yeniden üretilebiliyor.

## 5. Baştan sona bölüm değerlendirmesi

| Plan bölümü | Değerlendirme | Gerekli ek / karar |
| --- | --- | --- |
| 1 — Hedef | Statik MPA teslimi ve mevcut stack’i koruma doğru | V1’in satın alınabilir/kullanılabilir kapsamı R14 ile sabitlensin |
| 2 — Mevcut durum | Ana kod tespitleri doğrulandı | Kırık linkler, auth hata zinciri, gerçek CSS ölçümü ve §2.1’deki yeni envanter eklensin |
| 3 — Ürün referansları | HTML ve WordPress referanslarını ayrı değerlendirmek yerinde | Tasarım genişliğini ölçüt almak yeterli; satış sıralaması uygulama bağımlılığı olmasın |
| 4 — Mimari | Atomic sınıflama + feature sahipliği dengeli | `layouts → blocks` kullanımı, site-header/footer geçiş haritasıyla birlikte diyagramda açıklansın |
| 5 — Klasör yapısı | İhtiyaca göre açılan dizin yaklaşımı doğru | Browserslist konumu düzelsin; `.generated/release` oluşturulurken ignore kuralları da eklensin |
| 6 — Component sözleşmesi | Çoklu instance, no-JS ve asset sahipliği iyi kapsanmış | Props doğrulamasının gerçek mekanizması R08; geçersiz ARIA/ID ilişkileri kabulde kontrol edilsin |
| 7 — Manifest | Tek kayıt ve normalize manifest doğru | R02–R03, R07–R09; kayıt değişikliği tüm türev çıktılara tutarlı yansısın |
| 8 — Routing/pagination | Directory-index, gerçek linkler, local/global filtre ayrımı ve sepet düzeltmesi güçlü | Tek link biçimi (R16), demo mount kuralı, yayın saati ve repository hata ayrımı tamamlansın |
| 9 — JS runtime | Küçük controller ve cleanup sözleşmesi uygun | R01 ve R05; source ESM ile Webpack’in runtime instance’ı ayrımı yazılsın |
| 10 — Stil/tema | CSS sahipliği ve `@use` sınırlarının anlatımı doğru | Bootstrap kapsamı önce daraltılsın (R15); köprü, system tercihi ve native renk şeması R04 |
| 11 — Build/asset | Tek extraction sahibi, hash, srcset/font politikaları yerinde | CSS’in mevcut compressed davranışı, output sahipliği ve runtime doğruluğu eklensin |
| 12 — Katalog/demolar | Az sayıda tamamlanmış demo ve sınırlı variant hedefi doğru | İlk pilot adı ve bağımlılıklarıyla seçili demo build’i R07/R14 |
| 13 — İçerik/SEO/a11y | Pagination canonical, güvenli içerik ve hreflang yaklaşımı doğru | Eş içerik anahtarı, preview noindex ayrıntısı ve ölçülebilir a11y kabulü |
| 14 — Dokümantasyon/DX | Üretilmiş örnek ve kaynak kodun tek kaynaktan gelmesi iyi | Schema doğrulaması başlangıçtan zorunlu; adapter sonuç modelleri belgelensin |
| 15 — Performans/kabul | Field/lab ayrımı ve temsilî matris yaklaşımı doğru | Baseline regresyonu ve CI’da hangi fazın hangi kontrolle duracağı eklensin |
| 16 — Geçiş haritası | Dikey migration ve alias köprüleri doğru | Header/footer block bağımlılık yönü ile public class/storage geçişleri açıklaşsın |
| 17 — Fazlar | Bağımlılık sırası genel olarak uygulanabilir | R01–R06 erken fazlara, davranış kontrolleri component teslimine bağlansın; Faz 0 commit/baseline işiyle başlasın (R17) |
| 18 — İlk 12 iş | Somut ve doğru başlangıç işleri içeriyor | Öncesinde runtime/wrapper/watch denemesi; auth işine no-JS/hata kabulü eklensin |
| 19 — Dağıtım | Hazır HTML + kaynak + doküman ayrımı doğru | Özelleştirme yükseltme denemesi ve paket sonrası smoke kontrolü R12/R13 |
| 20 — Riskler | Overengineering, büyük migration ve CSS sıra riskleri görülmüş | Çoklu Webpack runtime, generated asset yolları ve stale manifest riskleri eklensin |
| 21 — Tamamlanma | Kullanıcı sonucuyla tanımlanmış başarı ölçütleri iyi | Her hedef kabul senaryosu/kanıt dosyasıyla eşlensin; pilot adı R14 ile tutarlı olsun |

Ürün referanslarının sayfaları tekrar kontrol edildi. Canvas/Porto’nun HTML ürün yaklaşımı ile Avada/Betheme’nin WordPress ürün yaklaşımının ayrı kullanılması doğru. Bu rapor satış sayısı, fiyat veya sıralama üzerine bir öneri üretmiyor. [Canvas](https://themeforest.net/item/canvas-the-multipurpose-html5-template/9228123), [Porto](https://themeforest.net/item/porto-responsive-html5-template/4106987), [Avada](https://themeforest.net/item/avada-responsive-multipurpose-theme/2833226), [Betheme](https://themeforest.net/item/betheme-responsive-multipurpose-wordpress-theme/7758048).

## 6. Planın bölüm bölüm ayrıntılı incelemesi

Bu bölüm §5 tablosunu açar. Her plan bölümü için önce doğru bulunan kararlar, sonra eksik ya da riskli noktalar yazılıdır. “Doğrulandı” ifadesi bu incelemede kaynak kod, build çıktısı ya da kurulu araçla kontrol edilen tespitler için kullanılmıştır; diğerleri tasarım değerlendirmesidir.

### §1 Hedef ve temel karar

- **Doğru:** Statik MPA, derleme zamanı Pug, tarayıcı yönetimli sayfa geçişi ve Node sunucusuz teslim; React/Vue, istemci router ve mikro paketlemenin açıkça kapsam dışı bırakılması. Karar tablosundaki gerekçeler mevcut depoyla tutarlı.
- **Eksik:** “Kaynakları düzenlenebilir framework” ile “hazır HTML teslimi” iki ayrı kullanıcıyı anlatıyor; bunların öncelik sırası R13’te istenen teslim profilleriyle kesinleşmeli. “Tema ürünü = marka preset’i + blok varyasyonu + demo paketi” tanımı iyi; v1’de üç eksenden hangisinin zorunlu olduğu R14’e bağlı.

### §2 Mevcut durum

- **Doğrulandı:** Tablodaki kaynak tespitlerinin tamamı bu incelemede kontrol edildi ve tutuyor; ayrıntı §2 ve §2.1’de. Component kütüphanesinin 548/673/1786 satır olduğu da doğrulandı.
- **Eksik:** Tablo yalnız yapısal borçları sayıyor. Kırık `/terms/` linki, 12 hedefsiz fragment, karışık dil, `innerHTML` ile veri yazımı, link biçimi tutarsızlığı ve Bootstrap payı envantere eklenmeli. §2.3’teki demo sınırı doğru; auth için JS başarısızlığında temel davranış (R05) eklenmeli.

### §3 Ürün referansları

- **Doğru:** HTML ürünlerini teslim modeli, WordPress ürünlerini kapsam referansı olarak ayırmak; tasarım/kod kopyalamayı dışarıda bırakmak. Başarı ölçütü (“yeni marka için çok sayfalı siteyi ne kadar kolay çıkarabiliyor”) doğru seçilmiş ve §21 ile uyumlu.
- **Not:** Referans sayfaları ilk turda ziyaret edildi; tamamlama turunda tekrar ziyaret edilmedi. Bu bölümden uygulamaya bağımlılık çıkmıyor.

### §4 Mimari ve bağımlılık kuralları

- **Doğru:** Atomic Design’ı yalnız görsel sınıflama, feature’ı kod sahipliği olarak kullanmak; boş `entities/services/managers` açmamak; `domain/product` çıkarımını kanıta bağlamak; build verisi ile tarayıcı verisini ayırmak.
- **Eksik:** Diyagramda `Layouts → Shared UI` var ama `Layouts → Blocks` yok; §5 ve §16 header’ı `blocks/site-header` yapıyor, dolayısıyla layout bir block kullanacak. Bu kenar eklenmeli ya da site-header `layouts/site` içinde tutulmalı. Hem `Pages → Features` hem `Blocks → Features` kenarı olduğu için aynı feature’ın page ve block tarafından iki kez mount edilmesi mümkün; mount sahipliği kuralı (“bir root’u kim başlatır”) R01’in template tarafıdır. “Lint kuralları zamanla” yerine Faz 1’de basit bir import yolu kısıtı yeterli ve ucuz.

### §5 Hedef klasör yapısı

- **Doğru:** İhtiyaçla açılan dizin yaklaşımı; `.generated` ve `release` dizinlerinin git dışında tutulması; tek lockfile önerisi README’deki Yarn kullanımıyla tutarlı.
- **Eksik:** `config/browserslist` konumu R06. `.gitignore` bugün yalnız `node_modules` ve `dist` içeriyor; `.generated/` ve `release/` kuralı yok (R17). `qa/` “ileride” olarak işaretlenmiş; R10 Faz 1’den itibaren `check:dist` ve link kontrolünün bir yerde yaşamasını gerektiriyor. `src/pages/components` ve `templates` ürün sayfası mı doküman yüzeyi mi, build profiline göre belirlenmeli (R07/R13).

### §6 Bileşen sözleşmesi

- **Doğru:** On bir satırlık sözleşme tablosu; no-JS, çoklu instance, lifecycle ve asset sahipliğinin baştan API’ye dahil edilmesi; “iki bağımsız kullanımda çıkar, üçüncüde doğrula” kuralı; escaped output varsayılanı.
- **Eksik:** Props doğrulama mekanizması R08. Örnek mixin `&attributes(attributes)` kullanıyor; Pug’da `class` birleşir ama `type`, `disabled` gibi attribute’larda `attributes` kazanır. Hangi attribute’ların dışarıdan ezilebileceği sözleşmeye yazılmalı. `!=` (unescaped) kullanımı lint ile sınırlanmalı; mevcut `store.js` içindeki `innerHTML` deseni geçişte bu kurala tabi olmalı.

### §7 Sayfa kaydı, veri ve HTML üretimi

- **Doğru:** Tek `page.json` kaydı ve türetilmiş manifest; `output`’un route’tan türetilmesi; layout seçiminin iki kaynağı olmaması için generated wrapper; ham `src/...` yolunun wrapper’a kopyalanmaması; §7.3’teki ret listesi.
- **Eksik:** Wrapper’dan kullanılan Pug asset yolları R02; watch/rebuild sözleşmesi R03; demo/locale/veri önceliği R07; zaman girdisi ve output sahipliği R09. Include edilen `page.pug` içinde `block` tanımı çalışmayacağı için sayfaya özel head eklemeleri (preload, JSON-LD, ek stylesheet) yalnız kayıt alanlarından gelebilir; bu alanların listesi şemada olmalı. Büyük/küçük harf çakışması kuralı doğru ve önemli: macOS’ta build geçer, Linux hosting’de 404 olur. Türkçe karakterler için slug normalizasyonu (ı/İ, ş, NFC) yazılmalı; plan “aynı slug’a dönüşen iki içerik” diyor ama dönüşüm kuralını vermiyor. Legacy `extends` sayfaları ile wrapper sayfaları geçiş boyunca aynı manifest çıktısını üretmeli; aksi hâlde sitemap/link kontrolü iki ayrı listeden beslenir.

### §8 Routing ve sayfalama

- **Doğru:** Directory-index, gerçek `<a href>` pagination, `/page/1/` üretmeme, boş koleksiyon davranışı, `siteUrl/basePath/assetBase` ayrımı, `file://` profilinin dışarıda bırakılması, filtre kapsamının kullanıcıya doğru anlatılması, sepet düzeltmesi.
- **Eksik:** Link biçimi R16. Mevcut config `publicPath: "/"` ve `require('@images/...')` ile asset yollarını kökten çözüyor; alt dizin senaryosunda hem asset hem link kırılır, bu Faz 1 işidir. `404.html` bugün üretilmiyor. Pagination’da görünür sayfa penceresi (ör. 1 … 4 5 6 … 20) ve uzun koleksiyonlar için üst sınır kararı yok. `pageSize` değişince eski `/page/N/` çıktıları yetim kalır; §8.2 adım 8 bunu kapsıyor, R03’teki sahiplik listesiyle aynı mekanizma olmalı. Sepet anahtarının `atelier-store-cart-v1`’den yeni ada taşınması R12’ye bağlı.

### §9 JavaScript runtime

- **Doğru:** Küçük mount/destroy sözleşmesi; WeakMap ile tekrar mount koruması; sabit eşlemeden dynamic import; `textContent`/template cloning kuralı; demo formun gerçek işlem izlenimi vermemesi.
- **Eksik:** Shell/page çift runtime R01; demo auth no-JS davranışı R05; adapter sonuç modeli R08. `header.js` `document` seviyesinde `keydown` ve `click` dinleyicisi ekliyor ve kaldırmıyor; `destroy()` için tek `AbortController` sinyali yeterli olur. `Base()` içindeki `console.log("Base layout")` production’da kalıyor; minification politikasında `console` kararı yazılmalı. UI Library’nin üretimle aynı modülleri kullanması hedefi doğru; bugün `components.js` kendi kopyalarını taşıyor.

### §10 SCSS, CSS ve tema

- **Doğrulandı:** Ortak başlangıcın `main.scss` ile birebir eşleştiği; Sass çıktısının production’da zaten compressed olduğu; `.theme-dark` sınıfının `body` üzerinde tutulduğu; `@import`’ın 1.67.0’da uyarı üretmediği.
- **Eksik:** Bootstrap kapsamı R15; Bootstrap köprüsü ve `system` tercihi R04; CSS minification kapsamı R11. Koyu tema için Sass sabitleriyle yazılmış override’lar (`base.scss:82–85`, `header.scss:62`) token modelinin dışında kalıyor ve geçiş envanterine girmeli. `quietDeps: true` Bootstrap uyarılarını susturuyor; `@use` geçişinde proje dosyalarının uyarıları görünür kalmalı. `@layer` ve PurgeCSS’i ertelemek doğru; R15’teki daraltma PurgeCSS’in yapacağı işin büyük kısmını safelist riski olmadan karşılar. Yeni `html[data-color-scheme]` modeline geçerken eski `theme` storage anahtarı ve `body.theme-dark` sınıfı için okuma/taşıma kuralı R12’de.

### §11 Production build ve asset hattı

- **Doğru:** Config factory; `minimize: false` override’ının kaldırılması; ikinci CSS extraction sistemi eklenmemesi; `.min.css` adının kanıt sayılmaması; entry adlarının sahiplik göstermesi; hash’li asset ve kısa HTML cache ayrımı; gzip/brotli’nin ayrı aşama olması.
- **Eksik:** CSS’in zaten compressed olduğu R11; runtime instance R01; output sahipliği R09. `devtool` bugün tanımsız; production’da map üretilmiyor, development’ta Webpack varsayılanı geçerli. Plan “map politikasını açıkça belirle” diyor, mevcut durum not edilmeli. HTML minification için kurulu plugin sürümünün seçeneği bu turda doğrulanmadı; Faz 1’de kurulu sürümün API’siyle denenmeli. Markdown sayfasının CSS’inin `style.<hash>.css` adıyla çıkması, §11.2’deki adlandırma kuralının bugünkü ihtiyacını gösteriyor. Google Fonts’un derlenmiş CSS içinden `@import` ile çekilmesi ilk boyamayı dış isteğe bağlıyor; §11.4 yerel font işi Faz 2 kapsamına alınmalı.

### §12 Layout, blok ve demo kataloğu

- **Doğru:** Yedi layout’un boolean parametreler yerine ayrı dosya olması; P0/P1/P2 bileşen önceliği mevcut tekrarlarla örtüşüyor; sınırlı variant kuralı; “bir tam demo, ikinci farklı demo, sonra genişleme” sıralaması.
- **Eksik:** İlk pilot adı ve seçili demo build’inin route/bağımlılık kuralı R07 ve R14. Mevcut dashboard ve commerce sayfaları Faz 5’te “bloklara taşınacak” deniyor; bunların v1 demo paketi mi yoksa korunan örnek mi olduğu yazılmalı.

### §13 İçerik, SEO, dil ve erişilebilirlik

- **Doğru:** Sayfa başına metadata; pagination sayfalarının kendi canonical’ı; yalnız üretilen sayfaların sitemap’e girmesi; JSON-LD’nin yalnız gerçek içerikle üretilmesi; dil başına gerçek HTML; hreflang’ın yalnız var olan karşılıklar arasında kurulması; RTL’in yalnız `direction` olmadığı notu; ARIA’nın davranış sağlamadığı uyarısı.
- **Eksik:** Zaman girdisi R09; preview noindex ayrıntısı R13; ölçülebilir a11y kabulü R10; eş içerik anahtarı R07. Mevcut içerik tek `lang="tr"` altında karışık dilde; `locale` alanı tanımlanırken bu sayfaların hangi dile ait olduğu karara bağlanmalı. JSON-LD serialization’ında `</script>` kaçışı açıkça yazılmalı. Para birimi için minor unit kararı doğru; mevcut `_store-data.pug` tam dolar değerleri ve `en-US` formatı kullanıyor, geçişte dönüştürülmeli.

### §14 Dokümantasyon ve geliştirici deneyimi

- **Doğru:** Canlı örnek ve HTML kaynağının aynı Pug’dan üretilmesi; sekiz rehber başlığı; CLI komutlarının “şu anda yok” diye işaretlenmesi; Yarn’ın README ile tutarlı seçilmesi; framework/jQuery’nin varsayılan bağımlılık olmaması.
- **Eksik:** Schema doğrulamasının baştan zorunlu olması R08; `yarn preview`’ın SPA fallback kullanmaması R13; tarayıcı/a11y araçlarının Faz 1–3’e çekilmesi R10. `create:component` scaffold’u R02’deki asset alias kuralını üretmeli.

### §15 Performans bütçeleri ve kabul

- **Doğru:** Bütçelerin “ölçümden sonra kesinleşecek başlangıç değeri” olarak sunulması; lab/field ayrımı; kombinasyon patlaması yerine temsilî matris; davranış sözleşmesi testi.
- **Eksik:** Baseline regresyonu ve birim/gzip tanımı R11. Bugünkü değerler bütçelerin çok altında: sayfa başına CSS 17–24 KiB gzip, JS 1–6 KiB gzip. Mutlak tavanlar bu projede ancak büyük sıçramaları yakalar; yüzde regresyon eşiği daha anlamlı.

### §16 Geçiş haritası

- **Doğru:** Dikey pilot; compatibility dosyası; `_store-data.pug`’un veri katmanına taşınması; header/footer nav verisinin dışarı alınması; templates galerisinin manifestten beslenmesi.
- **Doğrulandı:** Header dört, footer sekiz linkli ayrı nav listesi tutuyor; ikisi de Pug içinde elle yazılmış. Manifestten türetme hem tekrarı hem link biçimi sorununu çözer.
- **Eksik:** `body.theme-dark`, `theme` anahtarı ve `atelier-store-cart-v1` için public class/storage geçiş satırları (R12). `src/js/layouts/base.js` satırında `Base()` sorumluluğunun kalkması R01’deki runtime kararına bağlı.

### §17 Fazlar ve planlama büyüklüğü

- **Doğru:** Faz bağımlılık sırası; Faz 4’ün Faz 1 ve 3’e bağlanması; tahminin “teslim sözü değil” diye işaretlenmesi; manifest işi ile component envanterinin paralel yürüyebilmesi.
- **Eksik:** Faz 0’a commit/baseline işi (R17); Faz 1 başına runtime/wrapper/watch denemesi (R01–R03); Faz 2 kabulüne Bootstrap kapsamı ve font kararı (R15); Faz 3’e no-JS form kabulü (R05); tarayıcı kontrollerinin Faz 6’dan öne çekilmesi (R10). Milestone adları R14.

### §18 İlk 12 iş

- **Doğru:** Liste somut ve sıralaması bağımlılıklara uygun; sonunda “yeni kayıtla HTML üretilir, component başka sayfada kullanılır, pagination çalışır” hedefi ölçülebilir.
- **Eksik:** İş 2’nin adı “gerçek JS/CSS küçültme” yerine “JS küçültme + CSS optimizasyon politikası” olmalı (R11). İş 3’e link biçimi kuralı ve `check:dist` (R16); iş 6’ya runtime kararı (R01); iş 7’ye Bootstrap daraltma (R15); iş 8’e Bootstrap köprüsü (R04); iş 10’a no-JS form davranışı (R05); listenin başına commit/baseline (R17) eklenmeli.

### §19 Dağıtım ve özelleştirme

- **Doğru:** `html/`, `source/`, `starter/`, `documentation/` ayrımı; lisanslı/lisanssız görsel envanteri; release manifest’in gizli veri taşımaması; breaking change için migration ve alias geçiş süresi.
- **Eksik:** Kullanıcı-owned dosya sınırı ve yükseltme denemesi R12; hazır HTML’nin okunabilir biçimde üretilmesi ve paket sonrası smoke kontrolü R13.

### §20 Riskler

- **Doğru:** Overengineering, büyük klasör değişimi, page builder tuzağı, Sass/Bootstrap topluca kırılma, iki lockfile ve working tree kaybı riskleri görülmüş ve önlemleri gerçekçi.
- **Eksik:** Tabloya çoklu Webpack runtime (R01), generated asset yolları (R02), stale manifest (R03), kullanılmayan vendor CSS’in bütçeyi doldurması (R15), iki link biçiminden doğan çift adres (R16) ve commit edilmemiş kaynak (R17) eklenmeli.

### §21 Tamamlanma hedefi

- **Doğru:** Sekiz madde kullanıcı sonucuyla yazılmış; her biri kabul senaryosuna çevrilebilir.
- **Eksik:** Her maddenin hangi kanıt dosyası ve hangi senaryoyla kapanacağı yazılmalı. Madde 8 (“özelleştirmeleri koruyarak geçiş”) için R12’deki yükseltme denemesi; madde 6 (“kök veya alt dizin”) için R16’daki tek link biçimi ön şart. Önerilen ilk milestone adı §12.3’teki “ilk pilot” ile aynı olmalı (R14).

## 7. Korunması gereken güçlü kararlar

- Webpack/Pug altyapısını kullanarak önce çalışan pilot çıkarmak; alternatif bundler kararını somut ihtiyaca bırakmak.
- Atomic Design’ı görsel sınıflama, feature’ları işlev sahipliği olarak kullanmak; aynı bileşeni iki yerde kopyalamamak.
- Sayfa kaydını tek doğruluk kaynağı yapmak; output’u route’tan türetmek.
- SPA router eklemeden gerçek HTML pagination üretmek; filtre kapsamını kullanıcıya doğru anlatmak.
- Cart’ı görünür DOM’dan ayırmak ve fiyat/stok otoritesini gerçek serviste tutmak.
- `@use`’ın farklı CSS entry’leri arasındaki tekrarı çözmediğini açıkça belirtmek; CSS sahipliğini önceliklendirmek.
- Sass/Bootstrap geçişini mekanik import değişimine çevirmemek. Sass 1.80.0’dan itibaren `@import` deprecation bilgisi resmî dokümanla uyumlu; mevcut 1.67.0 için uyarı iddia edilmemesi doğru. [Sass değişiklik notu](https://sass-lang.com/documentation/breaking-changes/import/).
- No-JS, çoklu instance, cleanup, klavye ve focus davranışlarını component API’sine dahil etmek.
- Daha fazla demo yerine iç sayfaları tamamlanmış iki farklı marka üzerinden tekrar kullanımı sınamak.
- Mevcut working tree değişikliklerini koruyarak küçük migration adımları yapmak.

## 8. Önerilen uygulama sırası

Mevcut fazları koruyup kabul şartlarını aşağıdaki gibi güçlendirmek yeterli. Yeni bir framework katmanı veya kapsamlı page builder gerekmiyor.

| Sıra | Çıktı | Fazın kapanma koşulu |
| --- | --- | --- |
| Faz 0 | Mevcut çalışma ağacının commit’i ve baseline etiketi; iki ürün demosunun kapsamı; browser/Node/package manager kararı; page/profile/veri önceliği ADR’leri | `git status` temiz; aynı kavramlar tek anlam taşıyor; mevcut ölçüm ve route listesi etiketli commit’ten yeniden üretiliyor |
| Faz 1 başlangıcı | Tek örnekte wrapper + alias asset + shell/page runtime + manifest watch | R01–R03 ve R06 kabul senaryoları geçiyor |
| Faz 1 devamı | Mevcut 11 sayfa + `404.html`; root/subpath; tek link biçimi; minification politikası; çıktı doğrulaması | Kırık yerel link/fragment envanteri giderilmiş; eğik çizgisiz iç link yok; hiçbir output çakışması yok |
| Faz 2 | Bootstrap kapsamının daraltılması, core CSS, yerel font, site/auth shell, tema ve Bootstrap uyumu | Core CSS gzip ölçümü raporlanmış; aynı belgede tekrar CSS yok; menü no-JS’te erişilir; storage hatası bağımsız widget’ları durdurmaz |
| Faz 3 | Ortak component’ler ve auth ailesi | Props/instance/focus senaryoları ve demo form fallback’i geçiyor; katalog aynı modülleri kullanıyor |
| Faz 4 | Blog/katalog koleksiyonları ve cart repository | Pagination, back/reload state, veri hataları ve silinen çıktı davranışları geçiyor |
| Faz 5 | İki tamamlanmış demo ve seçili demo profili | Aynı core üzerinde farklı görünüm; doğru route mount’u ve paket bağımlılıkları |
| Faz 6 | Release paketi ve özelleştirme/güncelleme rehberi | Temiz kurulum, paket smoke kontrolü ve örnek müşteri yükseltme denemesi geçiyor |

İlk 12 iş listesinin başına yeni büyük işler yığmak yerine ilk dört build işinin kabulüne runtime, wrapper ve watch denemeleri eklenmeli. Header/theme işine Bootstrap köprüsü; auth işine başarısız JS/no-JS form davranışı; release işine gerçek paket ve yükseltme denemesi eklenmeli.

## 9. Kanıt ve tekrar kontrol notları

Mevcut build şu komutla alındı:

```sh
npm run build -- --output-path /private/tmp/theme-plan-review-20261003/dist --json /private/tmp/theme-plan-review-20261003/stats.json
```

HTML taraması `parse5` ile yapıldı. Sayfa hedefleri directory-index modeline göre; fragment hedefleri üretilen belgelerin ID’lerine göre kontrol edildi. Taranan HTML’lerde duplicate ID saptanmadı. Dinamik DOM, CSS URL’leri, `srcset`, harici linkler ve ağ davranışı bu statik taramanın kapsamı değildir.

Runtime deneyi kurulu Webpack/Pug Plugin’in ürettiği script’leri HTML’deki sırayla Node VM’de çalıştırdı. Bu deney modül instance kimliğini kanıtlar; tarayıcı focus/klavye davranışını sınamaz. Wrapper deneyi gerçek Webpack derlemesidir. Storage deneyi mevcut derlenmiş login entry’sine kontrollü hata enjekte eder; tarayıcıdan form gönderimi yapılmadı.

Kalıcı [kanıt dosyası](./reviews/theme-framework-2026-10-03/kanitlar.json) başlangıç ölçümlerini, sayfa/asset listesini ve deney sonuçlarını içerir. Geçici inceleme araçları ve ayrıntılı build çıktısı `/private/tmp/theme-plan-review-20261003/` altında bulunur. Plan dosyasının incelenen SHA-256 değeri:

```text
5709511b7c9582076a4ce2678a0a1d263fa22aa9e1ad6f472729aa23517b50a8
```

Tamamlama turunun yeniden üretimi şu ortamda yapıldı: Node `v22.23.2`, aynı `node_modules`, Webpack `5.111.1`, Pug Plugin `5.3.0`, Dart Sass `1.67.0`. Build komutu aynı; çıktı dizini oturuma özel scratchpad altında tutuldu. Bootstrap payı için `custom-bootstrap.scss` ve `main.scss` ayrı ayrı `sass --style=compressed` ile derlendi ve Node zlib varsayılanıyla gzip’lendi. Link biçimi sayımı bütün `.pug` dosyalarındaki `href="/..."` değerleri üzerinden yapıldı. Plan dosyasının SHA-256 değeri tamamlama turunda da aynıydı. Ölçümler [tamamlama-olcumleri.json](./reviews/theme-framework-2026-10-03/tamamlama-olcumleri.json) dosyasındadır; ilk turun `kanitlar.json` dosyası değiştirilmedi.

Bu inceleme kapsamında asıl plan ve uygulama kaynakları değiştirilmedi. Eklenen kalıcı dosyalar bu rapor ile iki kanıt JSON’udur.

## 10. Plan sahibinin vermesi gereken kararlar

Aşağıdaki kararlar uygulamacıya bırakılamaz; her biri birden fazla bulguyu kapatır. Önerilen varsayılan, bu incelemenin kanıtına göre yazılmıştır.

| # | Karar | Önerilen varsayılan | Kapattığı bulgular |
| --- | --- | --- | --- |
| K1 | Belge başına JS runtime politikası | `runtimeChunk: 'single'`; alternatif tek page entry’nin shell’i import etmesi | R01 |
| K2 | Korunan Bootstrap yüzeyi | `reboot` + `containers` + `grid`; utilities API ve helpers çıkar ya da `$utilities` map’i daraltılır | R04, R15 |
| K3 | Site içi link biçimi | Daima sondaki eğik çizgiyle, yalnız `route()` üzerinden | R16, §8.1 |
| K4 | Demo ve auth formlarının temel davranışı | Demo: disabled fieldset + controller sonrası etkinleşme; bağlı: gerçek `action/method` | R05 |
| K5 | Build profilleri ve teslim HTML biçimi | development / katalog preview / müşteri production / okunabilir release HTML | R07, R13 |
| K6 | İlk pilot ve v1 tanımı | “Mimari pilot” (Faz 0–3) ve “ilk tam demo” (Agency) ayrı milestone; v1 = iki demo | R14 |
| K7 | Paket yöneticisi, Node sürümü ve lockfile | Yarn + `yarn.lock`; `package-lock.json` ayrı commit’te kaldırılır; Node sürümü `engines` ile sabitlenir | §5, §14.3, R17 |
| K8 | Yayın zamanı girdisi ve saat dilimi | `buildNow` parametresi, UTC, ISO-8601; reproducibility kontrolünde sabit | R09 |
| K9 | Erişilebilirlik hedefi | WCAG 2.2 AA açık hedef; 44×44 px proje tasarım hedefi olarak ayrı | R10 |
| K10 | Mevcut dil karışıklığı | Docs/templates/components/storefront için locale kararı; `lang` sayfa kaydından üretilir | §13.2 |

## 11. Tamamlama notu

İlk tur R14’ün kabul satırında bitmişti; §5 tablosu, §6–§8 (şimdi §7–§9) yazılmıştı ama planın 21 bölümünün ayrıntılı değerlendirmesi yoktu. Tamamlama turunda yapılanlar:

- İlk turun bütün kod ve build iddiaları ikinci ortamda yeniden doğrulandı; çelişen bir sonuç çıkmadı. Ölçüm farkları yalnız derleme süresinde (8.018 ms → 6.641 ms) ve gzip’te onlarca byte düzeyinde.
- R15–R17 eklendi; özet tablo, §5 tablosu ve §8 faz tablosu buna göre güncellendi. P1 sayısı değişmedi: yeni bulguların hiçbiri mimariyi değiştirmiyor, hepsi ilgili fazın kabulüne eklenecek iş.
- §2.1 ile envantere on yeni doğrulanmış durum eklendi.
- §6 ile plan §1–§21 tek tek değerlendirildi; §10 ile plan sahibinin kararları tek listeye alındı.
- Bu turda tarayıcı testi, Lighthouse, hosting davranışı ve kurulu plugin’in HTML minify seçeneği doğrulanmadı; bunlar ilgili fazların kabul işi olarak bırakıldı.

Karar değişmedi: **mimari korunur; K1–K10 kararları verildikten sonra dikey pilotla uygulanır.**

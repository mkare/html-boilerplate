# Faz 0 — Milestone ve v1 kapsamı

## Milestone sözlüğü

| Milestone | Fazlar / sonuç | Planlanan kapsam | “Tamamlandı” demek için |
| --- | --- | --- | --- |
| **Mimari pilot** | Faz 0–3; auth ailesiyle biter | Mevcut 11 sayfayı manifest build sözleşmesine taşımak; root/subpath ve URL kabulü; ortak core/layout/shell; ilk gerçek UI modülleri; auth ve demo form fallback’i | Yeni kayıtla HTML üretimi; runtime tek instance; markdown dahil shell; P0 component ve auth kabulü; planın Faz 3 ölçütleri. Pilot eforuyla sonraki tahmin yenilenir. |
| **Çok sayfalı ürün temeli** | Faz 4–5 | Gerçek build-time koleksiyon/pagination ve commerce veri ayrımı; blok kataloğu; Agency iç sayfaları; ikinci demo kararı ve reuse deneyi | Pagination JS’siz çalışır; sepet sayfa geçişinde korunur; seçilen demo paketi dış bağlantı sızdırmaz. |
| **Dağıtıma hazır v1** | Faz 6 | İki tam demo, release HTML + source + starter + doküman; kullanıcı-owned override sınırı; root/subpath/hosting, CSP, upgrade ve kalite kabulü | Temiz/tekrarlanabilir kurulum build’i; route/asset smoke; migration denemesi; release profil/metadata testi; ölçülmüş performans ve erişilebilirlik kabulü. |

## v1’de zorunlu iki tam demo

1. **Agency / corporate:** home, about, services, service detail, projects, project detail, contact ve 404.
2. **SaaS:** ikinci tam v1 demosu olarak ADR-006’da seçildi. Home, features, pricing, FAQ, blog, article ve auth bağlantıları kapsamda. Commerce korunmuş storefront örneği olarak kalır; tam paket sonraki kapasite kararına bağlıdır.

Seçilmeyen ikinci seçenek üçüncü demo gibi v1 teslimine otomatik eklenmez; kapasiteye bağlı çalışma olur. Mevcut `/commerce/` ve `/dashboard/` sayfaları korunmuş örnektir; tam demo kapsamını tek başına karşılamaz. Blueprint, içerikten üretilmiş instance, layout ve tema varyantı ayrı sayılır.

## Açıkça v1 dışında

React/Vue ve başka framework runtime’ları, client-side SPA router, Pug runtime render, micro-frontend, npm workspace bölme, visual page builder, service worker, tam CMS entegrasyonu, backend auth/ödeme/e-posta ve üçüncü tam demo. Bunlar somut ihtiyaç ve ölçüm olursa ayrı ADR/scope kararı ister.

## Efor tahmini ve yeniden tahmin

| Milestone | Plan tahmini |
| --- | ---: |
| Mimari pilot | 12–18 geliştirici iş günü; R01–R03 deneyleri ve K2 daraltması için ayrıca 2–4 gün |
| Çok sayfalı ürün temeli | 15–25 geliştirici iş günü |
| Dağıtıma hazır v1 | 8–15 geliştirici iş günü |
| Toplam | Yaklaşık 37–62 geliştirici iş günü |

Tahmin teslim sözü değildir. Mimari pilot sonunda manifest/watch, wrapper geçişi, tarayıcı kabulü ve dokümantasyon için gerçekleşen süreye göre yenilenir. Tasarım, içerik, backend ve marketplace incelemesi tahmine dahil değildir.

## Faz 0 belge durumu ve kalan kabul

| Faz 0 kabul maddesi | Durum |
| --- | --- |
| K1–K10 kararları ADR olarak kaydedildi | Bu doküman paketiyle tamamlandı; ADR-006 ikinci tam demo olarak SaaS’ı seçti. |
| Route/template/CSS/JS/layout envanteri ve bilinen link kusurları | Bu snapshot için belgelendi; baseline commit’ten bağımsız yeniden üretim değildir. |
| Dosya sahipliği ve veri önceliği | Hedef sahip ve alan kuralları yazıldı; uygulama Faz 1–6’da yapılır. |
| Demo/page/data profilleri ve v1 kapsamı | Profiller ve sayım birimleri tanımlandı; v1 demoları Agency ve SaaS’tır (ADR-006). |
| Başlangıç ölçümleri ve temiz baseline | Bu görevde yeniden üretilmedi. Planın mevcut inceleme ölçümleri kanıt eklerinde durur; ek uygulama değişiklikleri nedeniyle etiketli baseline’dan tekrar üretim ve çıktı snapshot’ı orchestrator sorumluluğundadır. |
| Çalışma ağacını baseline commit/tag yapmak, lockfile/Node politikasını uygulamak | Bu dokümantasyon görevinin dışında ve henüz yapılmış sayılmaz. Çalışma ağacında önceden var olan değişiklikler vardı; bu belge temiz tree veya baseline commit iddiası taşımaz. Orchestrator snapshot/commit sırasını mevcut değişiklikleri koruyarak yönetecektir. |

**Plan izleri:** §3, §5/Faz 0–6 ve planlama büyüklüğü, §6, §7, §11; inceleme raporu R14 ve R17.

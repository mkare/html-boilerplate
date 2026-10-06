# ADR-005 — Build ve teslim profilleri

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Plan K5'te dört ana build/teslim profili tanımlanır: `development`, `catalog-preview`, `customer-production` ve `release-html`. `release-html`, müşteri production içeriğinin okunabilir HTML üreten teslim varyantıdır; CSS/JS asset optimizasyonunu kapatmaz. Uygulama ayrıca beşinci bir build profili olan `starter` sağlar; bu ayrı bir HTML/asset teslim biçimi değil, production optimizasyonunu kullanan daraltılmış sayfa kapsamı ve `noindex,nofollow` politikasıdır. Production Sass çıktısı `sass-loader`'ın production varsayılanı olan `compressed` stiliyle üretilir; ayrıca CSS minimizer kullanılmaz.

## Profil sözleşmesi

| Profil                | Kullanım ve varsayılan metadata                                                                  | HTML / asset davranışı                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `development`         | Yerel geliştirme; `noindex,nofollow`                                                             | Okunabilir hata ayıklama çıktısı, development sourcemap ve hot reload                                                                    |
| `catalog-preview`     | Tema/demo kataloğu; `noindex,follow`; robots crawler’ın sayfayı okuyabilmesine izin verir        | Seçilen katalog sayfaları ve demo örnekleri; preview metadata’sı production’a taşınmaz                                                   |
| `customer-production` | Müşteri sitesi; sayfa metadata’sı varsayılan `index,follow`, sayfa bazlı robots istisnası mümkün | Production optimizasyonu, canonical gerçek yayın origin’iyle                                                                             |
| `starter`             | Seçilen demo için başlangıç kaynak paketi; `noindex,nofollow`                                    | `customer-production` ile aynı production HTML/asset optimizasyonu; yalnız starter işaretli sayfalar, açık bağımlılıklar ve sistem 404’ü |
| `release-html`        | Düzenlenebilir hazır HTML teslimi; customer-production sayfa kapsamı/SEO kurallarını devralır    | HTML boşlukları ve indent okunabilir; CSS/JS/font/görsel asset’ları production politikasıyla hash’li/minified kalır                      |

## Bağlam ve seçenekler

İnceleme, katalog preview’in arama indeksinden çıkarılmasıyla crawler’ın `noindex` sinyalini okuyabilmesi için sayfaya erişebilmesi gerektiğini; okunabilir HTML’nin ise source ile çalışmayacak müşteriye düzenleme kolaylığı verdiğini belirledi. Tek “production” bayrağı bu ayrı ihtiyaçları açıklamıyor.

Tamamen küçültülmüş HTML ile okunabilir HTML’nin ayrı, açık profil olması seçildi. Preview’i robots.txt ile tümüyle engellemek seçilmedi; bu `noindex` meta bilgisinin okunmasını engeller. Release için tüm asset’ları da okunabilir/optimizasyonsuz bırakmak seçilmedi; HTML düzenlenebilirliği bundan bağımsızdır.

## Sonuçlar

K5'in dört ana profili, uygulamadaki build profilleriyle `starter` sayfa-kapsamı varyantı eklenerek uygulanır. Her seçim build girdisi olur ve çıktıda audit edilebilir. Preview robots/canonical bilgileri production'a sızmamalı; HTML minification plugin sürümünde ayrıca sınanmalı, `pre`/`code`, attribute ve erişilebilir metin korunmalıdır. CSP inline tema başlangıç kodunu kapsayacak şekilde doğrulanır.

Sass çıktısı production build'inde zaten sıkıştırıldığı için ikinci bir CSS minimizer eklenmez; bu, aynı CSS üzerinde yinelenen optimizasyon ve ilave build maliyeti yaratır. Bu karar, mevcut CSS'in Sass girişlerinden derlendiği kapsam için geçerlidir. İleride Webpack'e Sass dışı CSS kaynakları eklenirse bunların üretim çıktısı ve gzip/Brotli boyutu ölçülür; ayrı minimizer ancak tekrarlanabilir ölçümle anlamlı ek kazanç gösterirse değerlendirilir. Gzip/Brotli boyutları teslim/transfer ölçümüdür ve kaynak minification kararının yerine geçmez.

`optimization.minimize` production profillerinde açıktır; Webpack'in varsayılan Terser davranışı JavaScript'i küçültür, CSS için bağımsız bir minimizer plugin'i tanımlı değildir. Üretim kabulü `qa/check-dist.cjs` ile gerçek CSS/JS dosyaları üzerinde yapılır; Sass paylaşımlı CSS boyutları ve release asset raporları ayrıca kayıt altına alınır.

## İzler

Plan §3/K5, §4.8–4.10, §5/Faz 1 ve Faz 6, §9; inceleme raporu R07 ve R13.

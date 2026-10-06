# ADR-004 — Demo ve bağlı form davranışı

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Demo form alanları başlangıçta disabled bir `<fieldset>` içinde olur ve yanında statik olarak bunun demo etkileşimi olduğunu açıklayan metin bulunur. İlgili controller başarıyla bağlandıktan sonra yalnız demo arayüzü etkinleştirir. Bağlı form gerçek `action` ve `method` kullanır; doğrulamanın ve işlemin otoritesi sunucudadır.

## Bağlam ve kanıt

Üç auth formunda `action="#" method="post"` kullanılıyor. Login controller’ı önce `Base()` çağırıyor, submit handler’ı daha sonra bağlıyor; temel runtime hatasında form tarayıcı tarafından gönderilebilir. Statik HTML teslimi gerçek hesap, e-posta veya sunucu doğrulaması sağlamaz.

## Değerlendirilen seçenekler

- **Disabled demo fieldset + açıklama — seçildi.** JavaScript çalışmazsa veya controller bağlanamazsa form ağ isteği başlatamaz ve kullanıcıya davranışın sınırı görünür.
- **`action="#"` ile formu etkin bırakmak — seçilmedi.** Görünürde çalışan bir form sunar ve yanlışlıkla sayfa navigasyonu/POST izlenimi doğurur.
- **Demo controller’ında sunucu işlemini taklit etmek — seçilmedi.** Statik paketin gerçekte sahip olmadığı backend yeteneğini ima eder.

## Sonuçlar

Demo başarı, alan hatası, genel hata, iptal ve bekleme durumları açıkça modellenebilir; gerçek entegrasyon adapter ve sunucu sözleşmesiyle eklenir. Kabulde JS yokken, JS hata verdiğinde ve storage erişilemediğinde istek yapılmadığı doğrulanır.

## İzler

Plan §3/K4, §2.4, §4.6, §5/Faz 3 ve §7 Auth; inceleme raporu R05.

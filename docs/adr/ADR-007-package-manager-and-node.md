# ADR-007 — Paket yöneticisi, Node ve lockfile

- **Durum:** Kabul edildi
- **Karar tarihi:** 2026-10-03
- **Karar:** Yarn Classic `1.22.22` tek paket yöneticisidir ve `yarn.lock` tek etkin lockfile’dır. Paket yöneticisi sürümü `package.json` içindeki `packageManager: "yarn@1.22.22"` alanıyla sabitlenir. Node.js `22.23.2` proje sürümüdür: `.nvmrc` bu tam sürümü, `package.json` `engines.node` ise `>=22.23.2 <23` aralığını belirtir. `package-lock.json`, baseline’dan ayrı ve izlenebilir bir değişiklikte kaldırılır.

## Bağlam ve kanıt

README Yarn komutlarını belgeliyor; kökte hem `package-lock.json` hem `yarn.lock` var ve inceleme anında Yarn lockfile daha yeniydi. Lockfile biçimi v1’dir; okuma anındaki `yarn --version` sonucu `1.22.22` olduğu için Yarn Classic seçimiyle uyumludur. İnceleme raporu Node `22.23.2` üzerinde aynı dependency ağacıyla build’in başarılı olduğunu kaydeder; Node `26.10.0` da yalnız deney ortamı olarak kullanılmış ve sürüm önerisi sayılmamıştır. Bu kayıt, 22 hattı için somut uyumluluk kanıtı sağlar.

## Değerlendirilen seçenekler

- **Yarn Classic 1.22.22 + `yarn.lock` — seçildi.** README, lockfile v1 biçimi ve gözlenen Yarn sürümüyle tutarlıdır.
- **npm + `package-lock.json` — seçilmedi.** README kullanımını ve mevcut daha yeni kilitli ağacı değiştirmeyi gerektirir.
- **İki lockfile’ı tutmak — seçilmedi.** Farklı çözüm ağaçları ve tekrarlanamaz kurulum riski bırakır.
- **Deney ortamındaki Node 26’yı pinlemek — seçilmedi.** Plan desteklenen LTS hattı ve doğrulanmış bağımlılık uyumu ister; inceleme bunu yalnız deney ortamı olarak tanımlar.

## Sonuçlar

Kurulum/build yönergeleri Yarn komutlarını esas alır. `package-lock.json` silme işi baseline’dan ayrı commit olarak yapılır; bu Phase 0 belge görevi commit oluşturmaz veya lockfile silmez. Node ve paket sürüm değişikliği ayrıca build kanıtıyla doğrulanır.

## İzler

Plan §3/K7, §2.1, §4.11, §5/Faz 0; inceleme raporu R17 ve doğrulama notları; v1 planı §14.3.

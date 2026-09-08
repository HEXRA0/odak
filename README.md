# Odak

Gelen yazılım taleplerini hızlıca kaydetmek, önceliklendirmek ve takip etmek için kişisel görev yönetimi uygulaması.

## Özellikler

- Gelen kutusu, bugün, beklemede ve tamamlanan görev filtreleri
- Liste ve sürükle-bırak Kanban görünümü
- Öncelik, son tarih, talep eden, proje, tahmini süre ve etiket alanları
- Görev değişiklik geçmişi
- Arşivleme ve geri yükleme
- Açık/koyu tema ve mobil uyum
- Netflix benzeri profil seçimi ve tarayıcıda profil hatırlama
- Admin/kullanıcı rolleri ve hesaplar arası görev atama
- Her çalışma ekranı için doğrudan açılabilen ayrı URL
- Yerel SQLite veritabanı

## Profiller ve yetkiler

- İlk çalıştırmada mevcut görevler otomatik oluşturulan `Yönetici` profiline bağlanır.
- Admin profilleri çalışma alanındaki tüm görevleri görebilir.
- Kullanıcı profilleri oluşturdukları ve kendilerine atanan görevleri görebilir.
- Bir görevin oluşturanı ve atanan kişisi farklı olabilir; her ikisi de görevi takip edebilir.
- Çıkış yapıldığında profil seçim ekranına dönülür. Parola kullanılmaz; bu yapı aynı bilgisayardaki kişisel/ekip içi kullanım içindir.

## Sayfa adresleri

- `/gelen-kutusu`
- `/bugun`
- `/tum-gorevler`
- `/beklemede`
- `/tamamlananlar`
- `/arsiv`
- `/profiller`

## Çalıştırma

En kolay yöntem: `baslat.cmd` dosyasına çift tıklayın. Tarayıcı otomatik açılır; uygulamayı kapatmak için açılan komut penceresini kapatın.

Geliştirme yapmak için:

```powershell
pnpm install
pnpm dev
```

Geliştirme adresi: `http://127.0.0.1:5173`

Üretim çalıştırması:

```powershell
pnpm build
pnpm start
```

Üretim adresi: `http://127.0.0.1:4173`

Veriler `data/tasks.db` dosyasında saklanır. Yedek almak için uygulama kapalıyken bu dosyayı kopyalamak yeterlidir.

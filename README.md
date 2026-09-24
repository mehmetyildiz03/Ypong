# YPONG

YPONG, klasik Pong fikrini telefon ve tablet için yeniden yorumlayan, dikey oyun alanına sahip modern bir arcade oyunudur.

## v0.2 temeli

- Üst/alt yatay raket düzeni
- Dokunma ve sürükleme kontrolü
- Klavye desteği
- CPU ve aynı cihazda 2 oyuncu modu
- Üç CPU zorluğu
- Vuruş noktasına ve raket hızına bağlı top açısı
- Kademeli top hızlanması
- Sabit zaman adımlı fizik
- Parçacık, top izi ve ekran sarsıntısı
- Web Audio ile hafif arcade sesleri
- Responsive mobil/tablet arayüzü
- GitHub Pages otomatik dağıtımı
- Basit offline runtime cache

## Geliştirme

```bash
npm install
npm run dev
```

Üretim kontrolü:

```bash
npm run build
```

## Kontroller

- **CPU modu:** Dokun/sürükle veya `A / D`
- **2 oyuncu:** Alt oyuncu `A / D`, üst oyuncu `← / →`
- Dokunmatik 2 oyuncuda ekranın üst ve alt yarısı ayrı raketi kontrol eder.
- `Esc` veya boşluk: duraklat

İlk kazanan 7 sayıya ulaşır.


## v0.2 düzeltmeleri

- YPONG service worker cache'i yalnızca YPONG cache'lerini temizler.
- Oyun alanı telefonun kullanılabilir yüksekliğine göre dinamik fizik dünyası kullanır.
- Skor HUD'ı oyuncuları CPU/SEN veya ÜST/ALT olarak açıkça gösterir.
- Dokunmatik raket tepkisi hızlandırıldı.
- Vuruş sonrası top hızı ve maksimum çıkış açısı normalize edildi.
- CPU hata payı her gelen top için tutarlı hale getirildi.


## v0.3 — Arena Systems

- Maç başında orta bölgede nötr, dairesel bir bumper oluşturulur.
- Bumper bonus vermez; top gerçek yüzey normaliyle sekerek yön değiştirir.
- Güç noktaları 5.5–8.5 saniyelik aralıklarla, aynı anda en fazla bir tane olacak şekilde doğar.
- Güç noktaları topun ve bumper'ın güvenli mesafesinde oluşturulur.
- **WIDE:** Son vuran oyuncunun raketini 6.5 saniye boyunca %35 büyütür.
- **SHRINK:** Son vuran oyuncunun rakibini 6.5 saniye boyunca %30 küçültür.
- **SLOW:** Topu 4.5 saniye boyunca %28 yavaşlatır ve süre bitince nominal hıza geri döndürür.
- Topa son dokunan oyuncu takip edilir; güç puan/şans yoluyla değil, topu düğüme gerçekten isabet ettirerek kazanılır.
- Güç noktaları parlak ve etiketli; nötr bumper ise arena geometrisinin mat bir parçası olarak çizilir.

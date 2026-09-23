# YPONG

YPONG, klasik Pong fikrini telefon ve tablet için yeniden yorumlayan, dikey oyun alanına sahip modern bir arcade oyunudur.

## v0.1 hedefi

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

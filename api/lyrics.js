import { JSDOM } from "jsdom";

// Genius scraping fonksiyonu (Python'daki mantık)
async function fetchLyricsFromGenius(artist, song) {
  const query = encodeURIComponent(`${artist} ${song}`);
  const searchUrl = `https://genius.com/search?q=${query}`;

  try {
    // Genius arama sayfasını fetch et
    const searchHtmlRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const searchHtml = await searchHtmlRes.text();
    const searchDom = new JSDOM(searchHtml);
    const document = searchDom.window.document;

    // İlk şarkı linkini bul
    const firstLinkEl = document.querySelector("a.song_link");
    if (!firstLinkEl) return null;
    const songUrl = firstLinkEl.href;

    // Şarkı sayfasını çek
    const songHtmlRes = await fetch(songUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const songHtml = await songHtmlRes.text();
    const songDom = new JSDOM(songHtml);
    const songDocument = songDom.window.document;

    // Lyrics divlerini bul
    const lyricsDivs = songDocument.querySelectorAll("div[class^='Lyrics__Container'], div.lyrics");

    let lyrics = "";
    lyricsDivs.forEach(div => {
      lyrics += div.textContent + "\n";
    });

    return lyrics.trim() || null;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Sadece POST destekleniyor." });
    }

    const { music_name, dev } = req.body;

    if (!music_name || !dev) {
      return res.status(400).json({ success: false, error: "music_name ve dev zorunlu." });
    }

    if (dev !== "texastr") {
      return res.status(403).json({ success: false, error: "Geçersiz dev değeri." });
    }

    // artist + song ayrımı yapabiliriz, yoksa tüm string ile çalışıyor
    let artist = "";
    let song = "";
    const parts = music_name.split(" ");
    if (parts.length >= 2) {
      artist = parts[0];
      song = parts.slice(1).join(" ");
    } else {
      artist = music_name;
      song = music_name;
    }

    const lyrics = await fetchLyricsFromGenius(artist, song);

    if (!lyrics) {
      return res.status(404).json({ success: false, error: "Şarkı bulunamadı." });
    }

    return res.status(200).json({
      success: true,
      data: {
        music_name,
        lyrics
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: "Sunucu hatası", detail: err.message });
  }
}

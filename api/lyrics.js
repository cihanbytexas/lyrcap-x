import { JSDOM } from "jsdom";

// Genius scraping fonksiyonu
async function fetchLyricsFromGenius(songQuery) {
  const query = encodeURIComponent(songQuery);
  const searchUrl = `https://genius.com/api/search/song?q=${query}`;

  // Genius API isteği için User-Agent ekle
  const searchRes = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });

  const searchData = await searchRes.json();

  const hits = searchData.response.sections[0].hits;
  if (!hits.length) return null;

  const songUrl = hits[0].result.url;
  const htmlRes = await fetch(songUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  const html = await htmlRes.text();

  const dom = new JSDOM(html);
  const divs = dom.window.document.querySelectorAll("div[class^='Lyrics__Container'], div.lyrics");

  let lyrics = "";
  divs.forEach(div => {
    lyrics += div.textContent + "\n";
  });

  return lyrics.trim() || null;
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

    // Genius scraping
    const lyrics = await fetchLyricsFromGenius(music_name);

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

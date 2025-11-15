import { JSDOM } from "jsdom";

// Genius scraping fonksiyonu
async function fetchLyricsFromGenius(music_name) {
  const query = encodeURIComponent(music_name);
  const searchUrl = `https://api.genius.com/search?q=${query}`;

  const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
  if (!GENIUS_API_KEY) throw new Error("GENIUS_API_KEY .env dosyasında tanımlı değil.");

  const headers = {
    Authorization: `Bearer ${GENIUS_API_KEY}`
  };

  // Genius API ile arama
  const searchRes = await fetch(searchUrl, { headers });
  if (!searchRes.ok) throw new Error(`Genius API Error: ${searchRes.status}`);

  const searchData = await searchRes.json();
  const hits = searchData.response.hits;
  if (!hits.length) return null;

  const songUrl = hits[0].result.url;

  // Lyrics sayfasını çek
  const htmlRes = await fetch(songUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  const html = await htmlRes.text();

  const dom = new JSDOM(html);
  const divs = dom.window.document.querySelectorAll("div[class^='Lyrics__Container'], div.lyrics");

  let lyrics = "";
  divs.forEach(div => (lyrics += div.textContent + "\n"));

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

import { JSDOM } from "jsdom";

async function fetchLyricsFromGenius(music_name) {
  const query = encodeURIComponent(music_name);
  const searchUrl = `https://api.genius.com/search?q=${query}`;

  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) throw new Error("GENIUS_ACCESS_TOKEN tanımlı değil.");

  const headers = {
    Authorization: `Bearer ${token}`
  };

  // ► 1) GENIUS ARAMA
  const searchRes = await fetch(searchUrl, { headers });

  if (!searchRes.ok) {
    throw new Error(`Genius API Hatası: ${searchRes.status} (${await searchRes.text()})`);
  }

  const searchData = await searchRes.json();
  const hits = searchData.response.hits;

  if (!hits || hits.length === 0) return null;

  const songUrl = hits[0].result.url;

  // ► 2) GENIUS LYRICS SAYFASINI ÇEKME
  const htmlRes = await fetch(songUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const html = await htmlRes.text();
  const dom = new JSDOM(html);

  // ► 3) Lyrics DOM seçimleri
  let containers = dom.window.document.querySelectorAll("div[class^='Lyrics__Container']");
  if (!containers.length) {
    containers = dom.window.document.querySelectorAll(".lyrics");
  }

  // ► 4) Eğer hala yoksa fallback regex (Genius CF koruması için)
  if (!containers.length) {
    const regex = /<div[^>]*>([^<]+)<\/div>/g;
    let match;
    let fallback = "";

    while ((match = regex.exec(html)) !== null) {
      fallback += match[1] + "\n";
    }

    return fallback.trim() || null;
  }

  // ► 5) Lyrics dizme
  let lyrics = "";
  containers.forEach(div => {
    lyrics += div.textContent.trim() + "\n\n";
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
    return res.status(500).json({
      success: false,
      error: "Sunucu hatası",
      detail: err.message
    });
  }
}

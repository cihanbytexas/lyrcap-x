export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Sadece POST destekleniyor." });
    }

    const { music_name, dev } = req.body;

    if (!music_name || !dev)
      return res.status(400).json({ success: false, error: "music_name ve dev zorunlu." });

    if (dev !== "texastr")
      return res.status(403).json({ success: false, error: "Geçersiz dev değeri." });

    const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
    if (!GENIUS_API_KEY)
      return res.status(500).json({ success: false, error: "GENIUS_API_KEY eksik." });

    // 1️⃣ GENIUS SEARCH → SONG URL AL
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(music_name)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${GENIUS_API_KEY}` }
    });

    if (!searchRes.ok)
      return res.status(500).json({ success: false, error: "Genius API hatası", status: searchRes.status });

    const searchData = await searchRes.json();

    const hits = searchData?.response?.sections?.[0]?.hits || [];
    if (!hits.length)
      return res.status(404).json({ success: false, error: "Şarkı bulunamadı." });

    const geniusUrl = hits[0].result.url;

    // 2️⃣ TEXTISE → SONG LYRICS CAPTCHA BYPASS
    const textiseUrl = `https://textise.net/showtext.aspx?strURL=${encodeURIComponent(geniusUrl)}`;

    const textiseRes = await fetch(textiseUrl);
    const text = await textiseRes.text();

    // Lyrics ayıklama
    const cleanLyrics = text
      .replace(/<[^>]*>/g, "")         // HTML temizle
      .replace(/\s{2,}/g, "\n")        // çift boşluk yerine yeni satır
      .trim();

    return res.status(200).json({
      success: true,
      data: {
        music_name,
        lyrics: cleanLyrics
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: "Sunucu hatası", detail: err.message });
  }
}

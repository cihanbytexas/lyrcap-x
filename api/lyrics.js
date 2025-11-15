import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST kullan." });
  }

  const { music_name } = req.body;

  if (!music_name) {
    return res.status(400).json({ success: false, error: "music_name gerekli." });
  }

  try {
    // Puppeteer HEADLESS browser (Cloudflare bypass)
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto(`https://genius.com/search?q=${encodeURIComponent(music_name)}`, {
      waitUntil: "networkidle2"
    });

    // İlk şarkı linkini çek
    const songUrl = await page.evaluate(() => {
      const el = document.querySelector("amini-card");
      return el ? el.href : null;
    });

    if (!songUrl) {
      await browser.close();
      return res.status(404).json({ success: false, error: "Şarkı bulunamadı." });
    }

    // Şarkı sözleri sayfasına git
    await page.goto(songUrl, { waitUntil: "networkidle2" });

    const rawLyrics = await page.evaluate(() => {
      const el = document.querySelector("[data-lyrics-container]");
      return el ? el.innerText : null;
    });

    await browser.close();

    if (!rawLyrics) {
      return res.status(404).json({ success: false, error: "Söz bulunamadı." });
    }

    // Cloudflare yazısı gelirse iptal
    if (rawLyrics.includes("Sorry, we have to make sure you're a human")) {
      return res.status(429).json({
        success: false,
        error: "Cloudflare engelledi. Tekrar dene."
      });
    }

    // Lyrics temizleme
    let cleanLyrics = rawLyrics
      .replace(/\[.*?\]/g, "") // [Chorus] vs temizle
      .trim();

    // Çok uzun ise Discord için kısalt
    if (cleanLyrics.length > 1800) {
      cleanLyrics = cleanLyrics.slice(0, 1800) + "\n\n(…devamı çok uzun olduğu için kesildi)";
    }

    return res.status(200).json({
      success: true,
      data: {
        music_name,
        lyrics: cleanLyrics
      }
    });

  } catch (err) {
    console.error("API Hatası:", err);
    return res.status(500).json({ success: false, error: "Sunucu hatası." });
  }
}

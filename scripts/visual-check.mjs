import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const cases = [
  { name: "home-desktop", path: "/", width: 1440, height: 900 },
  { name: "home-mobile", path: "/", width: 390, height: 844 },
  { name: "pricing-desktop", path: "/pricing", width: 1440, height: 900 },
  { name: "login-mobile", path: "/login", width: 390, height: 844 },
];
for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://localhost:3000${item.path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `artifacts/${item.name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${item.name}: title=${await page.title()} overflow=${overflow} errors=${errors.length ? errors.join(" | ") : "none"}`);
  await page.close();
}
await browser.close();

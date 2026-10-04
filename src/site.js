import { BRAND, BUILDINGS } from './content.js';
import { captureAttribution, initAnalytics } from './attribution.js';

captureAttribution();
initAnalytics();

const $ = (id) => document.getElementById(id);

// ---------- Classic site (the scrolling page under the landing hero) ----------
function buildClassic() {
  const el = $('classicSite');
  const works = BUILDINGS.filter((b) => b.url || b.kind);
  el.innerHTML = `
    <nav class="c-nav"><b>BOLT YARDS</b><div class="c-nav-actions"><a class="btn small" href="/contact.html">Contact us</a><button class="btn small" id="toWorld">Drive through our world →</button></div></nav>
    <section class="c-section" id="what"><h2>What we do</h2>
      <div class="c-grid">
        <div class="c-card"><h3>SaaS</h3><p>Custom software products and internal systems, from first prototype to a platform that runs the business.</p></div>
        <div class="c-card"><h3>Websites</h3><p>Fast, clean websites built to convert, for businesses, NGOs and everyone in between.</p></div>
        <div class="c-card"><h3>Ad Campaigns</h3><p>Performance campaigns that bring the right customers to the right door.</p></div>
      </div>
    </section>
    <section class="c-section"><h2>Our work</h2>
      <div class="c-grid">${works.map((b) => `
        <${b.url ? `a href="${b.url}" target="_blank" rel="noopener"` : 'div'} class="c-card">
          <span class="tag-chip">${b.kind}</span><h3>${b.title}</h3><p>${b.body}</p>
        </${b.url ? 'a' : 'div'}>`).join('')}
      </div>
    </section>
    <section class="c-section"><h2>Founder</h2><div class="c-card" style="max-width:640px"><h3>Aditya Reddy</h3><p>${BUILDINGS.find((b) => b.id === 'about').body}</p></div></section>
    <footer class="c-foot" id="contact">
      <h2 style="letter-spacing:.35em;font-size:12px;color:#fdc20b;margin-bottom:20px">CONTACT</h2>
      <p style="margin-bottom:18px;font-size:20px;font-weight:600">Have a project in mind?</p>
      <a class="btn c-cta" href="/contact.html">Send us a message →</a>
      <div style="height:22px"></div>
      <p><a href="tel:${BRAND.phone}">${BRAND.phone}</a></p>
      <p><a href="mailto:${BRAND.email}">${BRAND.email}</a></p>
      <p>${BRAND.address}</p>
      <div class="c-legal"><span>© ${new Date().getFullYear()} Bolt Yards</span><a href="/privacy.html">Privacy Policy</a><a href="/terms.html">Terms of Service</a></div>
    </footer>`;
}
buildClassic();

buildClassic();
$('classic').onclick = () => $('what').scrollIntoView({ behavior: 'smooth' });

// ---------- The game (loaded in the background; same on desktop and mobile) ----------
let loaded = false;
const load = () => import('./main.js').then(() => { loaded = true; });
const game = new Promise((res) => {
  const go = () => load().then(res);
  // let the page paint first, then fetch the 3D code
  ('requestIdleCallback' in window) ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300);
});
const enter = async () => {
  if (!loaded) await game; // normally already loaded; otherwise wait for it
  window.dispatchEvent(new Event('by:enter-game'));
};
$('start').onclick = enter;
$('toWorld').onclick = enter;

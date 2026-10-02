import { BRAND, BUILDINGS } from './content.js';

const $ = (id) => document.getElementById(id);

// ---------- Classic site (the scrolling page under the landing hero) ----------
function buildClassic() {
  const el = $('classicSite');
  const works = BUILDINGS.filter((b) => b.url || b.kind);
  el.innerHTML = `
    <nav class="c-nav"><b>BOLT YARDS</b><button class="btn small" id="toWorld">Drive through our world →</button></nav>
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
      <p><a href="tel:${BRAND.phone}">${BRAND.phone}</a></p>
      <p><a href="mailto:${BRAND.email}">${BRAND.email}</a></p>
      <p>${BRAND.address}</p>
    </footer>`;
}
buildClassic();

buildClassic();
$('classic').onclick = () => $('what').scrollIntoView({ behavior: 'smooth' });

// ---------- The game is desktop-only ----------
const isMobile =
  matchMedia('(pointer: coarse)').matches ||
  innerWidth < 700 ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

if (isMobile) {
  // no 3D code, model or audio is ever downloaded on phones/tablets
  document.documentElement.classList.add('no-game');
  $('intro').classList.add('ready');
} else {
  const game = import('./main.js');
  $('toWorld').onclick = async () => {
    await game;
    window.dispatchEvent(new Event('by:enter-game'));
  };
}

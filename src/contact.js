import { BRAND } from './content.js';
import { captureAttribution, attributionFields, initAnalytics } from './attribution.js';

captureAttribution();
initAnalytics();

// Enquiries are emailed to the Bolt Yards inbox through FormSubmit (https://formsubmit.co).
// The first ever submission asks the inbox owner to click an activation link.
const ENDPOINT = `https://formsubmit.co/ajax/${BRAND.email}`;

const $ = (id) => document.getElementById(id);
const form = $('contactForm');
const statusEl = $('status');
const submitBtn = $('submit');
$('year').textContent = new Date().getFullYear();

// A hint that changes with the service, so people know what to include in their brief
const HINTS = {
  'Website development': 'e.g. What is the business? How many pages? Do you need booking, a shop or a blog? Any websites you like?',
  SaaS: 'e.g. What problem should the product solve? Who will use it? Any must-have features, or an existing prototype?',
  Automation: 'e.g. Which task is slow or manual today? Which tools or portals are involved? How often does it run?',
  'Social media ad campaigns': 'e.g. Which platforms (Instagram, Facebook, Google, YouTube)? What are you selling, who is your ideal customer and what monthly ad budget do you have in mind?',
  Others: 'Tell us what you have in mind and we’ll tell you honestly if we’re the right fit.',
};
const message = $('message');
$('service').addEventListener('change', (e) => {
  message.placeholder = HINTS[e.target.value] || message.placeholder;
});

// A preselected service via /contact.html?service=SaaS
const preset = new URLSearchParams(location.search).get('service');
if (preset && HINTS[preset]) { $('service').value = preset; message.placeholder = HINTS[preset]; }

const count = $('count');
message.addEventListener('input', () => { count.textContent = message.value.length; });

// ----- validation -----
const RULES = {
  name: (v) => (v.trim().length < 2 ? 'Please enter your name.' : ''),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
  phone: (v) => (/^\+?[0-9][0-9\s\-()]{6,17}$/.test(v.trim()) ? '' : 'Please enter a valid phone number.'),
  service: (v) => (v ? '' : 'Please choose a service.'),
  message: (v) => (v.trim() ? '' : 'Please tell us briefly what you need.'),
};
function check(name) {
  const el = form.elements[name];
  const msg = RULES[name](el.value);
  el.closest('.field').classList.toggle('invalid', !!msg);
  form.querySelector(`.err[data-for="${name}"]`).textContent = msg;
  return !msg;
}
Object.keys(RULES).forEach((n) => {
  form.elements[n].addEventListener('blur', () => check(n));
  form.elements[n].addEventListener('input', () => { if (form.elements[n].closest('.field').classList.contains('invalid')) check(n); });
});

function setStatus(text, isError) {
  statusEl.className = 'status' + (isError ? ' error' : '');
  statusEl.innerHTML = text;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');
  const ok = Object.keys(RULES).map(check).every(Boolean);
  if (!ok) {
    form.querySelector('.field.invalid')?.querySelector('input,select,textarea')?.focus();
    return;
  }
  // bots fill the hidden field; pretend it worked and send nothing
  if (form.elements._honey.value) return showThanks();

  // stop accidental double submits
  let last = 0;
  try { last = +localStorage.getItem('by-contact-last') || 0; } catch { /* ignore */ }
  if (Date.now() - last < 20000) return setStatus('Your message was just sent. Please wait a moment before sending another.', true);

  const v = (n) => form.elements[n].value.trim();
  const payload = {
    name: v('name'),
    email: v('email'),
    phone: v('phone'),
    company: v('company') || '-',
    service: v('service'),
    budget: v('budget') || 'Not specified',
    timeline: v('timeline') || 'Flexible',
    message: v('message'),
    ...attributionFields(), // where this visitor came from (e.g. reddit / social / r_webdev)
    _subject: `New enquiry (${v('service')}) from ${v('name')}`,
    _template: 'table',
    _captcha: 'false',
    _autoresponse: `Hi ${v('name')}, thanks for contacting Bolt Yards! We have received your enquiry about ${v('service')} and will get back to you shortly. If it is urgent, call us on ${BRAND.phone}. - Team Bolt Yards`,
  };

  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'Sending…';
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === 'false' || data.success === false) throw new Error(data.message || 'Request failed');
    try { localStorage.setItem('by-contact-last', String(Date.now())); } catch { /* ignore */ }
    showThanks(payload);
  } catch {
    setStatus(`We couldn’t send your message just now. Please try again, or reach us on <a href="tel:${BRAND.phone}">${BRAND.phone}</a> or <a href="mailto:${BRAND.email}">${BRAND.email}</a>.`, true);
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'Send message';
  }
});

function showThanks(p) {
  const name = p ? p.name.split(' ')[0] : '';
  $('formCard').innerHTML = `
    <div class="thanks">
      <div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
      <h2>Thank you${name ? ', ' + name.replace(/[<>&"]/g, '') : ''}!</h2>
      <p>We’ve received your message and will get back to you shortly, usually within one working day. A confirmation has been sent to your email.</p>
      <a class="btn dark" href="/">Back to home</a>
    </div>`;
  $('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

import { initAnalytics } from './attribution.js';

initAnalytics();
document.getElementById('year').textContent = new Date().getFullYear();

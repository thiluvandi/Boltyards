export const BRAND = {
  name: 'Bolt Yards',
  tagline: 'We build digital systems that scale.',
  sub: 'Tech for a brighter tomorrow',
  phone: '8050923559',
  email: 'boltyardsindia@gmail.com',
  address: '#243, 5th A Main, Gnanabharthi Layout, Kengeri S.T, Bengaluru - 560059',
};

// Each building: world position (x, z), footprint (w, d), height, content for the panel.
export const BUILDINGS = [
  {
    id: 'services',
    sign: 'WHAT WE DO',
    title: 'SaaS · Websites · Ad Campaigns',
    pos: [0, -78],
    size: [26, 18, 16],
    body:
      'We build digital systems that scale: custom SaaS products, fast conversion-focused websites, and ad campaigns that bring in the right customers.',
    tags: ['SaaS', 'Websites', 'Ad Campaigns'],
  },
  {
    id: 'golden-timbers',
    sign: 'GOLDEN TIMBERS',
    title: 'Golden Timbers',
    kind: 'Website · Demo',
    pos: [66, -46],
    size: [20, 14, 13],
    body:
      'A demo website for a timber milling company on Mysore Road, Bengaluru. Showcases products, grades and enquiry flow.',
    tags: ['Website', 'Demo'],
    url: 'https://golden-timbers.vercel.app',
  },
  {
    id: 'unnathi',
    sign: 'UNNATHI CREATIVES',
    title: 'Unnathi Creatives',
    kind: 'Website · Shipped',
    pos: [80, 14],
    size: [20, 16, 13],
    body: 'A fully shipped, live website for an NGO, built to tell their story and drive support.',
    tags: ['Website', 'NGO', 'Live'],
    url: 'https://unnathicreatives.org.in',
  },
  {
    id: 'csg-crm',
    sign: 'CSG CRM',
    title: 'CSG CRM',
    kind: 'SaaS · ERP',
    pos: [50, 66],
    size: [22, 18, 18],
    body: 'An end-to-end ERP system for a CA firm: clients, work tracking and operations in one place.',
    tags: ['SaaS', 'ERP', 'CA firm'],
    url: 'https://csg-crm.vercel.app',
  },
  {
    id: 'csg-gst',
    sign: 'GST RECON',
    title: 'Annual GST Reconciliation Tool',
    kind: 'Automation · On request',
    pos: [-50, 66],
    size: [22, 18, 14],
    body: 'An automated annual GST reconciliation tool, built on request to replace hours of manual matching.',
    tags: ['Automation', 'GST', 'Finance'],
    url: 'https://csg-gst.vercel.app',
  },
  {
    id: 'gstr-ext',
    sign: 'GSTR DOWNLOADER',
    title: 'GSTR Downloader',
    kind: 'Chrome Extension',
    pos: [-80, 14],
    size: [20, 16, 13],
    body: 'A Chrome extension that automates downloading GSTR returns, turning a repetitive portal chore into one click.',
    tags: ['Chrome Extension', 'Automation', 'GST'],
  },
  {
    id: 'about',
    sign: 'THE FOUNDER',
    title: 'Aditya Reddy, Founder',
    pos: [-66, -46],
    size: [20, 14, 13],
    body:
      'Bolt Yards is led by Aditya Reddy, with one goal: build digital systems that scale for businesses, from the first prototype to the day it runs the whole firm.',
    tags: ['Founder', 'Bengaluru'],
  },
];

export const CONTACT = {
  id: 'contact',
  sign: 'CONTACT',
  title: 'Let’s build something',
  pos: [0, 90],
  size: [24, 14, 14],
  body: 'Tell us what you want to build. We reply fast.',
  tags: [],
  contact: true,
};

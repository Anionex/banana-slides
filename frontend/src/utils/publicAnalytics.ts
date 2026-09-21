export function initializePublicAnalytics(): void {
  if (import.meta.env.PROD && !document.querySelector('[data-public-analytics]')) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://cloud.umami.is/script.js';
    script.dataset.websiteId = '6bb8b6f0-f744-4111-9745-60791fac53b0';
    script.dataset.publicAnalytics = 'true';
    document.head.appendChild(script);
  }
}

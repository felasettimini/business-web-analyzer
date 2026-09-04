/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // puppeteer-extra-plugin-stealth arrastra clone-deep/merge-deep, que usan require()
  // dinamico que webpack no puede analizar estaticamente — se excluyen del bundle y se
  // resuelven como modulos de Node normales en runtime (funcionan igual, solo no se bundlean).
  serverExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
};

module.exports = nextConfig;

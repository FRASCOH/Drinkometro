import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Drinkometro',
    short_name: 'Drinkometro',
    description: 'Traccia i tuoi drink, condividi con gli amici, sfida il tuo club! 🍹',
    start_url: '/home',
    display: 'standalone',
    background_color: '#06060f',
    theme_color: '#8b5cf6',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
        ],
    },
    transpilePackages: ['@genkit-ai/core', '@genkit-ai/ai', '@genkit-ai/flow', '@genkit-ai/googleai'],
    experimental: {
        // Paquetes de servidor que no deben empaquetarse (pagos CoDi e importación de inventario)
        serverComponentsExternalPackages: ['firebase-admin', 'pdf-parse', 'qrcode'],
    },
}

module.exports = nextConfig


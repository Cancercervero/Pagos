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
}

module.exports = nextConfig


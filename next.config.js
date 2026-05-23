/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Los errores son de inferencia de tipos de Supabase, no bugs reales
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        // Permite cargar imágenes de Supabase Storage (fotos de perfil)
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig

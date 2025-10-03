import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: process.env.NODE_ENV === 'production' 
          ? ['@babel/plugin-transform-react-jsx-development']
          : []
      }
    })
  ],
  
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },

  root: path.resolve(import.meta.dirname, "client"),
  
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false, // Disable source maps in production for security
    minify: 'terser',
    
    rollupOptions: {
      output: {
        // Chunk splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['wouter'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip'
          ],
          query: ['@tanstack/react-query'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        },
        
        // Naming pattern for assets
        assetFileNames: (assetInfo) => {
          const info = (assetInfo.name || '').split('.');
          const ext = info[info.length - 1];
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        // Chunk naming
        chunkFileNames: (chunkInfo) => {
          // Use stable names if hash is disabled
          if (process.env.VITE_DISABLE_BUILD_HASH === 'TRUE') {
            return `assets/[name].js`;
          }
          return `assets/[name]-[hash].js`;
        },
        
        // Entry file naming
        entryFileNames: (chunkInfo) => {
          if (process.env.VITE_DISABLE_BUILD_HASH === 'TRUE') {
            return `assets/[name].js`;
          }
          return `assets/[name]-[hash].js`;
        }
      }
    },
    
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    
    // Size warnings
    chunkSizeWarningLimit: 1000,
    
    // Asset inlining threshold
    assetsInlineLimit: 4096
  },

  // CSS optimization
  css: {
    devSourcemap: false,
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('cssnano')({
          preset: 'default'
        })
      ]
    }
  },
  
  // Define globals for production
  define: {
    __DEV__: false,
    __PROD__: true,
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  
  // Server configuration for preview
  preview: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'wouter',
      '@tanstack/react-query'
    ],
    exclude: ['@shared/schema']
  }
});

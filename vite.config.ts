
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /\/node_modules\/@firebase\/firestore/ },
            { name: 'firebase-auth', test: /\/node_modules\/@firebase\/auth/ },
            { name: 'firebase', test: /\/node_modules\/(?:@firebase|firebase)\// },
            { name: 'motion', test: /\/node_modules\/framer-motion\// },
            { name: 'react-vendor', test: /\/node_modules\/(?:react|react-dom|react-router|react-router-dom)\// },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
  }
})

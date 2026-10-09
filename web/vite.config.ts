import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev only: a running Battleship.Client serves /ws on its webPort (CLI-0).
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } },
    // replay.ts reads the golden transcript from ../tests/fixtures.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../tests/fixtures'] },
  },
})

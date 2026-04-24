import { AppProvider } from '@/lib/store'
import App from '@/components/App'

export default function Home() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  )
}

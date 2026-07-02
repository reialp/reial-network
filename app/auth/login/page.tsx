import dynamic from 'next/dynamic'

// This tells Next.js to skip prerendering this page during build
const LoginClient = dynamic(() => import('./LoginClient'), {
  ssr: false,
})

export default function LoginPage() {
  return <LoginClient />
}

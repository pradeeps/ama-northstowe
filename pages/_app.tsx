import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>AMA Northstowe - Your Local Community Assistant</title>
        <meta name="description" content="Ask questions about Northstowe - local services, events, transport, and community information." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="AMA Northstowe" />
        <meta property="og:description" content="Ask questions about Northstowe - local services, events, transport, and community information." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="AMA Northstowe" />
        <meta name="twitter:description" content="Ask questions about Northstowe - local services, events, transport, and community information." />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

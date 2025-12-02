import '../styles/globals.css';
import Script from 'next/script';

function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Load WASM globally for the whole app */}
      <Script 
        src="/wasm_keygen.js" 
        strategy="beforeInteractive"
        onLoad={() => {
          console.log("WASM Script Loaded. Initializing...");
        }}
      />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
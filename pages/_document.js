import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/*
          The Emscripten glue is loaded once, here, as a plain deferred script.

          `next/script` is deliberately not used: its `beforeInteractive`
          strategy is only honoured in _document (declaring it in _app silently
          did nothing) and it additionally re-injects the script through the
          Next.js runtime, executing this non-idempotent glue twice. A second
          execution redeclares its internals and aborts the module.
        */}
        <script src="/wasm_keygen.js" defer />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

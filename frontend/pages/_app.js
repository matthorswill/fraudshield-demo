import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/tailwind.css';
import '../styles/globals.css';
import { useEffect } from 'react';
import PageTransition from '../components/PageTransition';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  useEffect(() => { import('bootstrap/dist/js/bootstrap.bundle.min.js').catch(() => {}); }, []);
  return (
    <Layout>
      <PageTransition route={router.asPath}>
        <Component {...pageProps} />
      </PageTransition>
    </Layout>
  );
}

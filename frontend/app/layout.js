import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/tailwind.css';
import '../styles/globals.css';
import Layout from '../components/Layout';
import Providers from './providers.jsx';

export const metadata = {
  title: 'FraudShield',
  description: 'Banking-grade fraud & AML toolkit',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <Layout>
          <Providers>
            {children}
          </Providers>
        </Layout>
      </body>
    </html>
  );
}


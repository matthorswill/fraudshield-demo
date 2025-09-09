import Link from 'next/link';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  return (
    <div className="fs-shell">
      <Sidebar />
      <div className="fs-main">
        <Topbar />
        <main className="container">
          {children}
        </main>
      </div>
    </div>
  );
}

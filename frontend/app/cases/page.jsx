import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const Board = dynamic(() => import('../../components/kanban/Board'), { ssr: false });

export default function Page(){
  return (
    <>
      <h1 className="page-title">Cases</h1>
      <Board />
    </>
  );
}


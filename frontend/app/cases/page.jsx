export const dynamic = 'force-dynamic';
import Board from '../../components/kanban/Board';

export default function Page(){
  return (
    <>
      <h1 className="page-title">Cases</h1>
      <Board />
    </>
  );
}

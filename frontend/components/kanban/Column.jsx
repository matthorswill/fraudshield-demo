"use client";
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import CaseCard from './CaseCard';

export default function Column({ title, status, items, onOpen }){
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const sum = (items||[]).reduce((s,c)=> s + Number(c.amount||0), 0);
  return (
    <motion.div ref={setNodeRef} className={`rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 ${isOver?'ring-2 ring-indigo-500':''}`} layout>
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white/90">{title}</div>
        <div className="text-xs text-white/60">{items?.length||0} • € {sum.toLocaleString()}</div>
      </div>
      <div className="mt-2 grid gap-2">
        {(items||[]).map(c => (<CaseCard key={c.id} c={c} onOpen={onOpen} />))}
      </div>
    </motion.div>
  );
}


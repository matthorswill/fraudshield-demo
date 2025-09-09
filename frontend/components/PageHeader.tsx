"use client";
import { motion } from 'framer-motion';

type Pill = { label: string; count: number };

function SegmentCard({ label, count }:{ label:string; count:number }){
  return (
    <div className="bg-white/10 rounded-2xl ring-1 ring-white/10 px-6 py-4 flex items-center gap-4">
      <span className="bg-[var(--primary)] text-[#1F2937] rounded-md px-3 py-1 text-sm font-semibold">{count}</span>
      <span className="text-white font-semibold">{label}</span>
    </div>
  );
}

export default function PageHeader({ title, segments }:{ title:string; segments:Pill[] }){
  return (
    <motion.header initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.22, ease:[0.22,0.61,0.36,1]}} className="header-gradient rounded-b-xl px-6 pt-6 pb-5 shadow">
      <h1 className="text-5xl font-extrabold text-white tracking-tight">{title}</h1>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
        {segments.map((s,i)=> (<SegmentCard key={i} label={s.label} count={s.count} />))}
      </div>
    </motion.header>
  );
}


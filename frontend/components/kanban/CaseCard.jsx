"use client";
import { motion } from 'framer-motion';
import { Clock, MessageSquare, Paperclip, User, AlertTriangle } from 'lucide-react';

function bandClass(b){
  if (b==='HIGH') return 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30';
  if (b==='MEDIUM') return 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30';
  return 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30';
}
function prioClass(p){ return p==='High'?'text-red-400':p==='Medium'?'text-amber-400':'text-emerald-400'; }

export default function CaseCard({ c, onOpen }){
  const due = c.sla_due_at ? new Date(c.sla_due_at) : null;
  const hoursLeft = due ? Math.round((due - Date.now())/3.6e6) : null;
  const slaClass = hoursLeft==null? '' : hoursLeft<0? 'text-red-400' : hoursLeft<24? 'text-amber-400' : 'text-emerald-400';
  return (
    <motion.button layout onClick={()=>onOpen?.(c)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
      className="w-100 text-left rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
      <div className="flex items-center justify-between">
        <div className={`px-2 py-0.5 rounded-full text-[11px] ${bandClass(c.risk_band||'LOW')}`}>{c.risk_band||'LOW'}</div>
        <div className={`text-xs ${prioClass(c.priority)}`}>{c.priority}</div>
      </div>
      <div className="mt-2 font-semibold text-sm text-white/90">{c.title}</div>
      <div className="mt-1 text-xs text-white/60">{c.entity_name||''} • {c.amount?.toLocaleString?.()||c.amount} {c.currency||''}</div>
      <div className="mt-2 flex items-center gap-3 text-xs text-white/60">
        <div className={`flex items-center gap-1 ${slaClass}`}><Clock size={14} /> {hoursLeft==null? '—' : (hoursLeft>=0? `${hoursLeft}h`:`${Math.abs(hoursLeft)}h late`)}</div>
        <div className="flex items-center gap-1"><MessageSquare size={14} /> {c.evidence_count||0}</div>
        <div className="flex items-center gap-1"><Paperclip size={14} /> {c.attachment_count||0}</div>
        <div className="flex items-center gap-1"><User size={14} /> {c.assignee_id||'—'}</div>
      </div>
    </motion.button>
  );
}


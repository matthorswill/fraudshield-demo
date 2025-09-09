"use client";
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function FiltersBar({ init }:{ init: any }){
  const [q,setQ]=useState<string>(init?.q||'');
  const [kyc,setKyc]=useState<boolean>(Array.isArray(init?.rule) ? init.rule.includes('KYC_OBSOLE') : String(init?.rule||'').includes('KYC_OBSOLE'));
  const [vir,setVir]=useState<boolean>(Array.isArray(init?.rule) ? init.rule.includes('VIREMENT_IRREGULIER') : String(init?.rule||'').includes('VIREMENT_IRREGULIER'));
  const [pays,setPays]=useState<boolean>(Array.isArray(init?.rule) ? init.rule.includes('FONDS_SEIN_PAYS_TIER') : String(init?.rule||'').includes('FONDS_SEIN_PAYS_TIER'));
  const [min,setMin]=useState<string>(init?.minScore||'');

  return (
    <motion.form method="get" className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 px-4 py-3 flex items-center gap-4" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.22}}>
      <div className="relative">
        <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input name="q" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher" className="pl-7 pr-3 py-2 rounded-lg ring-1 ring-slate-300 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]" />
      </div>
      <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" name="rule" value="KYC_OBSOLE" defaultChecked={kyc} /> KYC périmé</label>
      <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" name="rule" value="VIREMENT_IRREGULIER" defaultChecked={vir} /> Virements irréguliers</label>
      <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" name="rule" value="FONDS_SEIN_PAYS_TIER" defaultChecked={pays} /> Pays tiers</label>
      <select name="minScore" value={min} onChange={e=>setMin(e.target.value)} className="ring-1 ring-slate-300 rounded-lg py-2 px-2">
        <option value="">Score min</option>
        <option value="0">0</option>
        <option value="70">70</option>
        <option value="85">85</option>
      </select>
      <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} className="ml-auto bg-[var(--primary)] text-[#0B1E3A] font-semibold rounded-lg px-4 py-2" type="submit">Filtrer</motion.button>
    </motion.form>
  );
}


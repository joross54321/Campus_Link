import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { 
  Layers, 
  ChevronRight, 
  BookOpen,
  Sparkles
} from 'lucide-react';

export default function ProfessorSections() {
  const { profile } = useAuth();
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      if (!profile) {
        setLoading(false);
        console.log("No profile found");
        return;
      }
      try {
        const q = query(collection(db, 'subjects'));
        const snap = await getDocs(q);
        
        const uniqueSections = Array.from(new Set(
          snap.docs
            .map(d => d.data().section)
            .filter(Boolean)
        )).sort();
        
        setSections(uniqueSections);
      } catch (e) {
        console.error("Error fetching sections:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, [profile]);

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <PageHeader
        title="Assigned Sections"
        subtitle="Section overview"
        badge="Legacy browse"
        backTo="/professor"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-surface border border-border rounded-[2.5rem] animate-pulse" />
          ))
        ) : sections.length > 0 ? (
          sections.map((section, idx) => (
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link 
                to={`/professor/sections/${encodeURIComponent(section)}`}
                className="group bg-surface p-8 rounded-[2.5rem] border border-border shadow-sm hover:shadow-xl hover:border-accent/30 hover:-translate-y-1 transition-all flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:scale-110 group-hover:rotate-12 transition-transform">
                   <Layers size={80} />
                </div>
                
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center mb-10 text-primary group-hover:bg-accent group-hover:text-primary transition-colors relative z-10">
                   <BookOpen size={24} />
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl font-display font-bold text-primary mb-2 group-hover:text-accent transition-colors">{section}</h3>
                  <div className="flex items-center justify-between">
                     <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Active Academic Unit</p>
                     <ChevronRight size={16} className="text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 bg-background/50 rounded-[3rem] border border-dashed border-border text-center">
             <div className="w-20 h-20 bg-surface rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-6">
                <Sparkles size={32} />
             </div>
             <p className="text-muted text-sm font-medium">No sections currently assigned to your profile</p>
          </div>
        )}
      </div>
    </div>
  );
}

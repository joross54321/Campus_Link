import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'motion/react';
import PageHeader from '../components/layout/PageHeader';
import { 
  Layers, 
  ChevronRight, 
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Subject } from '../types';

export default function ProfessorCourseSections() {
  const { courseCode } = useParams();
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      if (!courseCode) return;
      try {
        const q = query(
          collection(db, 'subjects'), 
          where('code', '==', courseCode)
        );
        const snap = await getDocs(q);
        const subjectsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
        setSubjects(subjectsData);
      } catch (e) {
        console.error("Error fetching course sections:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, [courseCode]);

  const courseTitle = subjects.length > 0 ? subjects[0].title : courseCode;

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <PageHeader
        title="Course sections"
        subtitle="Section distribution"
        badge="Legacy browse"
        backTo="/professor/courses"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-surface border border-border rounded-[2.5rem] animate-pulse" />
          ))
        ) : subjects.length > 0 ? (
          subjects.map((subject, idx) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link 
                to={`/professor/management/${subject.id}`}
                className="group bg-surface p-8 rounded-[2.5rem] border border-border shadow-sm hover:shadow-xl hover:border-accent/30 hover:-translate-y-1 transition-all flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:scale-110 group-hover:rotate-12 transition-transform">
                   <Layers size={80} />
                </div>
                
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center mb-10 text-primary group-hover:bg-accent group-hover:text-primary transition-colors relative z-10">
                   <BookOpen size={24} />
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl font-display font-bold text-primary mb-2 group-hover:text-accent transition-colors">{subject.section}</h3>
                  <div className="flex items-center justify-between">
                     <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Enrolled Academic Group</p>
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
             <p className="text-muted text-sm font-medium">No sections found for this course</p>
          </div>
        )}
      </div>
    </div>
  );
}

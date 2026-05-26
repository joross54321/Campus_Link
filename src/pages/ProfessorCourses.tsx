import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { 
  Library, 
  ChevronRight, 
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Subject } from '../types';

export default function ProfessorCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<{code: string, title: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'subjects'));
        const snap = await getDocs(q);
        
        // Group by code/title to get unique courses
        const uniqueMap = new Map<string, string>();
        snap.docs.forEach(doc => {
          const data = doc.data();
          uniqueMap.set(data.code, data.title);
        });

        const courseList = Array.from(uniqueMap.entries()).map(([code, title]) => ({
          code,
          title
        })).sort((a, b) => a.code.localeCompare(b.code));
        
        setCourses(courseList);
      } catch (e) {
        console.error("Error fetching courses:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <PageHeader
        title="Handling Courses"
        subtitle="Global course registry"
        badge="Legacy browse"
        backTo="/professor"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-surface border border-border rounded-[2.5rem] animate-pulse" />
          ))
        ) : courses.length > 0 ? (
          courses.map((course, idx) => (
            <motion.div
              key={course.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link 
                to={`/professor/courses/${course.code}`}
                className="group bg-surface p-8 rounded-[2.5rem] border border-border shadow-sm hover:shadow-xl hover:border-accent/30 hover:-translate-y-1 transition-all flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:scale-110 group-hover:rotate-12 transition-transform">
                   <Library size={80} />
                </div>
                
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center mb-10 text-primary group-hover:bg-accent group-hover:text-primary transition-colors relative z-10">
                   <BookOpen size={24} />
                </div>

                <div className="relative z-10">
                  <div className="text-[9px] font-bold text-accent uppercase tracking-[0.2em] mb-2">{course.code}</div>
                  <h3 className="text-xl font-display font-bold text-primary mb-4 group-hover:text-accent transition-colors leading-tight">{course.title}</h3>
                  <div className="flex items-center justify-between">
                     <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Active Curriculum Subject</p>
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
             <p className="text-muted text-sm font-medium">No courses available in the curriculum</p>
          </div>
        )}
      </div>
    </div>
  );
}

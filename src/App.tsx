/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppToaster from './components/AppToaster';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SystemConfigProvider } from './hooks/useSystemConfig';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PreEnrollmentRouter from './pages/PreEnrollmentRouter';
import StudyLoad from './pages/StudyLoad';
import AddSubjects from './pages/AddSubjects';
import DropSubjects from './pages/DropSubjects';
import Services from './pages/Services';
import Grades from './pages/Grades';
import ProfessorPortal from './pages/ProfessorPortal';
import ProfessorDashboard from './pages/ProfessorDashboard';
import ProfessorSubjects from './pages/ProfessorSubjects';
import ProfessorGrades from './pages/ProfessorGrades';
import ProfessorSections from './pages/ProfessorSections';
import ProfessorSectionCourses from './pages/ProfessorSectionCourses';
import ProfessorCourses from './pages/ProfessorCourses';
import ProfessorCourseSections from './pages/ProfessorCourseSections';
import AdminDashboard from './pages/AdminDashboard';
import ClassSchedule from './pages/ClassSchedule';
import SettingsPage from './pages/Settings';
import Shell from './components/layout/Shell';
import { ScreenFeedbackProvider } from './contexts/ScreenFeedbackContext';
import { AdminRefreshProvider } from './contexts/AdminRefreshContext';
import ProfileMissingScreen from './components/ProfileMissingScreen';
import { getHomePathForRole } from './lib/authRoutes';
import type { UserRole } from './types';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-blue">
      <div className="h-12 w-12 animate-spin rounded-[1.25rem] border-4 border-brand-gold border-t-transparent shadow-2xl shadow-brand-gold/20"></div>
      <p className="mt-6 text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] animate-pulse">Authenticating Identity</p>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles) {
    if (!profile) {
      return <ProfileMissingScreen />;
    }
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to={getHomePathForRole(profile.role)} replace />;
    }
  }

  return <>{children}</>;
}

function IndexRedirect() {
  const { profile, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-blue">
        <div className="h-12 w-12 animate-spin rounded-[1.25rem] border-4 border-brand-gold border-t-transparent shadow-2xl shadow-brand-gold/20" />
      </div>
    );
  }
  if (!profile) {
    return user ? <ProfileMissingScreen /> : <Navigate to="/login" replace />;
  }
  return <Navigate to={getHomePathForRole(profile.role)} replace />;
}

function ShellFallback() {
  const { profile } = useAuth();
  return <Navigate to={getHomePathForRole(profile?.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <SystemConfigProvider>
      <ScreenFeedbackProvider>
      <AdminRefreshProvider>
      <Router>
        <AppToaster />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Shell /></ProtectedRoute>}>
            <Route index element={<IndexRedirect />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute allowedRoles={['student', 'professor', 'registrar']}>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={['student', 'professor', 'registrar']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="services" element={
              <ProtectedRoute allowedRoles={['student']}><Services /></ProtectedRoute>
            } />
            <Route path="enrollment" element={
              <ProtectedRoute allowedRoles={['student']}><PreEnrollmentRouter /></ProtectedRoute>
            } />
            <Route path="study-load" element={
              <ProtectedRoute allowedRoles={['student']}><StudyLoad /></ProtectedRoute>
            } />
            <Route path="study-load/add" element={
              <ProtectedRoute allowedRoles={['student']}><AddSubjects /></ProtectedRoute>
            } />
            <Route path="study-load/drop" element={
              <ProtectedRoute allowedRoles={['student']}><DropSubjects /></ProtectedRoute>
            } />
            <Route path="study-load/add-drop" element={
              <Navigate to="/study-load/add" replace />
            } />
            <Route path="schedule" element={
              <ProtectedRoute allowedRoles={['student']}><ClassSchedule /></ProtectedRoute>
            } />
            <Route path="grades" element={
              <ProtectedRoute allowedRoles={['student']}><Grades /></ProtectedRoute>
            } />
            <Route path="professor" element={
              <ProtectedRoute allowedRoles={['professor']}><ProfessorDashboard /></ProtectedRoute>
            } />
            <Route path="professor/subjects" element={
              <ProtectedRoute allowedRoles={['professor']}><ProfessorSubjects /></ProtectedRoute>
            } />
            <Route path="professor/sections" element={
              <ProtectedRoute allowedRoles={['professor']}><Navigate to="/professor/subjects" replace /></ProtectedRoute>
            } />
            <Route path="professor/sections/:sectionName" element={
              <ProtectedRoute allowedRoles={['professor']}><ProfessorSectionCourses /></ProtectedRoute>
            } />
            <Route path="professor/grades" element={
              <ProtectedRoute allowedRoles={['professor']}><ProfessorGrades /></ProtectedRoute>
            } />
            <Route path="professor/courses" element={
              <ProtectedRoute allowedRoles={['professor']}><Navigate to="/professor/subjects" replace /></ProtectedRoute>
            } />
            <Route path="professor/courses/:courseCode" element={
              <ProtectedRoute allowedRoles={['professor']}><ProfessorCourseSections /></ProtectedRoute>
            } />
            <Route path="professor/management/:subjectId" element={
              <ProtectedRoute allowedRoles={['professor']}><ProfessorPortal /></ProtectedRoute>
            } />
            <Route path="admin" element={
              <ProtectedRoute allowedRoles={['registrar']}><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="*" element={<ShellFallback />} />
          </Route>
        </Routes>
      </Router>
      </AdminRefreshProvider>
      </ScreenFeedbackProvider>
      </SystemConfigProvider>
    </AuthProvider>
  );
}

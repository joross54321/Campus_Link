import { useEffect, useState } from 'react';

import { useAuth } from './useAuth';

import { useSystemConfig } from './useSystemConfig';

import { Enrollment } from '../types';

import {

  canAccessAddDropPortal,

  canAccessPreEnrollmentWizard,

  getAddDropBlockReason,

  getPreEnrollmentBlockReason,

  getStudentTermPhase,

  getStudyLoadAddBlockReason,

  getStudyLoadDropBlockReason,

  hasActiveStudyLoadForTerm,

  hasApprovedStudyLoadForTerm,

  hasPendingInitialEnrollmentForTerm,

  hasPendingEnrollmentForTerm,

  isEnrolledForCurrentTerm,

  type StudentTermPhase,

} from '../lib/enrollmentPeriods';

import { subscribeStudentEnrollments } from '../lib/studentEnrollments';



export function useStudentEnrollmentStatus() {

  const { profile, isStudent } = useAuth();

  const { config } = useSystemConfig();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    if (!isStudent || !profile?.uid) {

      setEnrollments([]);

      setLoading(false);

      return;

    }



    setLoading(true);

    const unsub = subscribeStudentEnrollments(

      profile,

      (rows) => {

        setEnrollments(rows);

        setLoading(false);

      },

      () => setLoading(false)

    );

    return unsub;

  }, [isStudent, profile?.uid, profile?.studentId]);



  const termPhase: StudentTermPhase = config

    ? getStudentTermPhase(enrollments, config)

    : 'not_enrolled';



  const preEnrollBlockReason = config

    ? getPreEnrollmentBlockReason(enrollments, config, profile?.role)

    : null;

  const addBlockReason = config

    ? getStudyLoadAddBlockReason(enrollments, config, profile?.role)

    : null;

  const dropBlockReason = config

    ? getStudyLoadDropBlockReason(enrollments, config, profile?.role)

    : null;

  const addDropBlockReason = config

    ? getAddDropBlockReason(enrollments, config, profile?.role)

    : null;



  const canPreEnroll = config

    ? canAccessPreEnrollmentWizard(enrollments, config, profile?.role)

    : false;

  const isEnrolled = config ? isEnrolledForCurrentTerm(enrollments, config) : false;

  const hasApprovedStudyLoad = config

    ? hasApprovedStudyLoadForTerm(enrollments, config)

    : false;

  const hasActiveStudyLoad = config

    ? hasActiveStudyLoadForTerm(enrollments, config)

    : false;

  const hasPendingInitial = config

    ? hasPendingInitialEnrollmentForTerm(enrollments, config)

    : false;

  const hasPendingEnrollment = config

    ? hasPendingEnrollmentForTerm(enrollments, config)

    : false;



  const canAddDrop = config

    ? canAccessAddDropPortal(enrollments, config, profile?.role)

    : false;

  const canRequestAdd = isEnrolled && addBlockReason === null;

  const canRequestDrop = isEnrolled && dropBlockReason === null;



  return {

    enrollments,

    loading,

    termPhase,

    preEnrollBlockReason,

    addBlockReason,

    dropBlockReason,

    addDropBlockReason,

    blockReason: preEnrollBlockReason,

    canPreEnroll,

    canEnroll: canPreEnroll,

    isEnrolled,

    hasApprovedStudyLoad,

    hasActiveStudyLoad,

    hasPendingInitial,

    hasPreEnrollmentSubmitted: termPhase !== 'not_enrolled',

    hasOfficialEnrollment: isEnrolled,

    hasPendingEnrollment,

    canAddDrop,

    canRequestAdd,

    canRequestDrop,

    config,

  };

}



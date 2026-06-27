/**
 * Sample tree data for Parent and Learner dashboards.
 *
 * This file provides realistic sample data for the TreeSidebar component.
 * TODO: Replace these with real API calls once backend endpoints are available.
 *       Expected API: GET /api/parent/{parentId}/learners (returns learners with subjects)
 *       Expected API: GET /api/learner/{learnerId}/subjects (returns subjects with chapters)
 */

import { TreeNode } from '../components/TreeSidebar';
import { subjectColors } from '../theme/tokens';

// ============================================================
// Learner Dashboard — sample subject tree
// ============================================================

/**
 * Returns sample tree data for a learner's subject navigation.
 * In production, this would call: GET /api/learner/{learnerId}/subjects
 */
export function getLearnerTreeData(): TreeNode[] {
  return [
    {
      id: 'subject-kannada',
      label: 'Kannada',
      icon: 'ಅ',
      color: subjectColors.Kannada,
      isExpanded: true,
      children: [
        {
          id: 'ch-kan-1',
          label: 'Ch 1: Akshara Parichaya',
          children: [
            { id: 'ch-kan-1-ex', label: 'Exercises', badge: 3 },
            { id: 'ch-kan-1-qz', label: 'Quizzes', badge: 1 },
          ],
        },
        {
          id: 'ch-kan-2',
          label: 'Ch 2: Swaravyanjana',
          children: [
            { id: 'ch-kan-2-ex', label: 'Exercises', badge: 2 },
            { id: 'ch-kan-2-qz', label: 'Quizzes', badge: 0 },
          ],
        },
        {
          id: 'ch-kan-3',
          label: 'Ch 3: Kathe Keli',
          badge: 'new',
          children: [
            { id: 'ch-kan-3-ex', label: 'Exercises', badge: 0 },
            { id: 'ch-kan-3-qz', label: 'Quizzes', badge: 0 },
          ],
        },
      ],
    },
    {
      id: 'subject-maths',
      label: 'Maths',
      icon: '📐',
      color: subjectColors.Maths,
      children: [
        {
          id: 'ch-math-1',
          label: 'Ch 1: Numbers',
          children: [
            { id: 'ch-math-1-ex', label: 'Exercises', badge: 5 },
            { id: 'ch-math-1-qz', label: 'Quizzes', badge: 2 },
          ],
        },
        {
          id: 'ch-math-2',
          label: 'Ch 2: Fractions',
          children: [
            { id: 'ch-math-2-ex', label: 'Exercises', badge: 3 },
            { id: 'ch-math-2-qz', label: 'Quizzes', badge: 1 },
          ],
        },
      ],
    },
    {
      id: 'subject-english',
      label: 'English',
      icon: '🅰',
      color: subjectColors.English,
      children: [
        {
          id: 'ch-eng-1',
          label: 'Ch 1: Greetings',
          children: [
            { id: 'ch-eng-1-ex', label: 'Exercises', badge: 4 },
            { id: 'ch-eng-1-qz', label: 'Quizzes', badge: 2 },
          ],
        },
        {
          id: 'ch-eng-2',
          label: 'Ch 2: Stories',
          children: [
            { id: 'ch-eng-2-ex', label: 'Exercises', badge: 2 },
            { id: 'ch-eng-2-qz', label: 'Quizzes', badge: 1 },
          ],
        },
      ],
    },
    {
      id: 'subject-computers',
      label: 'Computers',
      icon: '🖥',
      color: subjectColors.Computers,
      children: [],
    },
    {
      id: 'subject-evs',
      label: 'EVS',
      icon: '🌿',
      color: subjectColors.EVS,
      children: [
        {
          id: 'ch-evs-1',
          label: 'Ch 1: Plants Around Us',
          children: [
            { id: 'ch-evs-1-ex', label: 'Exercises', badge: 3 },
            { id: 'ch-evs-1-qz', label: 'Quizzes', badge: 1 },
          ],
        },
      ],
    },
  ];
}

// ============================================================
// Parent Dashboard — sample learner tree with nested subjects
// ============================================================

/**
 * Returns sample tree data for a parent's learner navigation.
 * In production, this would call: GET /api/parent/{parentId}/learners
 * and for each learner: GET /api/learner/{learnerId}/subjects
 */
export function getParentTreeData(): TreeNode[] {
  return [
    {
      id: 'learner-aadhya',
      label: 'Aadhya (Grade 4)',
      icon: '👧',
      isExpanded: true,
      children: [
        {
          id: 'aadhya-kannada',
          label: 'Kannada',
          icon: 'ಅ',
          color: subjectColors.Kannada,
          children: [
            {
              id: 'aadhya-kan-ch1',
              label: 'Ch 1: Akshara',
              children: [
                { id: 'aadhya-kan-ch1-ex', label: 'Exercises', badge: 3 },
                { id: 'aadhya-kan-ch1-qz', label: 'Quizzes', badge: 1 },
              ],
            },
            {
              id: 'aadhya-kan-ch2',
              label: 'Ch 2: Swaravyanjana',
              children: [
                { id: 'aadhya-kan-ch2-ex', label: 'Exercises', badge: 2 },
                { id: 'aadhya-kan-ch2-qz', label: 'Quizzes', badge: 0 },
              ],
            },
          ],
        },
        {
          id: 'aadhya-maths',
          label: 'Maths',
          icon: '📐',
          color: subjectColors.Maths,
          children: [
            {
              id: 'aadhya-math-ch1',
              label: 'Ch 1: Fractions',
              children: [
                { id: 'aadhya-math-ch1-ex', label: 'Exercises', badge: 5 },
                { id: 'aadhya-math-ch1-qz', label: 'Quizzes', badge: 2 },
              ],
            },
          ],
        },
        {
          id: 'aadhya-english',
          label: 'English',
          icon: '🅰',
          color: subjectColors.English,
          children: [
            {
              id: 'aadhya-eng-ch1',
              label: 'Ch 1: Poems',
              children: [
                { id: 'aadhya-eng-ch1-ex', label: 'Exercises', badge: 2 },
                { id: 'aadhya-eng-ch1-qz', label: 'Quizzes', badge: 1 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'learner-ravi',
      label: 'Ravi (Grade 2)',
      icon: '👦',
      children: [
        {
          id: 'ravi-english',
          label: 'English',
          icon: '🅰',
          color: subjectColors.English,
          children: [
            {
              id: 'ravi-eng-ch1',
              label: 'Ch 1: Alphabet Fun',
              children: [
                { id: 'ravi-eng-ch1-ex', label: 'Exercises', badge: 4 },
                { id: 'ravi-eng-ch1-qz', label: 'Quizzes', badge: 2 },
              ],
            },
            {
              id: 'ravi-eng-ch2',
              label: 'Ch 2: Simple Words',
              children: [
                { id: 'ravi-eng-ch2-ex', label: 'Exercises', badge: 3 },
                { id: 'ravi-eng-ch2-qz', label: 'Quizzes', badge: 1 },
              ],
            },
          ],
        },
        {
          id: 'ravi-maths',
          label: 'Maths',
          icon: '📐',
          color: subjectColors.Maths,
          children: [
            {
              id: 'ravi-math-ch1',
              label: 'Ch 1: Counting',
              children: [
                { id: 'ravi-math-ch1-ex', label: 'Exercises', badge: 6 },
                { id: 'ravi-math-ch1-qz', label: 'Quizzes', badge: 3 },
              ],
            },
          ],
        },
        {
          id: 'ravi-hindi',
          label: 'Hindi',
          icon: 'हि',
          color: subjectColors.Hindi,
          children: [
            {
              id: 'ravi-hindi-ch1',
              label: 'Ch 1: Varnamala',
              children: [
                { id: 'ravi-hindi-ch1-ex', label: 'Exercises', badge: 3 },
                { id: 'ravi-hindi-ch1-qz', label: 'Quizzes', badge: 1 },
              ],
            },
          ],
        },
      ],
    },
  ];
}

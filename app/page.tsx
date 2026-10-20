'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { computeDepEdScienceGrade } from '../lib/grading';
import { Upload, Search, CheckCircle, LogOut, Lock, User, ShieldCheck, School } from 'lucide-react';

export default function Home() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Portal data state
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setAuthLoading(false);
    if (user) {
      fetchGrades();
    }
  }

  // Convert username to internal email format for Supabase Auth
  function formatEmail(input: string) {
    const clean = input.trim().toLowerCase();
    return clean.includes('@') ? clean : `${clean}@ssa.local`;
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    const email = formatEmail(username);

    if (isRegistering) {
      // First-time teacher registration: Create password
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim() }
        }
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setUser(data.user);
        fetchGrades();
      }
    } else {
      // Regular Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setUser(data.user);
        fetchGrades();
      }
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function fetchGrades() {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select(`
        id, student_number, full_name,
        grades(ww_total, ww_ps, ww_wg, pt_total, pt_ps, pt_wg, qa_raw, qa_wg, initial_grade, final_grade)
      `)
      .order('student_number', { ascending: true });

    if (data) setStudents(data);
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      let { data: section } = await supabase.from('sections').select('id').eq('name', '7 - DEBORAH').single();
      if (!section) {
        const { data: newSec } = await supabase.from('sections').insert({ name: '7 - DEBORAH', grade_level: 7 }).select('id').single();
        section = newSec;
      }

      const wwMax = [20, 20, 20, 30];
      const ptMax = [30, 55, 60];
      const qaMax = 60;

      for (let i = 11; i < rows.length; i++) {
        const row = rows[i];
        const sNum = row[1];
        const sName = row[2];

        if (!sName || typeof sName !== 'string' || sName.includes('Submitted by')) continue;

        const wwScores = [row[3], row[4], row[5], row[6]];
        const ptScores = [row[14], row[15], row[16]];
        const qaScore = row[26];

        const res = computeDepEdScienceGrade(wwScores, wwMax, ptScores, ptMax, qaScore, qaMax);

        let { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('full_name', sName.trim())
          .single();

        if (!student) {
          const { data: newStudent } = await supabase
            .from('students')
            .insert({ student_number: sNum, full_name: sName.trim(), section_id: section?.id })
            .select('id')
            .single();
          student = newStudent;
        }

        if (student) {
          await supabase.from('grades').upsert({
            student_id: student.id,
            subject: 'SCIENCE 7',
            quarter: 'Q1',
            ww_total: res.wwEarned,
            ww_ps: res.wwPs,
            ww_wg: res.wwWg,
            pt_total: res.ptEarned,
            pt_ps: res.ptPs,
            pt_wg: res.ptWg,
            qa_raw: res.qaEarned,
            qa_wg: res.qaWg,
            initial_grade: res.initialGrade,
            final_grade: res.finalGrade,
          }, { onConflict: 'student_id,subject,quarter' });
        }
      }

      setMessage("Success: Class record parsed and all student marks saved to Supabase!");
      await fetchGrades();
    } catch (err: any) {
      alert("Error parsing file: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = students.filter(s => s.full_name?.toLowerCase().includes(search.toLowerCase()));

  // 1. LOADING SCREEN
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="text-sm font-medium animate-pulse">Connecting to St. Scholastica's Academy Portal...</p>
      </div>
    );
  }

  // 2. TEACHER LOGIN & REGISTRATION SCREEN (IF NOT LOGGED IN)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-8 space-y-6">
          
          {/* LOGO & HEADING */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 mx-auto rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shadow-inner">
              <img 
                src="/logo.png" 
                alt="St. Scholastica's Academy" 
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  // Fallback icon if logo.png not yet placed in public/
                  (e.target as HTMLElement).style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('fallback-icon');
                }}
              />
              <School className="w-10 h-10 text-indigo-900 hidden [.fallback-icon_&]:block" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">ST. SCHOLASTICA'S ACADEMY</h2>
              <p className="text-xs text-indigo-600 font-semibold tracking-wide uppercase mt-0.5">Faculty Grading & Formation Portal</p>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teacher Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. russel.bacani"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isRegistering ? 'Create Your Password' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder={isRegistering ? 'Create password (min 6 characters)' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow hover:shadow-md transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isRegistering ? 'Register & Set Password' : 'Sign In to Portal'}
            </button>
          </form>

          {/* TOGGLE BETWEEN LOGIN AND FIRST TIME SETUP */}
          <div className="pt-2 text-center border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError(null);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
            >
              {isRegistering
                ? 'Already created a password? Sign In'
                : 'First-time teacher? Create your password here'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. MAIN AUTHENTICATED PORTAL VIEW
  const teacherDisplay = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Teacher';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      
      {/* HEADER WITH LOGO */}
      <header className="bg-indigo-950 text-white px-8 py-4 border-b border-indigo-900 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/10 p-1 flex items-center justify-center border border-white/20 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="SSA Logo" 
              className="w-10 h-10 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                e.currentTarget.parentElement?.classList.add('fallback-header');
              }}
            />
            <School className="w-6 h-6 text-indigo-200 hidden [.fallback-header_&]:block" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">ST. SCHOLASTICA'S ACADEMY</h1>
            <p className="text-xs text-indigo-300">Grade Recording Portal • S.Y. 2026-2027</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="px-3 py-1 bg-indigo-900 border border-indigo-700 rounded-full font-medium">Grade 7 - DEBORAH</span>
            <span className="px-3 py-1 bg-indigo-900 border border-indigo-700 rounded-full font-medium">SCIENCE 7 (Q1)</span>
          </div>

          <div className="h-6 w-[1px] bg-indigo-800 hidden md:block"></div>

          {/* TEACHER INFO & LOGOUT */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-200 font-medium">Faculty: <strong className="text-white capitalize">{teacherDisplay}</strong></span>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 hover:bg-indigo-800 rounded-lg text-indigo-300 hover:text-white transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto p-8 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-lg font-bold">Class Record Integration Engine</h2>
            <p className="text-xs text-slate-500">Upload your class record spreadsheet to calculate and save grades permanently.</p>
          </div>
          <div className="flex gap-3">
            <label className="cursor-pointer flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold text-xs transition">
              <Upload className="w-4 h-4" />
              Upload Class Record (.xlsx)
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {message && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            {message}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3">
            <h3 className="font-bold text-sm">Class Roster & Computed Marks</h3>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search student..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[11px] border-b">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Learner Name</th>
                  <th className="py-3 px-2 text-center bg-blue-50/50">WW Total (/90)</th>
                  <th className="py-3 px-2 text-center bg-blue-100/50 text-blue-900 font-bold">WW (40%)</th>
                  <th className="py-3 px-2 text-center bg-amber-50/50">PT Total (/145)</th>
                  <th className="py-3 px-2 text-center bg-amber-100/50 text-amber-900 font-bold">PT (40%)</th>
                  <th className="py-3 px-2 text-center bg-purple-50/50">QA Raw (/60)</th>
                  <th className="py-3 px-2 text-center bg-purple-100/50 text-purple-900 font-bold">QA (20%)</th>
                  <th className="py-3 px-2 text-center bg-slate-200/50">Initial Grade</th>
                  <th className="py-3 px-3 text-center bg-indigo-50 text-indigo-950 font-bold">Final Grade</th>
                  <th className="py-3 px-3 text-center">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No records found. Upload your class record spreadsheet above.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s, idx) => {
                    const g = s.grades?.[0];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 text-slate-400 font-medium">{s.student_number || idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{s.full_name}</td>
                        <td className="py-3 px-2 text-center bg-blue-50/30">{g?.ww_total ?? '-'}</td>
                        <td className="py-3 px-2 text-center bg-blue-100/30 font-bold text-blue-800">{g?.ww_wg ?? '-'}</td>
                        <td className="py-3 px-2 text-center bg-amber-50/30">{g?.pt_total ?? '-'}</td>
                        <td className="py-3 px-2 text-center bg-amber-100/30 font-bold text-amber-800">{g?.pt_wg ?? '-'}</td>
                        <td className="py-3 px-2 text-center bg-purple-50/30">{g?.qa_raw ?? '-'}</td>
                        <td className="py-3 px-2 text-center bg-purple-100/30 font-bold text-purple-800">{g?.qa_wg ?? '-'}</td>
                        <td className="py-3 px-2 text-center font-bold bg-slate-100/50">{g?.initial_grade ?? '-'}</td>
                        <td className="py-3 px-3 text-center font-extrabold text-sm text-indigo-950 bg-indigo-50/80">{g?.final_grade ?? '-'}</td>
                        <td className="py-3 px-3 text-center">
                          {g?.final_grade ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${g.final_grade >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {g.final_grade >= 75 ? 'PASSED' : 'FAILED'}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
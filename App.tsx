
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  UserProgress, 
  AppState, 
  Dialogue,
  DialogueTurn,
  Word,
  AnalysisResult,
  PracticeMode,
  DialoguePhase,
  Role
} from './types';
import { 
  INITIAL_DIALOGUES, 
  INITIAL_WORDS,
  LOCAL_STORAGE_KEY, 
  DEFAULT_DAILY_GOAL, 
  DEFAULT_ACCURACY_THRESHOLD 
} from './constants';
import { GeminiService } from './services/geminiService';
import PracticeCard from './components/PracticeCard';

type ViewTab = 'practice' | 'library' | 'stats' | 'settings';

const App: React.FC = () => {
  const geminiRef = useRef<GeminiService>(new GeminiService());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [activeTab, setActiveTab] = useState<ViewTab>('practice');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('sentence');
  const [dialoguePhase, setDialoguePhase] = useState<DialoguePhase>('learning');
  const [userRole, setUserRole] = useState<Role>('B');
  
  const [dialogues] = useState<Dialogue[]>(INITIAL_DIALOGUES);
  const [words] = useState<Word[]>(INITIAL_WORDS);
  
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState<UserProgress>({
    completedIds: [],
    roleplayCompletedIds: [],
    completedTurnIds: [],
    completedWordIds: [],
    dailyCount: 0,
    lastPracticeDate: new Date().toISOString().split('T')[0],
    targetAccuracy: DEFAULT_ACCURACY_THRESHOLD,
    dailyGoal: DEFAULT_DAILY_GOAL
  });

  // Load progress with SSR safety
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        if (parsed.lastPracticeDate !== today) {
          parsed.dailyCount = 0;
          parsed.lastPracticeDate = today;
        }
        setProgress(parsed);
        
        const firstUncompletedDialogue = dialogues.findIndex(d => 
          !parsed.completedIds?.includes(d.id) || !parsed.roleplayCompletedIds?.includes(d.id)
        );
        if (firstUncompletedDialogue !== -1) setCurrentDialogueIndex(firstUncompletedDialogue);
        
        const firstUncompletedWord = words.findIndex(w => !parsed.completedWordIds?.includes(w.id));
        if (firstUncompletedWord !== -1) setCurrentWordIndex(firstUncompletedWord);
      } catch (e) {
        console.error("Failed to parse progress", e);
      }
    }
  }, [dialogues, words]);

  // Save progress
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const currentDialogue = dialogues[currentDialogueIndex];
  const currentTurn = currentDialogue?.turns[currentTurnIndex];
  const currentWord = words[currentWordIndex];

  // Roleplay 자동 진행 로직 (AI 차례일 때)
  useEffect(() => {
    if (practiceMode === 'sentence' && dialoguePhase === 'roleplay' && currentTurn && appState === AppState.IDLE) {
      if (currentTurn.speaker !== userRole) {
        setAppState(AppState.WAITING_FOR_AI);
        geminiRef.current.speak(currentTurn.english).then(() => {
          setTimeout(() => {
            if (currentTurnIndex < currentDialogue.turns.length - 1) {
              setCurrentTurnIndex(prev => prev + 1);
              setAppState(AppState.IDLE);
            } else {
              completeRoleplay();
            }
          }, 800);
        });
      }
    }
  }, [practiceMode, dialoguePhase, currentTurnIndex, userRole, currentDialogueIndex, appState]);

  const completeRoleplay = () => {
    if (!currentDialogue) return;
    const dId = currentDialogue.id;
    setProgress(prev => ({
      ...prev,
      roleplayCompletedIds: prev.roleplayCompletedIds.includes(dId) ? prev.roleplayCompletedIds : [...prev.roleplayCompletedIds, dId],
      dailyCount: prev.dailyCount + 5
    }));
    setAppState(AppState.RESULT);
    setAnalysis(null);
  };

  const handlePlay = useCallback(async () => {
    const text = practiceMode === 'sentence' ? currentTurn?.english : currentWord?.english;
    if (text) await geminiRef.current.speak(text);
  }, [practiceMode, currentTurn, currentWord]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setAppState(AppState.ANALYZING);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          const textToAnalyze = practiceMode === 'sentence' ? currentTurn!.english : currentWord!.english;
          const result = await geminiRef.current.analyzePronunciation(textToAnalyze, base64data);
          setAnalysis(result);
          setAppState(AppState.RESULT);
          stream.getTracks().forEach(track => track.stop());
        };
      };
      recorder.start();
      setAppState(AppState.RECORDING);
    } catch (err) {
      alert("마이크 접근이 거부되었습니다.");
    }
  }, [practiceMode, currentTurn, currentWord]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }, []);

  const nextItem = useCallback(() => {
    setAnalysis(null);
    setAppState(AppState.IDLE);

    if (practiceMode === 'sentence') {
      if (dialoguePhase === 'learning') {
        const isTurnNewlyCompleted = !progress.completedTurnIds.includes(currentTurn.id);
        setProgress(prev => ({
          ...prev,
          completedTurnIds: isTurnNewlyCompleted ? [...prev.completedTurnIds, currentTurn.id] : prev.completedTurnIds,
          dailyCount: isTurnNewlyCompleted ? prev.dailyCount + 1 : prev.dailyCount
        }));

        if (currentTurnIndex < currentDialogue.turns.length - 1) {
          setCurrentTurnIndex(prev => prev + 1);
        } else {
          setProgress(prev => ({
            ...prev,
            completedIds: prev.completedIds.includes(currentDialogue.id) ? prev.completedIds : [...prev.completedIds, currentDialogue.id]
          }));
          setDialoguePhase('roleplay');
          setCurrentTurnIndex(0);
        }
      } else {
        if (currentTurnIndex < currentDialogue.turns.length - 1) {
          setCurrentTurnIndex(prev => prev + 1);
        } else {
          completeRoleplay();
        }
      }
    } else {
      const isWordNewlyCompleted = !progress.completedWordIds.includes(currentWord.id);
      setProgress(prev => ({
        ...prev,
        completedWordIds: isWordNewlyCompleted ? [...prev.completedWordIds, currentWord.id] : prev.completedWordIds,
        dailyCount: isWordNewlyCompleted ? prev.dailyCount + 1 : prev.dailyCount
      }));
      const nextWIdx = words.findIndex((w, idx) => idx > currentWordIndex && !progress.completedWordIds.includes(w.id));
      if (nextWIdx !== -1) setCurrentWordIndex(nextWIdx);
      else setCurrentWordIndex(words.length);
    }
  }, [practiceMode, dialoguePhase, currentTurn, currentDialogue, currentWord, words, progress]);

  const changePhase = (phase: DialoguePhase) => {
    setDialoguePhase(phase);
    setCurrentTurnIndex(0);
    setAnalysis(null);
    setAppState(AppState.IDLE);
  };

  const totalSentenceCount = useMemo(() => dialogues.reduce((acc, d) => acc + d.turns.length, 0), [dialogues]);
  const dailyProgressPercent = Math.min((progress.dailyCount / progress.dailyGoal) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-24 px-4 overflow-x-hidden">
      <header className="w-full max-w-lg sticky top-0 bg-slate-50/80 backdrop-blur-md pt-6 pb-4 z-10">
        <div className="flex justify-between items-center mb-4">
          <div onClick={() => setActiveTab('practice')} className="cursor-pointer">
            <h1 className="text-xl font-black text-indigo-600 tracking-tighter uppercase">EchoMaster</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400">오늘 목표 ({progress.dailyCount}/{progress.dailyGoal})</div>
            <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
               <div className="h-full bg-indigo-600 transition-all duration-500 shadow-[0_0_8px_rgba(79,70,229,0.3)]" style={{ width: `${dailyProgressPercent}%` }} />
            </div>
          </div>
        </div>

        {(activeTab === 'practice' || activeTab === 'library') && (
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            <button 
              onClick={() => { setPracticeMode('sentence'); setAnalysis(null); setAppState(AppState.IDLE); setDialoguePhase('learning'); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${practiceMode === 'sentence' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              대화 연습
            </button>
            <button 
              onClick={() => { setPracticeMode('word'); setAnalysis(null); setAppState(AppState.IDLE); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${practiceMode === 'word' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              단어 연습
            </button>
          </div>
        )}
      </header>

      <main className="w-full max-w-lg flex flex-col items-center">
        {activeTab === 'practice' && (
          <div className="w-full mt-4">
            {(practiceMode === 'sentence' ? currentDialogue : currentWord) ? (
              <PracticeCard 
                item={practiceMode === 'sentence' ? currentTurn : currentWord}
                dialogue={practiceMode === 'sentence' ? currentDialogue : undefined}
                currentTurnIndex={practiceMode === 'sentence' ? currentTurnIndex : undefined}
                dialoguePhase={dialoguePhase}
                userRole={userRole}
                index={practiceMode === 'sentence' ? currentDialogueIndex : currentWordIndex}
                total={practiceMode === 'sentence' ? dialogues.length : words.length}
                state={appState}
                analysis={analysis}
                onPlay={handlePlay}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onNext={nextItem}
                targetScore={progress.targetAccuracy}
                onSetPhase={changePhase}
                onSetRole={setUserRole}
              />
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl shadow-xl w-full border border-slate-100 p-8 mt-4">
                <i className="fa-solid fa-trophy text-6xl text-amber-400 mb-6 animate-bounce"></i>
                <h2 className="text-2xl font-bold text-slate-800">모든 학습을 완료했습니다!</h2>
                <p className="text-slate-500 mt-2">대단해요! 내일도 계속해서 연습해 보세요.</p>
                <button onClick={() => window.location.reload()} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-indigo-100">다시 시작</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="w-full max-w-lg mt-4 space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span>{practiceMode === 'sentence' ? '대화 목록' : '단어 목록'}</span>
              </h3>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {practiceMode === 'sentence' ? dialogues.map((d, idx) => {
                  const isLearningDone = progress.completedIds.includes(d.id);
                  const isRoleplayDone = progress.roleplayCompletedIds.includes(d.id);
                  return (
                    <div 
                      key={d.id} 
                      onClick={() => { setCurrentDialogueIndex(idx); setCurrentTurnIndex(0); setDialoguePhase('learning'); setActiveTab('practice'); }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${idx === currentDialogueIndex ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{d.category}</p>
                          <p className={`text-sm font-bold ${idx === currentDialogueIndex ? 'text-indigo-600' : 'text-slate-700'}`}>{d.title}</p>
                        </div>
                        <div className="flex gap-2">
                          {isLearningDone && <span title="학습 완료" className="text-emerald-500"><i className="fa-solid fa-graduation-cap"></i></span>}
                          {isRoleplayDone && <span title="대화 완료" className="text-indigo-500"><i className="fa-solid fa-comments"></i></span>}
                        </div>
                      </div>
                    </div>
                  );
                }) : words.map((w, idx) => (
                  <div 
                    key={w.id} 
                    onClick={() => { setCurrentWordIndex(idx); setActiveTab('practice'); }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${idx === currentWordIndex ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                  >
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{w.category}</p>
                    <p className={`text-sm font-bold ${idx === currentWordIndex ? 'text-indigo-600' : 'text-slate-700'}`}>{w.english}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
           <div className="w-full max-w-lg mt-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center animate-in fade-in slide-in-from-bottom-4">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-chart-pie text-2xl text-indigo-500"></i>
              </div>
              <h3 className="text-lg font-bold mb-6 text-slate-800">나의 학습 리포트</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">대화 마스터</p>
                    <p className="text-3xl font-black text-indigo-600">{progress.roleplayCompletedIds.length}</p>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">문장 성공</p>
                    <p className="text-3xl font-black text-emerald-500">{progress.completedTurnIds.length}</p>
                 </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-50">
                <p className="text-sm font-medium text-slate-500 mb-1">오늘 총 학습</p>
                <p className="text-4xl font-black text-slate-800">{progress.dailyCount} <span className="text-lg font-medium text-slate-400">개</span></p>
              </div>
           </div>
        )}

        {activeTab === 'settings' && (
          <div className="w-full max-w-lg mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-indigo-500"></i> 학습 목표 설정
              </h3>
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-bold text-slate-600">하루 학습 목표</label>
                    <span className="text-xl font-black text-indigo-600">{progress.dailyGoal}개</span>
                  </div>
                  <input type="range" min="10" max="100" step="10" value={progress.dailyGoal} onChange={(e) => setProgress(p => ({ ...p, dailyGoal: parseInt(e.target.value) }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-bold text-slate-600">발음 통과 기준</label>
                    <span className="text-xl font-black text-emerald-600">{progress.targetAccuracy}%</span>
                  </div>
                  <input type="range" min="50" max="100" step="5" value={progress.targetAccuracy} onChange={(e) => setProgress(p => ({ ...p, targetAccuracy: parseInt(e.target.value) }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
              </div>
              <button onClick={() => setActiveTab('practice')} className="w-full mt-10 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">설정 저장</button>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-around items-center z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <button onClick={() => setActiveTab('practice')} className={`flex flex-col items-center gap-1 group ${activeTab === 'practice' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'practice' ? 'bg-indigo-50' : 'group-hover:bg-slate-50'}`}>
            <i className="fa-solid fa-microphone-lines text-lg"></i>
          </div>
          <span className="text-[10px] font-bold">연습</span>
        </button>
        <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1 group ${activeTab === 'library' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'library' ? 'bg-indigo-50' : 'group-hover:bg-slate-50'}`}>
            <i className="fa-solid fa-layer-group text-lg"></i>
          </div>
          <span className="text-[10px] font-bold">목록</span>
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 group ${activeTab === 'stats' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'stats' ? 'bg-indigo-50' : 'group-hover:bg-slate-50'}`}>
            <i className="fa-solid fa-chart-line text-lg"></i>
          </div>
          <span className="text-[10px] font-bold">통계</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 group ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-50' : 'group-hover:bg-slate-50'}`}>
            <i className="fa-solid fa-user-gear text-lg"></i>
          </div>
          <span className="text-[10px] font-bold">설정</span>
        </button>
      </footer>
    </div>
  );
};

export default App;

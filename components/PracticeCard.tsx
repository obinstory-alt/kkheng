import React, { useEffect, useRef } from 'react';
import { DialogueTurn, Word, AppState, AnalysisResult, Dialogue, DialoguePhase, Role } from '../types.ts';

interface PracticeCardProps {
  item: DialogueTurn | Word;
  dialogue?: Dialogue;
  currentTurnIndex?: number;
  dialoguePhase?: DialoguePhase;
  userRole?: Role;
  index: number;
  total: number;
  state: AppState;
  analysis: AnalysisResult | null;
  onPlay: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onNext: () => void;
  targetScore: number;
  onSetPhase?: (phase: DialoguePhase) => void;
  onSetRole?: (role: Role) => void;
}

const PracticeCard: React.FC<PracticeCardProps> = ({
  item,
  dialogue,
  currentTurnIndex = 0,
  dialoguePhase = 'learning',
  userRole = 'B',
  index,
  total,
  state,
  analysis,
  onPlay,
  onStartRecording,
  onStopRecording,
  onNext,
  targetScore,
  onSetPhase,
  onSetRole
}) => {
  const isPassed = analysis && analysis.overallScore >= targetScore;
  const isDialogue = !!dialogue;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTurnIndex, state]);

  const isMyTurn = isDialogue && dialoguePhase === 'roleplay' && item && (item as DialogueTurn).speaker === userRole;
  const isAIPlaying = state === AppState.WAITING_FOR_AI;

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col w-full max-w-md mx-auto min-h-[600px] max-h-[80vh] transition-all duration-300 relative">
      {/* Header Info */}
      <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
            {isDialogue ? `${dialogue.category} · ${dialoguePhase === 'learning' ? '학습' : '대화 연습'}` : '단어 연습'}
          </span>
          <h3 className="text-sm font-black text-slate-800">{isDialogue ? dialogue.title : 'Essential Word'}</h3>
        </div>
        <div className="text-[10px] font-black text-slate-300 bg-white px-2 py-1 rounded-lg border border-slate-100">
           {index + 1} / {total}
        </div>
      </div>

      {/* Phase Selector - Only when Learning is complete */}
      {isDialogue && (
        <div className="flex px-4 pt-4 gap-2">
          <button 
            onClick={() => onSetPhase?.('learning')}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${dialoguePhase === 'learning' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}
          >
            문장별 학습
          </button>
          <button 
            onClick={() => onSetPhase?.('roleplay')}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${dialoguePhase === 'roleplay' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
          >
            역할 바꿔 대화
          </button>
        </div>
      )}

      {/* Role Selector - Only in Roleplay Mode */}
      {isDialogue && dialoguePhase === 'roleplay' && (
        <div className="px-4 pt-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400">내 역할 선택:</span>
          <div className="flex gap-2">
            <button 
              onClick={() => onSetRole?.('A')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${userRole === 'A' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-300 border-slate-100'}`}
            >
              Role A
            </button>
            <button 
              onClick={() => onSetRole?.('B')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${userRole === 'B' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-300 border-slate-100'}`}
            >
              Role B
            </button>
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white/50">
        {isDialogue ? (
          dialogue.turns.map((turn, idx) => {
            const isFuture = idx > currentTurnIndex;
            const isCurrent = idx === currentTurnIndex;

            if (isFuture) return null;

            return (
              <div 
                key={turn.id} 
                className={`flex flex-col ${turn.speaker === 'B' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                  turn.speaker === 'B' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
                } ${isCurrent && state === AppState.RESULT ? 'ring-4 ring-indigo-100' : ''} ${isCurrent && isAIPlaying ? 'animate-pulse ring-2 ring-indigo-200' : ''}`}>
                  <p className="text-sm font-bold leading-relaxed">{turn.english}</p>
                  <p className={`text-[11px] mt-1 ${turn.speaker === 'B' ? 'text-indigo-100' : 'text-slate-400'}`}>{turn.korean}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
             <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-2">
                <i className="fa-solid fa-font text-2xl text-indigo-500"></i>
             </div>
             <h2 className="text-5xl font-black text-slate-800 tracking-tight">{item?.english}</h2>
             <p className="text-xl text-slate-400 font-bold">{item?.korean}</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Analysis Layer */}
      {state === AppState.RESULT && analysis && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 animate-in fade-in duration-300">
           <div className="flex flex-wrap gap-1.5 mb-2">
              {analysis.feedback.map((f, i) => (
                <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${f.isCorrect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100 underline decoration-2'}`}>
                  {f.word}
                </span>
              ))}
           </div>
           <p className="text-[11px] text-slate-500 italic">"{analysis.summary}"</p>
        </div>
      )}

      {/* Interaction Controls */}
      <div className="p-4 bg-white border-t border-slate-100 min-h-[100px] flex items-center">
        {state === AppState.IDLE && (
          <div className="w-full flex flex-col gap-2">
            {dialoguePhase === 'learning' || !isDialogue || isMyTurn ? (
              <div className="grid grid-cols-4 gap-2">
                <button onClick={onPlay} className="col-span-1 py-4 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all active:scale-95">
                  <i className="fa-solid fa-volume-high text-xl"></i>
                </button>
                <button onClick={onStartRecording} className="col-span-3 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-microphone-lines"></i> {dialoguePhase === 'roleplay' ? '내 차례! 말하기' : '따라하기 시작'}
                </button>
              </div>
            ) : (
              <div className="w-full py-4 rounded-2xl bg-slate-50 text-slate-400 font-bold text-center text-xs animate-pulse">
                상대방의 대답을 기다리는 중...
              </div>
            )}
          </div>
        )}

        {state === AppState.WAITING_FOR_AI && (
          <div className="w-full py-4 rounded-2xl bg-slate-50 flex items-center justify-center gap-3">
             <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">상대방이 말하고 있습니다...</span>
          </div>
        )}

        {state === AppState.RECORDING && (
          <button onClick={onStopRecording} className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black animate-pulse flex items-center justify-center gap-2">
            <i className="fa-solid fa-stop"></i> 녹음 완료 (멈추기)
          </button>
        )}

        {state === AppState.ANALYZING && (
          <div className="w-full py-4 rounded-2xl bg-slate-50 flex items-center justify-center gap-3">
             <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">발음 채점 중...</span>
          </div>
        )}

        {state === AppState.RESULT && analysis && (
          <div className="w-full flex gap-2">
            <button onClick={onStartRecording} className="flex-1 py-4 rounded-2xl border-2 border-slate-100 text-slate-400 font-black hover:bg-slate-50 transition-all">
              <i className="fa-solid fa-rotate-right"></i> 다시
            </button>
            {isPassed && (
              <button onClick={onNext} className="flex-[2] py-4 rounded-2xl bg-emerald-500 text-white font-black shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all">
                {currentTurnIndex === (dialogue?.turns.length || 1) - 1 ? '대화 완료!' : '다음 문장'} <i className="fa-solid fa-arrow-right ml-1"></i>
              </button>
            )}
          </div>
        )}

        {/* 대화 완전 종료 시 표시 (roleplay completed) */}
        {state === AppState.RESULT && !analysis && (
           <div className="w-full text-center py-2 animate-in fade-in slide-in-from-bottom-2">
              <p className="text-xs font-bold text-indigo-600 mb-2">🎉 역할 대화 연습 완료!</p>
              <button onClick={() => onSetPhase?.('learning')} className="text-[10px] font-black uppercase text-slate-400 underline underline-offset-4">처음부터 다시 학습하기</button>
           </div>
        )}
      </div>
    </div>
  );
};

export default PracticeCard;

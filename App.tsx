
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SessionConfig, SessionStatus, ReminderPoint } from './types';
import { playGentleChime, playFinishedChime, unlockAudioContext } from './utils/audio';
import { getMindfulIntention } from './services/geminiService';
import { 
  Timer, 
  Bell, 
  Play, 
  Square, 
  RotateCcw, 
  Shuffle, 
  CheckCircle,
  Wind,
  Plus,
  Minus,
  Quote,
  Loader2
} from 'lucide-react';

const App: React.FC = () => {
  // State
  const [config, setConfig] = useState<SessionConfig>({
    durationMinutes: 30,
    reminderCount: 5,
    isRandom: true,
  });
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [reminders, setReminders] = useState<ReminderPoint[]>([]);
  const [intention, setIntention] = useState<string>("");
  const [sessionQuote, setSessionQuote] = useState<string>("");
  const [loadingIntention, setLoadingIntention] = useState(false);
  const [isUpdatingQuote, setIsUpdatingQuote] = useState(false);

  const timerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Constants for the progress ring
  const SVG_SIZE = 256;
  const STROKE_WIDTH = 12;
  const RADIUS = (SVG_SIZE / 2) - (STROKE_WIDTH * 1.5);
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const PRESET_DURATIONS = [3, 10, 20, 30, 60, 90, 120];

  // Screen Wake Lock Logic
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Load initial greeting intention
  useEffect(() => {
    if (status === SessionStatus.IDLE) {
      setLoadingIntention(true);
      getMindfulIntention().then(text => {
        setIntention(text);
        setLoadingIntention(false);
      });
    }
  }, [status]);

  // Generate Reminders
  const generateReminders = useCallback((durationMs: number, count: number, isRandom: boolean) => {
    const points: ReminderPoint[] = [];
    if (isRandom) {
      const chunk = durationMs / count;
      for (let i = 0; i < count; i++) {
        const min = i * chunk + (chunk * 0.1); 
        const max = (i + 1) * chunk - (chunk * 0.1);
        points.push({
          timeMs: Math.floor(min + Math.random() * (max - min)),
          triggered: false,
        });
      }
    } else {
      const interval = durationMs / (count + 1);
      for (let i = 1; i <= count; i++) {
        points.push({
          timeMs: Math.floor(i * interval),
          triggered: false,
        });
      }
    }
    return points.sort((a, b) => a.timeMs - b.timeMs);
  }, []);

  const handleStart = async () => {
    // 1. 解锁移动端音频上下文
    unlockAudioContext();
    // 2. 请求屏幕常亮
    requestWakeLock();

    setSessionQuote("开启觉察，呼吸当下...");
    getMindfulIntention().then(setSessionQuote);

    const durationMs = config.durationMinutes * 60 * 1000;
    const initialReminders = generateReminders(durationMs, config.reminderCount, config.isRandom);
    setReminders(initialReminders);
    setStartTime(Date.now());
    setElapsedTime(0);
    setStatus(SessionStatus.RUNNING);
  };

  const handleStop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    releaseWakeLock();
    setStatus(SessionStatus.IDLE);
    setStartTime(null);
    setElapsedTime(0);
    setReminders([]);
    setSessionQuote("");
  };

  // Timer Tick
  useEffect(() => {
    if (status === SessionStatus.RUNNING && startTime) {
      timerRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const totalDuration = config.durationMinutes * 60 * 1000;

        if (elapsed >= totalDuration) {
          setStatus(SessionStatus.FINISHED);
          setElapsedTime(totalDuration);
          playFinishedChime();
          releaseWakeLock();
          if (timerRef.current) window.clearInterval(timerRef.current);
        } else {
          setElapsedTime(elapsed);
          
          setReminders(prev => {
            const updated = [...prev];
            let changed = false;
            
            updated.forEach(r => {
              if (!r.triggered && elapsed >= r.timeMs) {
                r.triggered = true;
                changed = true;
                
                playGentleChime();
                
                setIsUpdatingQuote(true);
                getMindfulIntention().then(newQuote => {
                  setSessionQuote(newQuote);
                  setIsUpdatingQuote(false);
                }).catch(() => setIsUpdatingQuote(false));
              }
            });
            
            return changed ? updated : prev;
          });
        }
      }, 100);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [status, startTime, config.durationMinutes]);

  // Handle re-requesting wake lock when app visibility changes (Android common issue)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (status === SessionStatus.RUNNING && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = Math.min(100, (elapsedTime / (config.durationMinutes * 60 * 1000)) * 100);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progressPercentage / 100);

  const setReminderCount = (val: number) => {
    const safeVal = isNaN(val) ? 1 : Math.max(1, val);
    setConfig({ ...config, reminderCount: safeVal });
  };

  return (
    <div className="min-h-screen bg-emerald-50/40 flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl shadow-emerald-200/40 overflow-hidden border border-emerald-100 flex flex-col transition-all duration-500">
        
        {/* Header Section */}
        <div className="p-6 text-center bg-gradient-to-b from-emerald-50 to-white flex-shrink-0 pt-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-2xl text-emerald-600 mb-3">
            <Wind size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">ZenIntervals</h1>
          <p className="text-emerald-600/80 text-sm font-medium">让呼吸带你归家，让提醒点亮觉知</p>
        </div>

        {/* Main Body */}
        <div className="px-8 pb-8 flex-1">
          
          {status === SessionStatus.IDLE && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center min-h-[80px] flex items-center justify-center">
                {loadingIntention ? (
                  <Loader2 className="animate-spin text-emerald-400" size={20} />
                ) : (
                  <p className="italic text-emerald-800 leading-relaxed font-medium text-base">
                    “{intention}”
                  </p>
                )}
              </div>

              {/* Duration Section with Presets */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Timer size={18} className="text-emerald-500" /> 练习总时长
                  </label>
                  <span className="text-emerald-600 font-mono font-bold text-lg">{config.durationMinutes} 分钟</span>
                </div>
                
                {/* Duration Presets Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {PRESET_DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setConfig({...config, durationMinutes: d})}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        config.durationMinutes === d
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-md scale-105'
                        : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <input 
                    type="range" 
                    min="1" 
                    max="120" 
                    value={config.durationMinutes}
                    onChange={(e) => setConfig({...config, durationMinutes: parseInt(e.target.value)})}
                    className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 px-1">
                    <span>1m</span>
                    <span>30m</span>
                    <span>60m</span>
                    <span>90m</span>
                    <span>120m</span>
                  </div>
                </div>
              </div>

              {/* Reminder Count Options */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Bell size={18} className="text-emerald-500" /> 提醒次数
                </label>
                <div className="flex flex-wrap gap-2">
                  {[3, 5, 8].map(num => (
                    <button
                      key={num}
                      onClick={() => setReminderCount(num)}
                      className={`px-5 py-2 rounded-xl font-bold transition-all text-sm active:scale-95 ${
                        config.reminderCount === num 
                        ? 'bg-emerald-500 text-white shadow-md' 
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                      }`}
                    >
                      {num} 次
                    </button>
                  ))}
                  
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden ml-auto">
                    <button 
                      onClick={() => setReminderCount(config.reminderCount - 1)}
                      className="p-2 hover:bg-slate-100 text-slate-500 transition-colors active:bg-slate-200"
                    >
                      <Minus size={14} />
                    </button>
                    <input 
                      type="number"
                      value={config.reminderCount}
                      onChange={(e) => setReminderCount(parseInt(e.target.value))}
                      className="w-10 text-center bg-transparent font-bold text-slate-700 outline-none text-sm"
                    />
                    <button 
                      onClick={() => setReminderCount(config.reminderCount + 1)}
                      className="p-2 hover:bg-slate-100 text-slate-500 transition-colors active:bg-slate-200"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div className="flex-1">
                  <p className="font-bold text-emerald-900 flex items-center gap-2 text-sm">
                    <Shuffle size={16} className="text-emerald-600" /> 随机间隔
                  </p>
                  <p className="text-[11px] text-emerald-700/70">让提醒更不可预知，训练更专注的觉察力</p>
                </div>
                <button 
                  onClick={() => setConfig({...config, isRandom: !config.isRandom})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.isRandom ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.isRandom ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <button 
                onClick={handleStart}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-200 active:opacity-90"
              >
                <Play size={20} fill="currentColor" /> 开启宁静之旅
              </button>
            </div>
          )}

          {status === SessionStatus.RUNNING && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500 flex flex-col items-center">
              
              {/* Intent Quote for this session - Optimized Height & Full Width */}
              <div className="w-full py-2 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center gap-3 min-h-[44px] relative transition-all duration-500">
                <Quote size={16} className={`flex-shrink-0 ${isUpdatingQuote ? 'text-emerald-300' : 'text-emerald-400'}`} />
                <div className="flex-1 pr-6">
                  <p className={`text-sm italic text-emerald-800 leading-snug font-medium transition-opacity duration-300 ${isUpdatingQuote ? 'opacity-50' : 'opacity-100'}`}>
                    “{sessionQuote}”
                  </p>
                </div>
                {isUpdatingQuote && (
                  <div className="absolute right-4 flex items-center">
                    <Loader2 className="animate-spin text-emerald-400/50" size={14} />
                  </div>
                )}
              </div>

              {/* Timer Container */}
              <div className="relative w-64 h-64 flex items-center justify-center flex-shrink-0">
                <svg 
                  width={SVG_SIZE} 
                  height={SVG_SIZE} 
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} 
                  className="absolute -rotate-90 overflow-visible"
                >
                  <circle 
                    cx={SVG_SIZE / 2} 
                    cy={SVG_SIZE / 2} 
                    r={RADIUS} 
                    className="stroke-emerald-50" 
                    strokeWidth={STROKE_WIDTH} 
                    fill="transparent" 
                  />
                  <circle 
                    cx={SVG_SIZE / 2} 
                    cy={SVG_SIZE / 2} 
                    r={RADIUS} 
                    className="stroke-emerald-500 transition-all duration-300" 
                    strokeWidth={STROKE_WIDTH} 
                    fill="transparent" 
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center text-center">
                  <span className="text-5xl font-mono font-black text-slate-800 leading-tight">
                    {formatTime(config.durationMinutes * 60 * 1000 - elapsedTime)}
                  </span>
                  <div className="mt-2 bg-emerald-100/80 px-3 py-1 rounded-full">
                    <span className="text-emerald-700 text-[10px] uppercase tracking-[0.25em] font-black">倒计时</span>
                  </div>
                </div>
              </div>

              {/* Progress Indicators */}
              <div className="w-full space-y-4">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">提醒进度</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {reminders.map((r, i) => (
                          <div 
                            key={i}
                            className={`w-3 h-3 rounded-full transition-all duration-700 ${
                              r.triggered 
                                ? 'bg-emerald-500 scale-125 shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
                                : 'bg-slate-200 border border-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">已完成</span>
                      <span className="text-xl font-mono font-black text-slate-800 leading-none">
                        {reminders.filter(r => r.triggered).length}
                        <span className="text-slate-300 mx-1.5 text-base">/</span>
                        {config.reminderCount}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                       <span>时间进度</span>
                       <span className="text-emerald-600">目标 {config.durationMinutes}M</span>
                    </div>
                    <div className="h-3 w-full bg-slate-200/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full" 
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleStop}
                  className="w-full border-2 border-emerald-100 text-emerald-600 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-50 transition-all active:scale-[0.98] active:bg-emerald-100/30"
                >
                  <Square size={18} fill="currentColor" /> 停止练习
                </button>
              </div>
            </div>
          )}

          {status === SessionStatus.FINISHED && (
            <div className="space-y-6 text-center py-8 animate-in bounce-in duration-700">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full mb-4 shadow-inner">
                <CheckCircle size={40} />
              </div>
              <h2 className="text-3xl font-bold text-slate-800">身心已归位</h2>
              <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                圆满完成了 <span className="text-emerald-600 font-bold">{config.durationMinutes}分钟</span> 的正念时长。
                一共经历了 <span className="text-emerald-600 font-bold">{config.reminderCount}次</span> 觉察提醒。
              </p>
              <button 
                onClick={handleStop}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-200"
              >
                <RotateCcw size={20} /> 重置练习
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Background Decorative Elements */}
      <div className="fixed -z-10 top-0 left-0 w-full h-full pointer-events-none overflow-hidden bg-emerald-50/20">
        <div className="absolute top-[5%] left-[5%] w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-lime-100/40 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
    </div>
  );
};

export default App;

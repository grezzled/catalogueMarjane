"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

function calcTimeLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

function Block({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[36px] sm:min-w-[44px]">
      <div className="bg-white/15 backdrop-blur-sm rounded-lg w-full h-8 sm:h-10 flex items-center justify-center">
        <span className="text-base sm:text-lg font-extrabold tabular-nums">{String(value).padStart(2, "0")}</span>
      </div>
      <span className="text-red-200 text-[8px] sm:text-[9px] mt-1 font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function CountdownTimer({ endDate }: { endDate: string }) {
  const [time, setTime] = useState(() => calcTimeLeft(endDate));

  useEffect(() => {
    const id = setInterval(() => setTime(calcTimeLeft(endDate)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (time.expired) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-300" />
          <span className="text-xs sm:text-sm font-medium text-red-100">Terminé</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
        </span>
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-green-300">En cours</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Block value={time.days} label="J" />
        <span className="text-white/40 text-sm sm:text-lg font-bold pb-3 sm:pb-4">:</span>
        <Block value={time.hours} label="H" />
        <span className="text-white/40 text-sm sm:text-lg font-bold pb-3 sm:pb-4">:</span>
        <Block value={time.minutes} label="M" />
        <span className="text-white/40 text-sm sm:text-lg font-bold pb-3 sm:pb-4">:</span>
        <Block value={time.seconds} label="S" />
      </div>
    </div>
  );
}
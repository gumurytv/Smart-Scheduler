import React from 'react';
import { UserRound } from 'lucide-react';
import { ProfileAvatar } from '../types';
import { findCharacter } from '../utils/avatars';

/** Initials for a name: "Minjun Kim" → "MK", "김민준" → "김". */
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[A-Za-z]/.test(words[0])) {
    return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
  }
  return (Array.from(name.trim())[0] ?? '').toUpperCase();
}

/**
 * Profile picture: the user's photo, a character, or (without either) the name's initials
 * on `fallbackClass`, or a person icon.
 */
export const Avatar: React.FC<{
  avatar?: ProfileAvatar;
  name?: string;
  /** Tailwind size classes, e.g. "w-12 h-12" */
  sizeClass: string;
  /** Emoji / initials size, e.g. "text-[1.5rem]" */
  textClass?: string;
  fallbackClass?: string;
  className?: string;
}> = ({ avatar, name = '', sizeClass, textClass = 'text-[1.125rem]', fallbackClass = 'bg-sage-700 text-paper', className = '' }) => {
  const base = `${sizeClass} rounded-full grid place-items-center shrink-0 overflow-hidden ${className}`;
  if (avatar?.kind === 'photo') {
    return (
      <span className={base} aria-hidden="true">
        <img src={avatar.src} alt="" className="w-full h-full object-cover" draggable={false} />
      </span>
    );
  }
  const ch = avatar?.kind === 'character' ? findCharacter(avatar.id) : undefined;
  if (ch) {
    return (
      <span className={`${base} ${textClass} leading-none`} style={{ background: ch.bg }} aria-hidden="true">
        <span className="translate-y-[0.04em]">{ch.emoji}</span>
      </span>
    );
  }
  const initials = nameInitials(name);
  return (
    <span className={`${base} ${fallbackClass} font-bold ${initials ? textClass : ''}`} aria-hidden="true">
      {initials || <UserRound className="w-1/2 h-1/2" strokeWidth={2.5} />}
    </span>
  );
};

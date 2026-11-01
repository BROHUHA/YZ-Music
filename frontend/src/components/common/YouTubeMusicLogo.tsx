import React from 'react';

interface YouTubeMusicLogoProps {
  className?: string;
  size?: number;
}

/**
 * Authentic YZ Music Logo: Circular red gradient with outer ring and 5 waveform equalizer bars
 * (matches app/src/main/assets/Logo.svg & ic_logo.xml)
 */
export const YouTubeMusicLogo: React.FC<YouTubeMusicLogoProps> = ({ className = '', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 432 432"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-md ${className}`}
    >
      {/* Background Circle with Signature Red Gradient */}
      <circle cx="216" cy="216" r="216" fill="url(#yz-logo-grad)" />

      {/* Outer Luminous Ring */}
      <circle
        cx="216"
        cy="216"
        r="133.5"
        stroke="white"
        strokeWidth="13"
        strokeOpacity="0.95"
      />

      {/* 5 Waveform Bars */}
      <line
        x1="148"
        y1="201"
        x2="148"
        y2="231"
        stroke="white"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <line
        x1="182"
        y1="177"
        x2="182"
        y2="255"
        stroke="white"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <line
        x1="216"
        y1="143"
        x2="216"
        y2="289"
        stroke="white"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <line
        x1="250"
        y1="177"
        x2="250"
        y2="255"
        stroke="white"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <line
        x1="284"
        y1="201"
        x2="284"
        y2="231"
        stroke="white"
        strokeWidth="18"
        strokeLinecap="round"
      />

      <defs>
        <linearGradient
          id="yz-logo-grad"
          x1="50"
          y1="50"
          x2="382"
          y2="382"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF2A4B" />
          <stop offset="1" stopColor="#D90429" />
        </linearGradient>
      </defs>
    </svg>
  );
};

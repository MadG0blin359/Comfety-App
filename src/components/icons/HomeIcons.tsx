import React from 'react';
import { View } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Clean, GPU-rendered Hearing profile icon for Conversation Mode.
 */
export function HearingIcon({ size = 26, color = '#38BDF8' }: IconProps) {
  const scale = size / 26;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer Ear Shell */}
      <View
        style={{
          width: 20 * scale,
          height: 25 * scale,
          borderTopLeftRadius: 10 * scale,
          borderTopRightRadius: 10 * scale,
          borderBottomRightRadius: 5 * scale,
          borderBottomLeftRadius: 10 * scale,
          borderWidth: 2.2 * scale,
          borderColor: color,
          borderBottomWidth: 2.6 * scale,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Inner Acoustic Canal Curve */}
        <View
          style={{
            position: 'absolute',
            top: 5 * scale,
            right: 4 * scale,
            width: 7 * scale,
            height: 9 * scale,
            borderTopRightRadius: 4 * scale,
            borderBottomRightRadius: 4 * scale,
            borderWidth: 2 * scale,
            borderLeftWidth: 0,
            borderColor: color,
          }}
        />
        {/* Tragus Notch */}
        <View
          style={{
            position: 'absolute',
            bottom: 6 * scale,
            left: 2 * scale,
            width: 3 * scale,
            height: 4 * scale,
            borderRadius: 1.5 * scale,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Vector Studio Microphone icon for Conversation action button.
 */
export function MicIcon({ size = 18, color = '#001E2C' }: IconProps) {
  const scale = size / 18;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Capsule */}
      <View
        style={{
          width: 7 * scale,
          height: 11 * scale,
          borderRadius: 3.5 * scale,
          backgroundColor: color,
        }}
      />
      {/* U-Bracket */}
      <View
        style={{
          position: 'absolute',
          top: 3 * scale,
          width: 13 * scale,
          height: 9 * scale,
          borderBottomLeftRadius: 6.5 * scale,
          borderBottomRightRadius: 6.5 * scale,
          borderWidth: 1.8 * scale,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      {/* Stem */}
      <View
        style={{
          position: 'absolute',
          bottom: 2 * scale,
          width: 1.8 * scale,
          height: 3.5 * scale,
          backgroundColor: color,
        }}
      />
      {/* Base */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: 9 * scale,
          height: 1.8 * scale,
          borderRadius: 0.9 * scale,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * High-precision Vision Iris icon for Guide Mode.
 */
export function VisionEyeIcon({ size = 26, color = '#34D399' }: IconProps) {
  const scale = size / 26;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Almond Outer Contour (Rotated square with opposing rounded corners) */}
      <View
        style={{
          width: 19 * scale,
          height: 19 * scale,
          borderTopLeftRadius: 18 * scale,
          borderBottomRightRadius: 18 * scale,
          borderWidth: 2.2 * scale,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Central Iris & Pupil */}
        <View
          style={{
            width: 8 * scale,
            height: 8 * scale,
            borderRadius: 4 * scale,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Specular Catchlight Glint */}
          <View
            style={{
              width: 2.5 * scale,
              height: 2.5 * scale,
              borderRadius: 1.25 * scale,
              backgroundColor: '#FFFFFF',
              position: 'absolute',
              top: 1 * scale,
              right: 1 * scale,
            }}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Concentric Navigation Radar Beacon icon for Guide action button.
 */
export function RadarBeaconIcon({ size = 18, color = '#002114' }: IconProps) {
  const scale = size / 18;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer Pulse Ring */}
      <View
        style={{
          position: 'absolute',
          width: 17 * scale,
          height: 17 * scale,
          borderRadius: 8.5 * scale,
          borderWidth: 1.6 * scale,
          borderColor: color,
          opacity: 0.35,
        }}
      />
      {/* Mid Pulse Ring */}
      <View
        style={{
          position: 'absolute',
          width: 11 * scale,
          height: 11 * scale,
          borderRadius: 5.5 * scale,
          borderWidth: 1.8 * scale,
          borderColor: color,
          opacity: 0.75,
        }}
      />
      {/* Center Beacon Dot */}
      <View
        style={{
          width: 4.5 * scale,
          height: 4.5 * scale,
          borderRadius: 2.25 * scale,
          backgroundColor: color,
        }}
      />
      {/* Scanning Radar Needle */}
      <View
        style={{
          position: 'absolute',
          top: 2.5 * scale,
          right: 2.5 * scale,
          width: 4.5 * scale,
          height: 1.8 * scale,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Clean Speaker Waveform icon for footer sensory banner.
 */
export function SpeakerWaveIcon({ size = 22, color = '#38BDF8' }: IconProps) {
  const scale = size / 22;
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {/* Speaker Driver Block */}
      <View
        style={{
          width: 4 * scale,
          height: 7.5 * scale,
          backgroundColor: color,
          borderTopLeftRadius: 1.5 * scale,
          borderBottomLeftRadius: 1.5 * scale,
        }}
      />
      {/* Speaker Cone (Triangle) */}
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: 5.5 * scale,
          borderBottomWidth: 5.5 * scale,
          borderRightWidth: 6.5 * scale,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
        }}
      />
      {/* Primary Sound Arc */}
      <View
        style={{
          width: 3.5 * scale,
          height: 9.5 * scale,
          borderTopRightRadius: 6 * scale,
          borderBottomRightRadius: 6 * scale,
          borderWidth: 1.7 * scale,
          borderLeftWidth: 0,
          borderColor: color,
          marginLeft: 2 * scale,
        }}
      />
      {/* Secondary Outer Sound Arc */}
      <View
        style={{
          width: 4.5 * scale,
          height: 15 * scale,
          borderTopRightRadius: 8.5 * scale,
          borderBottomRightRadius: 8.5 * scale,
          borderWidth: 1.7 * scale,
          borderLeftWidth: 0,
          borderColor: color,
          marginLeft: 2 * scale,
        }}
      />
    </View>
  );
}

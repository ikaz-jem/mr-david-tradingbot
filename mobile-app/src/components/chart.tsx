import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text, View } from 'react-native';
import { C } from '../lib/theme';

export function Sparkline({ values, height = 140, color = C.lime }: { values: number[]; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const width = 320; const bottom = height - 10; const top = 12;
  const min = Math.min(...values); const range = Math.max(...values) - min || 1;
  const points = values.map((value, index) => ({ x: index / (values.length - 1) * width, y: bottom - (value - min) / range * (bottom - top) }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><Defs><LinearGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.27"/><Stop offset="1" stopColor={color} stopOpacity="0"/></LinearGradient></Defs><Path d={area} fill="url(#area)"/><Path d={line} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

export function ConfidenceGauge({ value, color = C.lime, label = 'DECISION CONFIDENCE' }: { value: number | null; color?: string; label?: string }) {
  const score = value == null ? null : Math.max(0, Math.min(100, Number(value)));
  return <View style={{ width: 205, alignSelf: 'center', alignItems: 'center', marginTop: 19 }} accessibilityLabel={score == null ? `${label}: unavailable` : `${label}: ${score} out of 100`}>
    <Svg width={205} height={119} viewBox="0 0 205 119"><Path d="M 22 105 A 80 80 0 0 1 182 105" stroke={C.line} strokeWidth="14" strokeLinecap="round" fill="none"/><Path d="M 22 105 A 80 80 0 0 1 182 105" stroke={color} strokeWidth="14" strokeLinecap="round" fill="none" strokeDasharray={[score == null ? 0 : score * 2.513, 251.3]}/></Svg>
    <Text style={{ color: C.white, fontSize: 31, fontWeight: '900', marginTop: -62 }}>{score ?? '—'}</Text><Text style={{ color, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 16 }}>{label}</Text>
  </View>;
}

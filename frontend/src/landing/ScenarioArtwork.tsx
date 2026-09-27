import { useId } from 'react';
import grainTexture from './grain.svg';
import './scenario-motion.css';

type Paint = { gradient: string; noise: string };

function Grain({ x, y, width, height, paint, radius = 12, className }: {
  x: number; y: number; width: number; height: number; paint: Paint; radius?: number; className?: string;
}) {
  return <g className={className} style={{ isolation: 'isolate' }}><rect x={x} y={y} width={width} height={height} rx={radius} fill="var(--studio-paper)" /><rect x={x} y={y} width={width} height={height} rx={radius} fill={paint.gradient} /><rect x={x} y={y} width={width} height={height} rx={radius} fill={paint.noise} opacity=".62" style={{ mixBlendMode: 'screen' }} /></g>;
}

function Paper({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} rx="10" fill="var(--studio-paper)" stroke="var(--studio-line)" />;
}

function Lines({ x, y, width = 68 }: { x: number; y: number; width?: number }) {
  return <g strokeLinecap="round"><path d={`M${x} ${y}h${width}`} stroke="var(--studio-ink)" strokeWidth="3" opacity=".65" /><path d={`M${x} ${y + 12}h${width * .7}`} stroke="var(--studio-line)" strokeWidth="3" /><path d={`M${x} ${y + 22}h${width * .85}`} stroke="var(--studio-line)" strokeWidth="3" /></g>;
}

function Beginners({ paint }: { paint: Paint }) {
  return <>
    <Grain x={294} y={29} width={82} height={150} paint={paint} />
    <Grain x={342} y={114} width={88} height={139} paint={paint} />
    <Paper x={40} y={150} width={88} height={100} />
    <Lines x={58} y={204} width={45} />
    <path className="scene-motion scene-spark" d="M83 166l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill={paint.gradient} stroke="#d9b856" strokeWidth="1" />
    <path d="M132 188C163 188 157 135 187 135" fill="none" stroke="var(--studio-line)" strokeWidth="1.5" strokeDasharray="4 5" />
    <circle className="scene-motion scene-idea" cx="158" cy="166" r="4" fill="#ebca69" />
    <g className="scene-motion scene-arrive scene-delay-2">
    <Paper x={191} y={70} width={198} height={144} />
    <Grain x={307} y={82} width={69} height={83} paint={paint} />
    <Grain x={279} y={135} width={97} height={65} paint={paint} />
    <Lines x={211} y={126} width={73} />
    <path d="M210 181h35" stroke="var(--studio-line)" strokeWidth="3" strokeLinecap="round" />
    </g>
    <circle cx="380" cy="215" r="17" fill="var(--studio-paper)" stroke="var(--studio-line)" />
    <path className="scene-motion scene-draw scene-delay-3" pathLength="1" d="M373 215l5 5 9-10" fill="none" stroke="#b49543" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </>;
}

function Designers({ paint }: { paint: Paint }) {
  return <>
    <Grain x={60} y={45} width={98} height={143} paint={paint} />
    <Paper x={82} y={68} width={186} height={150} />
    <path d="M99 92h74M99 102h46" stroke="var(--studio-line)" strokeWidth="3" strokeLinecap="round" />
    <Paper x={183} y={91} width={210} height={153} />
    <Grain x={280} y={108} width={97} height={73} paint={paint} />
    <Grain x={251} y={155} width={87} height={73} paint={paint} />
    <path className="scene-motion scene-draw" pathLength="1" d="M211 194C237 113 311 222 350 136" fill="none" stroke="var(--studio-ink)" strokeWidth="1.4" opacity=".72" />
    <path d="M211 194l13-46M350 136l-21 53" fill="none" stroke="#c4a14b" strokeWidth="1" />
    {[ [211, 194], [224, 148], [350, 136], [329, 189] ].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" fill="var(--studio-paper)" stroke="#b89949" />)}
    <Paper x={117} y={227} width={123} height={36} />
    {['#f7d567', '#ffefb3', '#f6f5ef', '#292a2b'].map((color, i) => <circle className={`scene-motion scene-swatch scene-delay-${i}`} key={color} cx={135 + i * 28} cy="245" r="8" fill={color} />)}
    <path className="scene-motion scene-cursor" d="M389 215l-5 27 9-7 7 12 6-4-7-11 11-3z" fill="var(--studio-paper)" stroke="var(--studio-ink)" strokeWidth="1.3" strokeLinejoin="round" />
  </>;
}

function Educators({ paint }: { paint: Paint }) {
  return <>
    <Grain x={287} y={29} width={92} height={139} paint={paint} />
    <Paper x={163} y={52} width={241} height={159} />
    <Lines x={185} y={75} width={70} />
    <path className="scene-motion scene-draw scene-delay-1" pathLength="1" d="M284 119v18M222 154v-17h124v17" fill="none" stroke="var(--studio-line)" strokeWidth="1.5" />
    <Grain x={260} y={105} width={48} height={26} radius={6} paint={paint} />
    {[198, 260, 322].map((x, i) => <g className={`scene-motion scene-arrive scene-delay-${i + 1}`} key={x}><rect x={x} y="151" width="48" height="30" rx="6" fill="var(--studio-soft)" stroke="var(--studio-line)" /><path d={`M${x + 12} 166h24`} stroke="#cbb367" strokeWidth="2" strokeLinecap="round" /></g>)}
    <g className="scene-motion scene-book">
    <path d="M51 163Q99 147 145 173Q191 147 239 163V258Q190 245 145 268Q99 245 51 258Z" fill="var(--studio-paper)" stroke="var(--studio-line)" strokeWidth="1.2" />
    <path d="M145 173v94" stroke="var(--studio-line)" />
    <Grain x={68} y={178} width={59} height={31} radius={5} paint={paint} />
    <path d="M69 222l56 5M69 234l40 4M162 190l55-8M162 204l55-8M162 218l40-6M162 232l48-7" stroke="var(--studio-line)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M209 159v39l7-6 7 4v-39" fill="#f1d680" />
    </g>
  </>;
}

function Students({ paint }: { paint: Paint }) {
  return <>
    <Grain x={77} y={57} width={101} height={133} paint={paint} />
    <Grain x={128} y={138} width={100} height={121} paint={paint} />
    <Paper x={105} y={75} width={161} height={172} />
    <path d="M125 76v170" stroke="var(--studio-line)" />
    {[96, 123, 150, 177, 204, 231].map(y => <path key={y} d={`M99 ${y}h12`} stroke="#cabd99" strokeWidth="2.4" strokeLinecap="round" />)}
    <Lines x={145} y={101} width={85} />
    {[151, 177, 203].map((y, i) => <g key={y}><rect x="145" y={y} width="10" height="10" rx="2" fill="none" stroke="#d3c18d" /><path className={`scene-motion scene-draw scene-delay-${i + 1}`} pathLength="1" d={`M148 ${y + 5}l2 2 4-5`} fill="none" stroke="#b49543" /><path className={`scene-motion scene-draw scene-delay-${i + 1}`} pathLength="1" d={`M168 ${y + 5}h65`} stroke="var(--studio-line)" strokeWidth="2.5" strokeLinecap="round" /></g>)}
    <Paper x={289} y={42} width={92} height={75} />
    <circle cx="334" cy="76" r="15" fill="none" stroke="#dfc269" />
    <ellipse cx="334" cy="76" rx="27" ry="9" transform="rotate(-35 334 76)" fill="none" stroke="#dfc269" />
    <circle cx="354" cy="61" r="4" fill="#ebca69" />
    <Paper x={285} y={169} width={98} height={81} />
    <Grain x={296} y={180} width={74} height={33} radius={5} paint={paint} />
    <path d="M298 228h57M298 237h34" stroke="var(--studio-line)" strokeWidth="2.5" strokeLinecap="round" />
    <g className="scene-motion scene-pencil"><g transform="rotate(32 285 156)"><Grain x={280} y={102} width={10} height={94} radius={3} paint={paint} /><path d="M280 190h10l-5 14z" fill="#baa77b" /><path d="M285 108v75" stroke="#fff9e5" strokeWidth="2" /></g></g>
  </>;
}

function Professionals({ paint }: { paint: Paint }) {
  return <>
    <Grain x={300} y={39} width={94} height={134} paint={paint} />
    <Grain x={353} y={127} width={75} height={116} paint={paint} />
    <Paper x={79} y={60} width={300} height={168} />
    <Lines x={101} y={86} width={89} />
    <path d="M106 197h132" stroke="var(--studio-line)" />
    {[ [111, 160, 32], [156, 138, 54], [201, 116, 76] ].map(([x, y, height], i) => <Grain className={`scene-motion scene-grow scene-delay-${i}`} key={x} x={x} y={y} width={27} height={height} radius={5} paint={paint} />)}
    <path className="scene-motion scene-draw scene-delay-2" pathLength="1" d="M110 145l49-29 48-13" fill="none" stroke="var(--studio-ink)" strokeWidth="1.3" opacity=".6" />
    <path d="M200 100l8 3-5 7" fill="none" stroke="var(--studio-ink)" strokeWidth="1.3" opacity=".6" />
    <circle cx="300" cy="143" r="32" fill="none" stroke="var(--studio-line)" strokeWidth="13" />
    <g className="scene-motion scene-ring" style={{ isolation: 'isolate' }}><circle cx="300" cy="143" r="32" fill="none" stroke="var(--studio-paper)" strokeWidth="13" strokeDasharray="139 202" transform="rotate(-90 300 143)" /><circle cx="300" cy="143" r="32" fill="none" stroke={paint.gradient} strokeWidth="13" strokeDasharray="139 202" transform="rotate(-90 300 143)" /><circle cx="300" cy="143" r="32" fill="none" stroke={paint.noise} strokeWidth="13" strokeDasharray="139 202" transform="rotate(-90 300 143)" opacity=".5" style={{ mixBlendMode: 'screen' }} /></g>
    <path d="M230 230v20M141 267v-17h178v17" fill="none" stroke="var(--studio-line)" strokeWidth="1.3" />
    {[141, 230, 319].map(x => <g key={x}><rect x={x - 22} y="260" width="44" height="25" rx="7" fill="var(--studio-paper)" stroke="var(--studio-line)" /><circle cx={x - 7} cy="272" r="4" fill="#e6cb79" /><path d={`M${x + 2} 272h10`} stroke="var(--studio-line)" strokeWidth="2" /></g>)}
  </>;
}

const scenes = [Beginners, Designers, Educators, Students, Professionals];

/** Five native vector illustrations share the landing page's gradient and grain texture. */
export function ScenarioArtwork({ scenario }: { scenario: number }) {
  const id = useId().replace(/:/g, '');
  const paint = { gradient: `url(#${id}-color)`, noise: `url(#${id}-grain)` };
  const Scene = scenes[scenario - 1] ?? Beginners;
  return <div className="scenario-artwork" data-scenario={scenario} aria-hidden="true">
    <svg viewBox="0 0 480 310" fill="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-color`} x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#fffdf4" stopOpacity=".4" /><stop offset=".5" stopColor="#f9df7a" stopOpacity=".75" /><stop offset="1" stopColor="#f3ca43" /></linearGradient>
        <pattern id={`${id}-grain`} width="144" height="144" patternUnits="userSpaceOnUse"><image href={grainTexture} width="144" height="144" /></pattern>
      </defs>
      <Scene paint={paint} />
    </svg>
  </div>;
}

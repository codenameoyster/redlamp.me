import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
// The frequency bins of each bar for an FFT size of 256 at 48 kHz: about 0-375 Hz, 375-1125 Hz, 1125-3750 Hz and 3750-12000 Hz.
const bands = [[0, 2], [2, 6], [6, 20], [20, 64]];

// The melody of the student in a card like the music card of omarchy.org. Layout keeps the card on page changes, so the melody plays on.
export function Music() {
	const audio = useRef<HTMLAudioElement>(null), seek = useRef<HTMLInputElement>(null), line = useRef<HTMLSpanElement>(null), time = useRef<HTMLSpanElement>(null), bars = useRef<(HTMLSpanElement | null)[]>([]), dragging = useRef(false);
	const graph = useRef<{ context: AudioContext; analyser: AnalyserNode } | null>(null);
	const [playing, setPlaying] = useState(false), [touched, setTouched] = useState(false), [failed, setFailed] = useState(false);
	function show(element: HTMLAudioElement) {
		if (!element.duration) return;
		line.current!.style.transform = `scaleX(${element.currentTime / element.duration})`;
		time.current!.textContent = `${clock(element.currentTime)} / ${clock(element.duration)}`;
		if (!dragging.current) seek.current!.value = String(Math.round(element.currentTime / element.duration * 1000));
	}
	async function toggle() {
		const element = audio.current!;
		setTouched(true);
		if (!element.paused) { element.pause(); setPlaying(false); return; }
		try {
			if (!graph.current) {
				// Static assets answer without byte ranges, and the browser seeks only in a resource with ranges or in a blob.
				const response = await fetch('/leetcode/assets/melody.mp3');
				if (!response.ok) throw new Error('melody');
				element.src = URL.createObjectURL(await response.blob());
				const context = new AudioContext(), analyser = context.createAnalyser(), gain = context.createGain();
				analyser.fftSize = 256; analyser.smoothingTimeConstant = 0; gain.gain.value = 0.6;
				context.createMediaElementSource(element).connect(analyser).connect(gain).connect(context.destination);
				graph.current = { context, analyser };
			}
			await graph.current.context.resume();
			await element.play();
			setPlaying(true); setFailed(false);
		} catch { setPlaying(false); setFailed(true); }
	}
	function jump(value: number) {
		const element = audio.current!;
		if (!element.duration) return;
		element.currentTime = value / 1000 * element.duration;
		show(element);
	}
	useEffect(() => {
		if (!playing) return;
		const element = audio.current!, { analyser } = graph.current!, data = new Float32Array(analyser.frequencyBinCount), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const levels = [0, 0, 0, 0], floors = [1, 1, 1, 1], ceilings = [0, 0, 0, 0];
		let frame = requestAnimationFrame(draw);
		function draw() {
			frame = requestAnimationFrame(draw);
			show(element);
			if (still) return;
			analyser.getFloatFrequencyData(data);
			// As on omarchy.org: each bar spans the recent quietest and loudest power of its band, so a steady melody still moves the bars. The bar goes up fast and down slowly.
			bands.forEach(([from, to], index) => {
				let power = 0;
				for (let bin = from; bin < to; bin++) power += 10 ** (data[bin] / 10);
				const raw = Math.max(0, Math.min(1, (10 * Math.log10(power / (to - from)) + 90) / 90));
				ceilings[index] = Math.max(ceilings[index] * 0.9993, raw);
				floors[index] = Math.min(raw, floors[index] + (ceilings[index] - floors[index]) * 0.003);
				const level = Math.max(0, Math.min(1, (raw - floors[index]) / Math.max(0.08, ceilings[index] - floors[index])));
				levels[index] += (level - levels[index]) * (level > levels[index] ? 0.7 : 0.2);
				bars.current[index]!.style.height = `${Math.max(1, Math.round(levels[index] * 6)) * 2}px`;
			});
		}
		return () => { cancelAnimationFrame(frame); for (const bar of bars.current) bar!.style.height = '2px'; };
	}, [playing]);
	return <div className="music">
		<audio ref={audio} loop />
		<button className={playing ? 'cover playing' : 'cover'} onClick={toggle} aria-label={playing ? 'Выключить мелодию' : 'Включить мелодию'} data-tip={playing ? 'Выключить мелодию.' : 'Включить мелодию.'}>
			{!touched && <span className="music-ring" aria-hidden="true" />}
			<span className="cover-shade">{playing ? <Volume2 size={18} /> : <VolumeX size={18} />}</span>
		</button>
		<span className="music-text"><strong>{failed ? 'Мелодия не включилась' : 'Бомжарня'}</strong><span className="music-artist"><span>Bibik</span><span ref={time} aria-hidden="true" /></span></span>
		<span className="music-bars" aria-hidden="true">{bands.map((band, index) => <span key={index} ref={bar => { bars.current[index] = bar; }} />)}</span>
		<span ref={line} className="music-line" aria-hidden="true" />
		<input ref={seek} type="range" min={0} max={1000} step={5} defaultValue={0} aria-label="Позиция в мелодии" onPointerDown={() => { dragging.current = true; }} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }} onChange={event => jump(Number(event.target.value))} />
	</div>;
}

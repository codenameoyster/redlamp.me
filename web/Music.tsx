import { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// The melody of the student. Layout keeps this element on page changes, so the melody plays on.
export function Music() {
	const audio = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false), [position, setPosition] = useState(0);
	async function toggle() {
		const element = audio.current!;
		if (!element.paused) { element.pause(); setPlaying(false); return; }
		try {
			// Static assets answer without byte ranges, and the browser seeks only in a resource with ranges or in a blob.
			if (!element.src) element.src = URL.createObjectURL(await (await fetch('/leetcode/assets/melody.mp3')).blob());
			element.volume = 0.6;
			await element.play();
			setPlaying(true);
		} catch { setPlaying(false); }
	}
	function seek(value: number) {
		const element = audio.current!;
		setPosition(value);
		if (element.duration) element.currentTime = value / 1000 * element.duration;
	}
	return <div className="music">
		<audio ref={audio} loop onTimeUpdate={event => { const { currentTime, duration } = event.currentTarget; if (duration) setPosition(Math.round(currentTime / duration * 1000)); }} />
		<button className={playing ? 'icon-button playing' : 'icon-button'} onClick={toggle} aria-label={playing ? 'Выключить мелодию' : 'Включить мелодию'} data-tip={playing ? 'Выключить мелодию.' : 'Включить мелодию.'}>{playing ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
		<input type="range" aria-label="Позиция в мелодии" min={0} max={1000} value={position} onChange={event => seek(Number(event.target.value))} />
	</div>;
}
